# Decisions

The running fork-by-fork log, kept in the format of the **recording-decisions**
skill. Entries are never renumbered. A reversal gets a new entry that supersedes
the old one.

Two Claude agents work on this project, and I direct both and make each call.
The **drafting agent** (Claude Code) writes the spec, code, and decisions. The
**review agent** (a separate Claude) ran the up-front planning session and
adversarially reviews the drafting agent's output. Decisions 1–8 came out of
that planning session before the build started.

## 1. CLIP via transformers.js in Node for all embeddings

**Decision:** Embed with CLIP (`Xenova/clip-vit-base-patch32`) through `@huggingface/transformers`, running in the Node backend. The same code embeds images at ingest and query text at search. The model loads once and is reused. The kit's Python embedding script is not used.
**Rationale:** CLIP puts images and text in one vector space, so a text query can be compared directly to the image itself, not to a caption. One code path for both sides guarantees the vectors are comparable. Running in-process means no API keys, no cost, and no network dependency during the live demo.
**Tradeoff:** A large first-load model download, and risky Lambda packaging (native binaries, architecture mismatch). That is why the local Express server is the demo path and the Lambda deploy is best-effort.
**Rejected:** A hosted multimodal embedding API (signup, cost, and a network dependency during the live demo). A separate Python embedding service (an extra moving part for little gain at this size).
**AI vs. me:** The review agent recommended transformers.js over a hosted API or a Python service in the planning session. I accepted it for a first pass.

## 2. One DynamoDB table for records and vectors, with original bytes in S3

**Decision:** One DynamoDB table `images`, partition key `id`, with fields `id`, `url`, `description`, `keywords`, `s3Key`, `embedding` (512 normalized numbers), `embeddingModel`, and `createdAt`. The original image bytes are stored in the S3 bucket `images`.
**Rationale:** Each image is one independent record, so ingests don't contend and an overwrite by `id` is atomic. Keeping the original bytes means everything can be re-embedded if the model changes, and `embeddingModel` says which model produced each vector.
**Tradeoff:** Search has to read every vector out of DynamoDB (a paginated Scan) to build the in-memory cache. Item size grows with the vector.
**Rejected:** All vectors in a single S3 file. Every ingest rewrites the whole file, and concurrent ingests overwrite each other.
**AI vs. me:** Proposed by the review agent in the planning session; I accepted it.

## 3. Normalize vectors at ingest; similarity is a dot product

**Decision:** Vectors are scaled to length 1 before they are stored, and query vectors are normalized the same way, so cosine similarity is a plain dot product. Normalize and similarity are small, pure, unit-tested functions.
**Rationale:** Normalization is paid once per image at write time instead of on every comparison at search time. Pure functions are trivial to test with `node --test` and to explain.
**Tradeoff:** Stored vectors lose their original magnitude. CLIP similarity doesn't use it, but a different model might.
**Rejected:** A vector math package (a dependency for a few lines of arithmetic). Storing raw vectors and normalizing on read: keeps original magnitudes, but redoes the work on every cache load.
**AI vs. me:** Proposed by the review agent in the planning session; I accepted it.

## 4. Brute-force search over an in-memory cache

*Refined by #17: how the cache is loaded and kept fresh.*

**Decision:** Compare the query against every stored vector, held in memory after the first load, and return the top results by score.
**Rationale:** At a few hundred images, brute force is exact, fast, and has no moving parts. The kit's README calls it fine at this size.
**Tradeoff:** Linear in the number of images, and each process holds its own copy of every vector. It doesn't scale to millions, and multiple instances drift apart.
**Rejected:** An ANN vector index now. It is the scale plan, not this build.
**AI vs. me:** Proposed by the review agent in the planning session; I accepted it.

## 5. Synchronous ingest

*Refined by #10: the order within the request changed to embed before storing.*

