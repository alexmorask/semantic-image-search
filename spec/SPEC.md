# Spec — Semantic Image Search

The full reasoning behind each choice is in [`docs/decisions.md`](../docs/decisions.md).

## Problem

Users remember *what's in* a photo ("golden retriever on a beach at sunset"), not what they named it, and many photos have no useful caption. We're building search that takes a plain-English description and returns the most relevant images from a user's library, ranked.

**A good result:** the top few are visibly right, ranked by meaning rather than keyword overlap, including for uncaptioned photos.

**This build:** a thin slice over the 400-image Unsplash sample, with one ingest path and one read path, searching one shared collection. Scoping search to a user or Group is in the Backlog and is the basis of the Scale plan. Quality is checked by eye against fixed demo queries, including a paraphrase with no caption overlap and one with no good match.

## Approach

CLIP (`Xenova/clip-vit-base-patch32`) runs in Node through transformers.js and embeds images and text into the same 512-number space. **Only the image is embedded**, because captions are often missing or poor. Captions come back with hybrid search (Backlog).

Vectors are normalized to length 1, so similarity is a dot product. Images and queries go through the same model and code, and every record stores `embeddingModel`, so vectors from different models are never compared. The query is embedded as typed. An `"a photo of …"` template is kept only if it visibly helps the demo queries.

**Limits:** CLIP truncates text longer than 77 tokens and is weak at counting, at negation, and at reading text inside images.

## Data model

**DynamoDB table `images`**, partition key `id`:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | S | Caller-supplied (the Unsplash id in bulk loads), or a generated UUID |
| `url`, `description` | S | For display. `description` is not embedded |
| `keywords` | L | Kept for hybrid search |
| `s3Key` | S | `originals/{id}` |
| `embedding` | L of N | 512 normalized numbers, about 6KB, readable when inspecting data |
| `embeddingModel`, `createdAt` | S | Model id, ISO 8601 |

**S3 bucket `images`** keeps the original bytes at `originals/{id}`, so everything can be re-embedded, and a retry overwrites rather than duplicates.

**In-memory cache:** every vector, keyed by `id`. A separate `loaded` flag is set only after a full paginated Scan completes. A non-empty cache doesn't count as loaded. Concurrent first searches share one in-flight Scan. Ingest always adds to the cache, and the Scan only adds records the cache doesn't already have, so an image ingested mid-Scan is never dropped and an older copy never overwrites a newer one.

```
WRITE  POST /images
  validate ─▶ download ─▶ decode + CLIP image ─▶ normalize ─▶ S3 put ─▶ DDB put ─▶ cache.set ─▶ 201
     │400        │ fail          │ fail
                 └──── 422 ──────┘           (a 422 leaves nothing stored)

READ   POST /search
  validate ─▶ loaded? ──no──▶ await the shared load: one paginated Scan, add if absent ─▶ loaded = true
     │400       │ yes                                                                                 │
                ▼◀────────────────────────────────────────────────────────────────────────────────────┘
            CLIP text ─▶ normalize ─▶ dot product vs every cached vector ─▶ top limit ─▶ 200
```

## API

Errors are `{ "error": "<message>" }`. Malformed JSON returns **400**, and unexpected failures return **500**. **`GET /health`** is unchanged.

**`POST /search`** keeps the kit's shape, so the frontend is unchanged.

```
request   { "query": "dog on a beach", "limit": 12 }
200       { "query", "count", "results": [ { "id", "url", "description", "score" } ] }
```

- Results are sorted by `score` (cosine similarity). There's **no minimum score by default**, so weak matches still return, with low scores. An optional `minScore` in [-1, 1] drops results below it, so fewer than `limit` may return.
- `limit` defaults to 12 and is capped at 50. **400** for a missing or empty `query`, a `limit` that isn't a positive integer, or a `minScore` that isn't a number in [-1, 1].

**`POST /images`** ingests one image.

```
request   { "url": "https://…", "id"?, "description"?, "keywords"?: [] }
201       { "id", "url", "description", "embeddingModel", "createdAt" }
```

