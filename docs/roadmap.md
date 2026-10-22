# Roadmap

Every ticket meets the definition of done in `.claude/CLAUDE.md`. Sizes are
rough minutes. The build stops when I call it, and `/finalize` runs after
that.

## Core

| # | Ticket | Slice | Acceptance | Size | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | **Setup** | Add `@huggingface/transformers` and an `npm test` script (`node --test`). Cut `scripts/seed.js` down to creating the table and bucket only (decision 7). Add Makefile targets. | `npm test` runs. `make seed` creates the table and bucket and loads no rows. | 10 | done |
| 2 | **Vector math (test-first)** | `backend/lib/vectors.js`: `normalize`, `dot`, `topK` (sorted, limited, ties broken by `id`). | `node --test` passes, including the unit-length, zero-vector and ordering cases. | 15 | done |
| 3 | **Embedder** | `backend/lib/embedder.js`: CLIP loads once (one shared promise), with `embedImage(bytes)` and `embedText(query)`, both normalized. Add `make warm` to pre-download the model. | A script embeds a dog photo and two phrases. Using `dot`, the image scores higher against "a dog" than against "a city skyline". | 20 | todo |
| 4 | **Ingest happy path + error boundary** | `POST /images`: download → embed → S3 → DynamoDB → 201. Register the route in `handler.js`, `local-server.js` and `deploy.sh`. One shared error boundary around `route` turns any unexpected error into `500 { "error": "internal error" }` and logs it, for both entry points. | `curl` returns 201 with the spec's shape. `aws --endpoint-url=http://localhost:4566` shows the item with 512 numbers and the S3 object at `originals/{id}`. A forced failure (LocalStack stopped) returns 500 instead of hanging. | 30 | todo |
| 5 | **Semantic search** (walking skeleton complete) | Replace `naiveSearch`. Build the cache: `loaded` flag, one shared paginated Scan, add-if-absent, ingest always adds (decision 17). | After ingesting a few hand-picked Unsplash URLs, searching "a dog" ranks the dog first through the server and the frontend. | 25 | todo |
| 6 | **Bulk loader** | Run `make dataset` with `UNSPLASH_DIR` pointing at the downloaded Unsplash Lite. `scripts/ingest.js` calls `POST /images` for every item in `data/sample_images.json`, a few at a time, and reports failures. Add `make ingest`. | All 400 ingest, or failures are listed. A re-run leaves the count unchanged (idempotent). | 20 | todo |
| 7 | **Demo queries + template test** | Choose the demo query set: an object, a scene, a mood, a paraphrase with no caption overlap, and one query with no good match. Test `"a photo of …"` against it (decision 9). | Queries recorded with their top results. Decision 9's outcome recorded. | 10 | todo |
| 8 | **Validation (test-first)** | Pure `validateSearch` / `validateIngest` functions return the spec's 400s, wired into both routes. | Tests pass. `curl` shows 400s for an empty query, `limit: 0` and a bad URL. | 15 | todo |
| 9 | **Download safeguards** | 10s timeout, 10MB cap, and 422 for a failed download or decode, with nothing stored (decision 10). | `curl` with a 404 URL and with a non-image URL both return 422, and S3 and DynamoDB stay unchanged. | 15 | todo |
| 10 | **Lambda deploy** (best-effort, time-boxed) | Run `make deploy`. Expect a failure: `backend/node_modules` measured 498MB against Lambda's 250MB unzipped limit, and the `sharp` image decoder installed on this Mac is a macOS-only build that won't load on Linux. | Works, or the real failure is documented. The first ticket to cut. | 15 max | todo |

## Backlog

Ranked by value per minute. Pulled top-down via `/implement-ticket` if the
core lands early.

| Rank | Feature | How I'd build it on this data model | Depends on | Size |
| --- | --- | --- | --- | --- |
| 1 | **`minScore`** | An optional field in `validateSearch` (with a test), and a filter after `topK` in the search route. The response shape doesn't change. | 8 | 10 |
| 2 | **Delete** | Add `DELETE /images/:id` in `handler.js` (parse the id from the path), `local-server.js` and `deploy.sh`. It runs DynamoDB `DeleteItem`, S3 `DeleteObject originals/{id}` and `cache.delete`, and keeps a `recentDeletes` set during the initial load so the Scan doesn't re-add the image. 404 if the id doesn't exist. | 5 | 20 |
| 3 | **Ownership filtering** | `ownerId` becomes an optional, validated field on ingest and is stored on the record. Search takes `ownerId` and filters the cache before scoring. The bulk script assigns owners in rotation so there's data to demo. The owner is supplied by the caller and trusted (no auth). | 6, 8 | 25 |
| 4 | **Pagination** | Search takes an optional `cursor` (the offset as an opaque string) and returns `nextCursor`, a new field. Results are deterministic because ties are broken by `id`. | 2, 8 | 15 |
| 5 | **Hybrid search** | A pure keyword-ranking function (reusing the kit's matcher) and a pure reciprocal rank fusion function (k = 60), both test-first. Search merges the two rankings (decision 16). Highest risk: the gain is only visible with queries chosen to show it. | 2, 7 | 30 |

Scale items (ANN index, async ingest, a separate embedding service, bulk
re-embedding, per-instance cache drift, Group-scoped search) are not backlog.
They live in the spec's Scale plan only.

## Order rationale

- **Walking skeleton by ticket 5:** a real query, real CLIP vectors, and a real ranking through the running server and the frontend. Every later ticket keeps it demoable.
- **Vector math before the embedder.** The embedder's acceptance check needs `normalize` and `dot`, and pure logic is quick to land test-first. The embedder is still the riskiest unit (native dependencies, the model download, image decoding), so it comes immediately after.
- **The error boundary ships with the first route that does I/O.** Express 4 hangs on an async error instead of failing, and ingest is where debugging starts.
- **The cache's correctness is part of ticket 5, not polish.** The paginated Scan and the `loaded` merge rule are known pitfalls (decision 17).
- **Real data before validation and safeguards.** Both are firmly core, because the spec's API and decision 10 commit to the 400 and 422 behavior. They follow the bulk loader so that the demo runs on real data first.
- **Lambda is last and time-boxed,** per decision 1. It is the first ticket to cut.
