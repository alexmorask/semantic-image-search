# Decisions

The running fork-by-fork log, kept in the format of the **recording-decisions**
skill. Entries are never renumbered. A reversal gets a new entry that supersedes
the old one.

Decisions 1–8 were worked out in a planning session with Claude before the
build started, and I made each call.

## 1. CLIP via transformers.js in Node for all embeddings

**Decision:** Embed with CLIP (`Xenova/clip-vit-base-patch32`) through `@huggingface/transformers`, running in the Node backend. The same code embeds images at ingest and query text at search. The model loads once and is reused. The kit's Python embedding script is not used.
**Rationale:** CLIP puts images and text in one vector space, so a text query can be compared directly to the image itself, not to a caption. One code path for both sides guarantees the vectors are comparable. Running in-process means no API keys, no cost, and no network dependency during the live demo.
**Tradeoff:** A large first-load model download, and risky Lambda packaging (native binaries, architecture mismatch). That is why the local Express server is the demo path and the Lambda deploy is best-effort.
**Rejected:** A hosted multimodal embedding API (signup, cost, and a network dependency during the live demo). A separate Python embedding service (an extra moving part for little gain at this size).
**AI vs. me:** Claude (in the planning session) recommended transformers.js over a hosted API or a Python service. I accepted it for a first pass.

## 2. One DynamoDB table for records and vectors, with original bytes in S3

**Decision:** One DynamoDB table `images`, partition key `id`, with fields `id`, `url`, `description`, `keywords`, `s3Key`, `embedding` (512 normalized numbers), `embeddingModel`, and `createdAt`. The original image bytes are stored in the S3 bucket `images`.
**Rationale:** Each image is one independent record, so ingests don't contend and an overwrite by `id` is atomic. Keeping the original bytes means everything can be re-embedded if the model changes, and `embeddingModel` says which model produced each vector.
**Tradeoff:** Search has to read every vector out of DynamoDB (a paginated Scan) to build the in-memory cache. Item size grows with the vector.
**Rejected:** All vectors in a single S3 file. Every ingest rewrites the whole file, and concurrent ingests overwrite each other.
**AI vs. me:** Proposed by Claude in the planning session; I accepted it.

## 3. Normalize vectors at ingest; similarity is a dot product

**Decision:** Vectors are scaled to length 1 before they are stored, and query vectors are normalized the same way, so cosine similarity is a plain dot product. Normalize and similarity are small, pure, unit-tested functions.
**Rationale:** Normalization is paid once per image at write time instead of on every comparison at search time. Pure functions are trivial to test with `node --test` and to explain.
**Tradeoff:** Stored vectors lose their original magnitude. CLIP similarity doesn't use it, but a different model might.
**Rejected:** A vector math package (a dependency for a few lines of arithmetic). Storing raw vectors and normalizing on read: keeps original magnitudes, but redoes the work on every cache load.
**AI vs. me:** Proposed by Claude in the planning session; I accepted it.

## 4. Brute-force search over an in-memory cache

**Decision:** Compare the query against every stored vector, held in memory after the first load, and return the top results by score.
**Rationale:** At a few hundred images, brute force is exact, fast, and has no moving parts. The kit's README calls it fine at this size.
**Tradeoff:** Linear in the number of images, and each process holds its own copy of every vector. It doesn't scale to millions, and multiple instances drift apart.
**Rejected:** An ANN vector index now. It is the scale plan, not this build.
**AI vs. me:** Proposed by Claude in the planning session; I accepted it.

## 5. Synchronous ingest

**Decision:** `POST /images` downloads the image, stores it in S3, embeds it, and writes the record before responding.
**Rationale:** One request, one visible result. It is simple to reason about, to demo, and to verify. The caller knows the image is searchable when it gets a 201.
**Tradeoff:** Ingest latency includes download and embedding, and throughput is bounded by the API process. The scale plan moves this to S3 upload → queue → embedding workers.
**Rejected:** An async queue-and-worker pipeline now. It adds moving parts the thin slice doesn't need.
**AI vs. me:** Proposed by Claude in the planning session; I accepted it.

## 6. API: keep /search's shape, add an idempotent POST /images

**Decision:** `POST /search` keeps the kit's request/response shape. Empty query → 400, and `limit` defaults to 12, capped at 50. `POST /images` takes `{ url, id?, description?, keywords? }` and returns 201 `{ id, url, description, embeddingModel, createdAt }`. Missing or invalid URL → 400. Image can't be fetched or decoded → 422. An existing `id` is overwritten. `GET /health` is unchanged. New routes are registered in `backend/handler.js`, `backend/local-server.js`, and `scripts/deploy.sh`.
**Rationale:** An unchanged `/search` shape means the frontend works without edits. Overwriting an existing `id` serves re-embedding: after a model change, re-ingesting through the same endpoint updates every vector. 400 versus 422 separates a malformed request from a well-formed one whose image can't be used.
**Tradeoff:** A wrong `id` silently replaces a record. Once ownership exists, overwrite must check the owner first.
**Rejected:** A new `/search` response shape (it breaks the frontend). Create-only ingest that returns 409 on an existing `id`. It is just as re-runnable, since the script can treat 409 as already ingested, but re-embedding after a model change would then need a separate update path.
**AI vs. me:** Proposed by Claude in the planning session; I accepted it.

## 7. One ingest path: a bulk script over POST /images

**Decision:** The Unsplash images are loaded by a script that calls `POST /images` for each item in `data/sample_images.json`. There is no separate direct-to-database seed for real data.
**Rationale:** One path means one place where embeddings are made, and the bulk load exercises exactly the code the demo uses.
**Tradeoff:** Bulk load is slower than a direct batch write, because every image goes through download, embed, and write over HTTP.
**Rejected:** A direct-to-DynamoDB seed with precomputed embeddings. That is a second ingest path, and vectors could come from different code than the query side.
**AI vs. me:** Proposed by Claude in the planning session; I accepted it.

## 8. Out-of-scope features go to the Backlog; scale items stay in the Scale plan

**Decision:** Don't build delete, ownership filtering, pagination, or hybrid keyword + semantic search in the core. They go in the roadmap's Backlog, and the data model is shaped so each one is a small change. The scale items — ANN index, async ingest, separate embedding service, a bulk re-embedding pipeline (reprocessing every stored original in the background after a model change) — are reasoned about in the spec's Scale plan and never built.
**Rationale:** The assignment asks for one ingest path and one read path, and the live session will add requirements. Backlog items are small, pre-planned changes that can be pulled in if the core lands early or requested live. Scale items only matter at a size this build will never reach, so reasoning about them is the honest deliverable.
**Tradeoff:** The thin slice has no way to remove or scope images, and no keyword fallback. Nothing in the scale plan is proven by running code.
**Rejected:** Building any of them up front. It spends core build time on things the panel may not ask for.
**AI vs. me:** Claude Code's first draft framed these features as "deferred to the live session". I overrode that as presumptuous, since I don't know what the panel will ask, and asked for a gateway-kit-style ranked backlog. The Backlog-versus-Scale-plan split and Group-scoped search came from my planning session with Claude, after I asked whether the cache could become an AWS service at scale.
