# Semantic Image Search

Natural-language image search: type "man's best friend" and get dogs, ranked by meaning rather than keyword
overlap. Built for the Photobucket Technical Build Round on the provided starter kit.

## What was built

Images and queries are embedded by **CLIP** (`Xenova/clip-vit-base-patch32`, run in Node with transformers.js)
into the same 512-number space. Ingest embeds the image itself, not its caption, and stores the record in
DynamoDB and the original in S3. Search embeds the query and ranks every stored vector by dot product
(cosine similarity) from an in-memory cache. There is **one ingest path** (`POST /images`, also used by the bulk
loader) and **one read path** (`POST /search`), plus delete and an optional score cutoff from the backlog.
The same handler also runs on LocalStack **Lambda**, which has no model and calls a separate embedding service.

- Design: [`spec/SPEC.md`](spec/SPEC.md)
- Every decision and its tradeoffs: [`docs/decisions.md`](docs/decisions.md)
- Demo queries and what to say: [`docs/demo-queries.md`](docs/demo-queries.md)
- Build plan and status: [`docs/roadmap.md`](docs/roadmap.md)

```
Local path (default)                         Serverless path (optional)
browser :5173                                browser :5173 ─▶ Vite proxy (/api)
   │                                            │
   ▼                                            ▼
Express :3001 ── CLIP in-process             Lambda (Function URL, 12KB zip) ──▶ embedding service :3002 (CLIP)
   │                                            │
   └──────▶ DynamoDB `images` + S3 `images` on LocalStack ◀──┘
```

## Prerequisites

- Docker (LocalStack, and the Lambda runtime containers it starts)
- Node 20.9 or newer (the image decoder, `sharp`, requires it; developed on Node 24, and the Lambda runs Node 20)
- AWS CLI, only for `make deploy`
- Python 3, only for `make dataset`
- macOS on Apple Silicon or Linux; on Windows, use WSL (the Makefile and `deploy.sh` need `make` and `bash`).
  Intel Macs are likely unsupported: `onnxruntime-node` 1.30 ships no Intel Mac binary (untested).
- The first run needs internet: about 600MB of model weights from Hugging Face, and the Unsplash image URLs at ingest.

## Run it

```
make install     # backend and frontend dependencies
make up          # start LocalStack
make seed        # create the DynamoDB table and S3 bucket (no data)
make warm        # download CLIP once (~600MB, about 15s), cached afterwards
make api         # terminal 1: local API on :3001
make web         # terminal 2: React app on http://localhost:5173
```

Load the 400-image Unsplash sample. Download Unsplash Lite from https://unsplash.com/data/lite/latest and
unzip `photos.tsv000` and `keywords.tsv000` into `./unsplash-lite`, then:

```
make dataset     # samples 400 images (fixed seed) into data/unsplash_sample.json, which is git-ignored
make ingest      # with make api running: POST /images for each one (about 30-60s)
```

The sample is never committed: the Unsplash Lite terms forbid publishing any portion of the dataset.

### Serverless path (optional)

The same handler on LocalStack Lambda. The model can't fit in a Lambda, so it runs in a separate embedding service:

```
make embed                                  # terminal 3: embedding service on :3002
make deploy                                 # 12KB Lambda behind a Function URL; prints the URL
make web-lambda LAMBDA_URL=<printed url>    # frontend through a same-origin proxy to the Lambda
```

Every `make deploy` prints a new URL; rerun `make web-lambda` with it. To see the boundary, stop the embedding
service: searches through the Lambda fail with 500 while the local API keeps working.

## API

Errors are `{ "error": "<message>" }`. Full shapes are in the [spec](spec/SPEC.md#api).

```bash
curl localhost:3001/health                                     # 200 {"ok":true}

curl -X POST localhost:3001/search -H 'content-type: application/json' \
  -d '{"query":"a dog","limit":5}'                             # 200 {query, count, results:[{id,url,description,score}]}
                                                               # optional "minScore": 0.26 drops weaker matches

curl -X POST localhost:3001/images -H 'content-type: application/json' \
  -d '{"url":"https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400","id":"beagle","description":"a beagle"}'
                                                               # 201; 400 bad input; 422 unfetchable or not an image

curl -X DELETE localhost:3001/images/beagle                    # 204; 404 unknown id; 400 bad id
```

## Scope

**Built:** CLIP image and text embedding; ingest with a 10s / 10MB download cap; brute-force search over a
paginated, race-safe in-memory cache; request validation; the bulk loader; `minScore`; delete; and the Lambda
path with a separate embedding service.

**Deliberately deferred:** ownership filtering, pagination, and hybrid keyword + semantic search (see the
spec's [Out of scope](spec/SPEC.md#out-of-scope)), and everything in the [Scale plan](spec/SPEC.md#scale-plan):
S3 Vectors with one index per Group, async ingest, a GPU embedding service, and bulk re-embedding.

**Known gaps, by design for a local build:** there is no authentication, so anyone who can reach the API can
ingest or delete; ingest fetches any URL the server can reach (SSRF), which presigned uploads would fix; and
CLIP is weak at negation ("a beach with no people"), counting, and reading text in images.

## Tests

```
make test          # 42 unit tests, under a second, no model needed
make test-model    # 4 checks against the real CLIP model (needs make warm)
```

**Unit tests (pure logic):** vector math and ranking; request validation; the search cache's load, merge, and
delete rules, including the races where an image is ingested or deleted while the cache is still loading (each
race was confirmed by breaking the code and watching the test fail); and the remote embedder's error handling,
against a real local HTTP server.

**Model check:** vectors are normalized 512-number arrays, a generated red or blue square scores higher against
its own colour, and non-images are rejected.

**Verified by running, not by tests:** DynamoDB and S3 writes, Scan pagination (three pages for 400 images),
every HTTP status, the bulk load, the Lambda path, and the frontend. See `docs/roadmap.md` and the commit
history for the evidence.

## Layout

```
backend/   handler.js (routes), local-server.js (Express), embedding-server.js (embedding service)
           lib/  ingest, search, delete-image, validation, vector-cache, image-cache, vectors, download
           lib/embedding/  index (switch), local (CLIP here), remote (calls the service), model
frontend/  Vite React app (search box + results grid)
scripts/   seed.js, ingest.js, warm-model.js, deploy.sh, fetch_unsplash.py
spec/      SPEC.md
docs/      decisions.md, roadmap.md, demo-queries.md
data/      sample_images.json (the kit's 44 placeholders), README
```