**Decision:** `POST /images` downloads the image, stores it in S3, embeds it, and writes the record before responding.
**Rationale:** One request, one visible result. It is simple to reason about, to demo, and to verify. The caller knows the image is searchable when it gets a 201.
**Tradeoff:** Ingest latency includes download and embedding, and throughput is bounded by the API process. The scale plan moves this to S3 upload → queue → embedding workers.
**Rejected:** An async queue-and-worker pipeline now. It adds moving parts the thin slice doesn't need.
**AI vs. me:** Proposed by the review agent in the planning session; I accepted it.

## 6. API: keep /search's shape, add an idempotent POST /images

**Decision:** `POST /search` keeps the kit's request/response shape. Empty query → 400, and `limit` defaults to 12, capped at 50. `POST /images` takes `{ url, id?, description?, keywords? }` and returns 201 `{ id, url, description, embeddingModel, createdAt }`. Missing or invalid URL → 400. Image can't be fetched or decoded → 422. An existing `id` is overwritten. `GET /health` is unchanged. New routes are registered in `backend/handler.js`, `backend/local-server.js`, and `scripts/deploy.sh`.
**Rationale:** An unchanged `/search` shape means the frontend works without edits. Overwriting an existing `id` serves re-embedding: after a model change, re-ingesting through the same endpoint updates every vector. 400 versus 422 separates a malformed request from a well-formed one whose image can't be used.
**Tradeoff:** A wrong `id` silently replaces a record. Once ownership exists, overwrite must check the owner first.
**Rejected:** A new `/search` response shape (it breaks the frontend). Create-only ingest that returns 409 on an existing `id`. It is just as re-runnable, since the script can treat 409 as already ingested, but re-embedding after a model change would then need a separate update path.
**AI vs. me:** Proposed by the review agent in the planning session. The drafting agent flagged the original Rejected line as weak, the review agent corrected the rationale to re-embedding, and I approved it.

## 7. One ingest path: a bulk script over POST /images

**Decision:** The Unsplash images are loaded by a script that calls `POST /images` for each item in `data/sample_images.json`. There is no separate direct-to-database seed for real data.
**Rationale:** One path means one place where embeddings are made, and the bulk load exercises exactly the code the demo uses.
**Tradeoff:** Bulk load is slower than a direct batch write, because every image goes through download, embed, and write over HTTP.
**Rejected:** A direct-to-DynamoDB seed with precomputed embeddings. That is a second ingest path, and vectors could come from different code than the query side.
**AI vs. me:** Proposed by the review agent in the planning session; I accepted it.

## 8. Out-of-scope features go to the Backlog; scale items stay in the Scale plan

**Decision:** Don't build delete, ownership filtering, pagination, or hybrid keyword + semantic search in the core. They go in the roadmap's Backlog, and the data model is shaped so each one is a small change. The scale items — ANN index, async ingest, separate embedding service, a bulk re-embedding pipeline (reprocessing every stored original in the background after a model change) — are reasoned about in the spec's Scale plan and never built.
**Rationale:** The assignment asks for one ingest path and one read path, and the live session will add requirements. Backlog items are small, pre-planned changes that can be pulled in if the core lands early or requested live. Scale items only matter at a size this build will never reach, so reasoning about them is the honest deliverable.
**Tradeoff:** The thin slice has no way to remove or scope images, and no keyword fallback. Nothing in the scale plan is proven by running code.
**Rejected:** Building any of them up front. It spends core build time on things the panel may not ask for.
**AI vs. me:** The "deferred to the live session" framing came from the planning-session prompt. I caught it as presumptuous, since I don't know what the panel will ask, and overrode it with a ranked backlog. The Backlog-versus-Scale-plan split and Group-scoped search came from the review agent, after I asked whether the cache could become an AWS service at scale.

## 9. Embed the raw query; test a prompt template against the demo set