- **400** for a missing or non-http(s) `url`, or an `id` that isn't 1–128 letters, digits, `-` or `_` (it becomes an S3 key). **422** if the image can't be downloaded (error, non-2xx, more than 10s, larger than 10MB) or decoded.
- An existing `id` is replaced, so re-embedding after a model change is a re-ingest.
- **Known gap:** the server fetches any URL it can reach, including internal ones (SSRF). Presigned uploads in the Scale plan fix this.

## Scale plan

*Reasoning, not built.* This build holds 400 images. Photobucket holds about 14B.

| | This build | At about 14B photos |
| --- | --- | --- |
| **Vectors** | DynamoDB list, about 6KB each | Amazon S3 Vectors, float32, about 2KB each, about 28TB in total |
| **Retrieval** | Brute force in memory | S3 Vectors' built-in ANN, inside one Group's index |
| **Scope** | One shared collection | **One index per Group** |
| **Ingest** | Synchronous, server fetches the URL | Presigned S3 upload → S3 event → SQS → embedding workers |
| **Embedding** | In the API process | A separate, versioned GPU service |
| **Model change** | Re-ingest through `POST /images` | A bulk re-embedding pipeline from the S3 originals |
| **Hot path** | Query embedding | Group index lookup |
| **Pagination** | None (`limit` ≤ 50) | A `(score, id)` cursor |

**Group-scoped search makes it tractable.** Users search their own Groups, so each search covers about 5,000 photos × 2KB ≈ **10MB**, not **28TB**. The Group is also the permission boundary: check membership, then query only that Group's index. We use separate indexes rather than one shared index filtered by Group, because a filter that narrow reduces ANN recall and can return fewer than `limit` results. The cost is S3 Vectors' default of 10,000 indexes per bucket, so indexes are spread across buckets or a higher limit is requested.

**Store:** S3 Vectors has the lowest storage cost, and AWS states about 100ms latency for frequent queries, which is enough for a Group-sized search. OpenSearch with k-NN is the upgrade path for hybrid search or very low latency.

- **Re-embedding:** a new model builds new indexes in the background, with dual-writes until cutover. One index never mixes models.
- **Cache drift:** each Lambda instance holds its own cache and does a cold-start Scan. The shared vector store removes both.
- **Cost:** a one-off embedding backfill, about 28TB of vectors, and query embedding on every search.

## Out of scope

**Backlog:** buildable, but left out of the thin slice.

| Feature | Why it stays a small change |
| --- | --- |
| **Delete** | `id` is the key everywhere: `DeleteItem` + `DeleteObject originals/{id}` + `cache.delete(id)`. During the initial load, a Scan page read before the delete could re-add the image, so delete tracks recent deletes until the load finishes |
| **Ownership / permissions** | Add `ownerId`/`groupId` at ingest and filter before scoring. This is the per-Group index, in miniature |
| **Pagination** | Ranking is deterministic, so a cursor over the sorted list, returned in a new `nextCursor` field |
| **Hybrid search** | Captions and keywords are already stored. Merge the two rankings by position (reciprocal rank fusion) |

**Not planned:** authentication and user accounts, an upload UI, and the Lambda deploy as the primary path.

## AI notes

**Workflow:** two Claude agents. A drafting agent (Claude Code) writes the spec, code, and decisions. A review agent (a separate Claude) ran the up-front planning session and adversarially reviews the drafting agent's output. I direct both and make each call. Who proposed what is recorded per decision in `docs/decisions.md`.

The agents also caught each other: the review agent found the partial-cache bug, and the drafting agent found that the first fix dropped images ingested mid-Scan (#17).

**My own catches:**
- **Scope framing (#8):** the planning prompt framed the out-of-scope features as "deferred to the live session". I overrode that as presumptuous, since I don't know what the panel will ask, and replaced it with a ranked backlog.
- **No threshold (#12):** I asked what users would actually see when nothing matches, which put `minScore` in the Backlog.
- **Vector store (#15):** my question about latency led to the docs check showing the real risk was recall, which changed the design to one index per Group.
- **Latency figures:** I pushed back on committing to measured latency in the spec, because the assignment doesn't ask for it.
