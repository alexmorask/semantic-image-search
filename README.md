# Technical Build Round — Starter Kit

A scaffold for the Technical Build Round. The infrastructure plumbing is done for you so your time goes to the design and the build, not to wiring LocalStack.

**You get a product concept, not a design.** Your job is to turn it into a technical design (a short spec) and a thin, working implementation, then iterate on it live with the panel.

## The concept
Build a semantic image search that uses AI/LLMs to find and curate images. A user types a natural-language query ("golden retriever on a beach at sunset") and gets back the most relevant images, ranked.

## What's provided (so you don't rebuild plumbing)
- LocalStack via docker-compose (DynamoDB, S3, Lambda, API Gateway).
- A backend handler with a working `/health` and `/search`. `/search` ships with a **naive keyword match** so the whole path runs out of the box with no API keys.
- A local API server (Express) that runs the same handler for a fast dev loop, plus a `deploy` script that pushes the handler to LocalStack Lambda behind an HTTP API.
- A React app with a search box and a results grid, wired to the API.
- Sample data that loads into DynamoDB, plus scripts to pull the real dataset and to generate embeddings.

## What you build
Replace the naive search with real semantic search, and make the design your own:
- Design the data model and the retrieval approach (write it up in `spec/SPEC.md`).
- Embed the query, score it against the image embeddings, and return the top matches. The `TODO(candidate)` in `backend/handler.js` marks the spot.
- Keep it thin. One ingest path and one read path is enough.

## Prerequisites
- Docker and Docker Compose
- Node 18+
- AWS CLI or `awslocal` (only needed for `make deploy`)
- Python 3 (only for the dataset and embedding scripts)

## Quickstart
```
make install     # install backend and frontend dependencies
make up          # start LocalStack
make seed        # create the table + bucket (no data; images load through POST /images)
make api         # terminal 1: local API on :3001
make web         # terminal 2: React app on :5173
make test        # backend unit tests (node --test)
```

Optional, for real semantic results:
```
make dataset     # pull + sample Unsplash Lite into data/sample_images.json
make embeddings  # generate data/embeddings.json
```
Deploy to LocalStack Lambda + API Gateway (serverless path):
```
make deploy      # prints the HTTP API id; point VITE_API_BASE at it
```

## Layout
```
backend/     handler.js (the TODO lives here), local-server.js, lib/
frontend/    Vite React app (search box + grid)
scripts/     seed.js, deploy.sh, fetch_unsplash.py, generate_embeddings.py
data/        sample_images.json, data README (schema + dataset notes)
spec/        SPEC_TEMPLATE.md  (copy to SPEC.md and fill in)
```

## Notes
- The sample images are placeholder photos for smoke-testing the pipeline; their captions are not semantically accurate. Run `make dataset` for the real Unsplash Lite set with real keywords.
- LocalStack serves the AWS infra; call a real embedding model or API for the vectors (LocalStack does not serve embeddings). Brute-force cosine over a few hundred vectors in the handler is fine. A real vector database is not required.
- The `deploy` path's invoke URL format can vary by LocalStack version; the local API server is the reliable default for iterating.