**Decision:** Search embeds the query exactly as typed. Once real data is loaded, `"a photo of " + query` is tried against the fixed demo queries, and kept only if it visibly improves the top results. The outcome is recorded here.
**Rationale:** The raw query is the simplest thing that works, with nothing to explain. CLIP was trained on captions, and prompt templates are reported to help short queries, so it's worth testing, but only against evidence.
**Tradeoff:** If the template helps, the first runs rank short queries slightly worse until it's adopted.
**Rejected:** Adopting the template from the start (an assumption, not evidence).
**AI vs. me:** The drafting agent proposed raw-first with the template tested against the demo set; I accepted it.
**Outcome (ticket 7):** The template was better on 1 of 15 queries, worse on 2 (it dropped the only relevant image for one), and tied on 12, judged by viewing the images. Queries stay raw. Details in `docs/demo-queries.md`.

## 10. Embed before storing in ingest (refines #5)

**Decision:** Ingest is still synchronous (#5), but the order is download → decode and embed → S3 → DynamoDB → respond. The S3 key is derived from the id: `originals/{id}`.
**Rationale:** Decoding and embedding first means an image that can't be used (a 422) leaves nothing behind in S3. Because the key comes from the id, a retry after a failed DynamoDB write overwrites the same object instead of orphaning a second one.
**Tradeoff:** One gap remains. When the caller sends no id, the server generates one, so a retry creates a new key and orphans the first object. That's accepted for this build, because the bulk script always sends Unsplash's id. At scale, a cleanup sweep finds S3 objects with no matching record.
**Rejected:** #5's original order (download → S3 → embed), which orphans an S3 object on every decode failure.
**AI vs. me:** The drafting agent proposed embedding before storing. The review agent added the id-based key condition, the no-id orphan gap, and the cleanup sweep. I approved it.

## 11. Store the embedding as a DynamoDB list of numbers

**Decision:** `embedding` is stored as a DynamoDB list of 512 numbers, about 6KB per record.
**Rationale:** It's readable in `awslocal dynamodb scan` output, which matters for debugging during the live session, and it matches #2 as written. The paginated Scan absorbs the extra size.
**Tradeoff:** About 3× larger than binary, so more Scan pages and more read capacity per cache load. At scale, vectors move to a vector store at about 2KB each (512 × 4-byte float32). Binary float32 is the at-scale encoding, and it's what the Scale plan's math uses.
**Rejected:** A 2KB binary float32 blob now: compact, but opaque when inspecting data live.
**AI vs. me:** The drafting agent proposed the list over binary. The review agent set the 6KB-versus-2KB sizing so the spec stays consistent. I approved it.

## 12. No minimum relevance score on search

**Decision:** `POST /search` always returns the top `limit` results with their scores, however weak. An optional `minScore` request field goes in the Backlog.
**Rationale:** CLIP scores fall in a narrow band, so any cutoff needs calibration on real data we don't have yet. Ranking is relative: the system knows which image is closest, not whether closest is good enough. Scores are returned, and the kit's frontend already shows them.
**Tradeoff:** A query with no relevant images still returns a full page of weak matches, and a user can't tell what a score like 0.21 means.
**Rejected:** A fixed minimum score (untuned, risks empty results for good queries). A cutoff relative to the top score (still a tuning problem). Building `minScore` now (new scope).
**AI vs. me:** The drafting agent proposed no threshold. I questioned what users would actually see, the drafting agent then offered an optional `minScore`, and I chose no threshold with `minScore` in the Backlog.

## 13. Reject an invalid search limit with 400

**Decision:** A `limit` that isn't a positive integer returns 400. Values above 50 are still silently capped at 50 (#6).
**Rationale:** The cap is a policy, but a nonsense value is a client bug, so the client should be told.
**Tradeoff:** Slightly stricter than the kit, which accepted any value.
**Rejected:** Silently falling back to 12 (forgiving, but it hides bugs).
**AI vs. me:** Proposed by the drafting agent; I accepted it.

## 14. Download safeguards on ingest; SSRF is a known gap

**Decision:** Ingest downloads have a timeout and a size limit, and exceeding either returns 422. The server fetching internal addresses (SSRF) is documented as a known gap, not fixed.
**Rationale:** A timeout and size limit are a few lines of code and stop a slow or huge URL from hanging the demo. The real SSRF fix is to stop accepting URLs and have clients upload directly to S3 with presigned URLs, which is the same change as async ingest in the Scale plan.
**Tradeoff:** In this build, `POST /images` will fetch any address the server can reach, including internal ones.
**Rejected:** An address blocklist now (easy to get wrong, and it's replaced by presigned uploads anyway).
**AI vs. me:** Proposed by the drafting agent; I accepted it.

## 15. Scale plan: S3 Vectors with one index per Group

**Decision:** At scale, vectors live in Amazon S3 Vectors with one index per Group. Access to a Group decides which index a user can query, and search runs S3 Vectors' built-in ANN inside that one index. OpenSearch with k-NN is the upgrade path if hybrid search or very low latency becomes a requirement. Reasoned about in the spec only, never built.
**Rationale:** Users search their own Groups, so each search covers about 5,000 vectors, not 14B, and the Group boundary is also the permission boundary. At that size, S3 Vectors' latency (stated as about 100ms for frequent queries, sub-second for infrequent ones) is fine, and storage cost dominates, which favours S3 Vectors.
**Tradeoff:** The default limit is 10,000 indexes per vector bucket, so many Groups means spreading indexes across buckets or requesting a higher limit. Hybrid search would need a separate keyword index. Searching across all of a user's Groups means querying many indexes.
**Rejected:** One shared index with a Group metadata filter (a highly selective filter reduces recall and can return fewer than `limit` results). OpenSearch as the primary store (fast, with native hybrid search, but the highest cost at about 28TB). Listing options without a recommendation. An exact search over each Group's vectors (about 10MB) is noted as a cheaper alternative for small Groups.
**AI vs. me:** The drafting agent first recommended S3 Vectors with a Group metadata filter. When I asked whether a Group-sized search could have noticeable latency, the drafting agent checked AWS's docs and found the real risk is recall, not latency: a metadata filter doesn't shrink the search. The drafting agent then proposed partitioning by Group. I asked for clarification until the design was clear, and confirmed one index per Group, with the bucket limit noted.

## 16. Hybrid search, if built, merges rankings with reciprocal rank fusion

**Decision:** Hybrid search (Backlog) would merge the keyword ranking and the CLIP ranking by rank position (reciprocal rank fusion), because keyword and CLIP scores aren't comparable. Rejected: a tuned weighted sum of raw scores. AI vs. me: The drafting agent proposed reciprocal rank fusion; I accepted it after asking for a plain explanation.

## 17. Cache loading: a separate loaded flag and one shared Scan (refines #4)

**Decision:** The cache has a separate `loaded` flag, set only after a full paginated Scan completes, and it decides whether a search waits for the load. Concurrent searches during the first load share one in-flight Scan (a single promise), not one each. Ingest always adds to the cache. The Scan only adds records the cache doesn't already have, so it never overwrites a newer copy.
**Rationale:** Treating a non-empty cache as loaded is a bug: an ingest before the first search would put one record in the cache, and search would then skip the Scan and return only that record. Skipping the cache on ingest until `loaded` is also a bug: a Scan that has already read past the new record's position never returns it, so an image ingested mid-Scan would be missing until restart. Always adding on ingest, with the Scan adding only what's absent, keeps every ingested image and never lets an older Scan copy replace a re-ingested one. One shared Scan stops a burst of first searches from each scanning the whole table.
**Tradeoff:** The first search waits for the full Scan. The load logic is a small state machine rather than a lazy fill. Delete (Backlog) has the reverse race and will need to track recent deletes until the load finishes.
**Rejected:** Using a non-empty cache as the loaded signal (the partial-cache bug). Adding to the cache on ingest only once loaded (drops images ingested mid-Scan). One Scan per concurrent search (redundant reads, and racing fills).
**AI vs. me:** The review agent found the partial-cache bug. The drafting agent found that the first fix could drop an image ingested mid-Scan and proposed the merge rule. I approved both.

## 18. Core ticket order: pure logic, then the riskiest unit, then real data

**Decision:** Vector math comes first, then the embedder, then ingest with the shared error boundary, then semantic search (the walking skeleton), then the bulk loader. Validation and download safeguards follow and are firmly core. The Lambda deploy is last, time-boxed to 15 minutes, and the first cut.
**Rationale:** The embedder's acceptance check needs `normalize` and `dot`, and pure logic lands quickly test-first, so the riskiest unit (native dependencies, the model download, image decoding) still fails early if it's going to. The error boundary ships with ingest because Express 4 hangs on async errors and ingest is where debugging starts. The bulk loader comes before validation and safeguards so the demo runs on real data first. Decision 1 already makes the Lambda path best-effort.
**Tradeoff:** Until tickets 8 and 9 land, the API accepts malformed input and unfetchable URLs without the spec's 400 and 422 responses. Both are still core, because the spec's API and decision 10 commit to that behavior.
**Rejected:** The embedder before the vector math (its acceptance check needs `normalize` and `dot`). Validation and safeguards before real data (a stricter API sooner, but a weaker early demo). The error boundary in the validation ticket (too late: debugging starts at ingest).
**AI vs. me:** The drafting agent proposed the order with the embedder first and validation as cuttable. I reordered vector math before the embedder, moved the error boundary into the ingest ticket, and made validation and the download safeguards firmly core.

## 19. Run CLIP at full precision (fp32)

**Decision:** Both CLIP encoders load with `dtype: "fp32"`, set explicitly rather than left to the library's default.
**Rationale:** Full precision gives the reference CLIP vectors, so ranking quality isn't affected by quantization. Setting it explicitly pins the vectors: a library upgrade that changed the default would otherwise silently change every new embedding while `embeddingModel` stayed the same. The cost is a one-off download, measured at 595MB and 15.4s cold, then 0.5s from cache.
**Tradeoff:** About four times the download and memory of the 8-bit quantized weights, and slower inference. If the dtype ever changes, every stored image must be re-ingested, just as for a model change.
**Rejected:** The 8-bit quantized weights (`q8`): smaller and faster, but slightly lower fidelity, and the size saving doesn't matter on the local demo path.
**AI vs. me:** Proposed by the drafting agent during ticket 3. I asked for a plain explanation and confirmed it doesn't affect Lambda's size limit, then accepted it.

## 20. Keep the Unsplash sample out of git

**Decision:** `make dataset` writes the 400-image sample to `data/unsplash_sample.json`, which is git-ignored, and `make ingest` reads it from there. The tracked `data/sample_images.json` keeps the kit's 44 placeholders.
**Rationale:** The Unsplash Lite terms forbid disclosing, publishing, or redistributing "any portion of the Licensed Data". The sample holds Unsplash's photo ids, URLs, descriptions, and keywords, so committing it and pushing would publish part of the dataset.
**Tradeoff:** A reviewer has to download Unsplash Lite and run `make dataset` themselves to reproduce the 400-image demo.
**Rejected:** Keeping the kit's output path and never committing the change (one `git add -A` publishes it).
**AI vs. me:** The drafting agent found the terms while preparing to generate the data and proposed the separate git-ignored file; I accepted it.

## 21. Restrict ids to a safe key format; malformed JSON is a 400

**Decision:** An ingest `id` must be 1–128 letters, digits, `-` or `_`. A request body that isn't valid JSON returns `400 { "error": "request body must be valid JSON" }` from both the Lambda handler and the Express server.
**Rationale:** The id is both the DynamoDB key and part of the S3 key `originals/{id}`, so a `/` or `..` would create nested or confusing keys. Unsplash ids and UUIDs fit the pattern. Before this, Express answered malformed JSON with an HTML error page, and the Lambda handler silently treated it as an empty body, which surfaced as a misleading "query is required".
**Tradeoff:** A caller with ids in another format (e.g. containing `.` or `/`) must map them first.
**Rejected:** Accepting any string id (odd S3 keys). Encoding the id into the S3 key (more to explain, for no current need).
**AI vs. me:** Proposed by the drafting agent during ticket 8; I accepted it.
