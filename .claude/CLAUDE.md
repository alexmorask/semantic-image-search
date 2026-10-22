# Semantic Image Search — Photobucket take-home

A Staff Engineer take-home: semantic image search where a natural-language query
("golden retriever on a beach at sunset") returns relevant images, ranked. Built
on the Photobucket starter kit (committed unmodified as the first commit).

This file is the always-on convention layer. The slash commands below drive the
process; the conventions here hold in every phase, on every change.

## The assignment

A 2–3 hour build with three deliverables:

1. **`spec/SPEC.md`**: a 1–2 page spec following `spec/SPEC_TEMPLATE.md`.
2. **A thin, working implementation** of real semantic search: one ingest path,
   one read path. AWS components run on LocalStack; vectors come from a real
   embedding model.
3. **AI notes**: where AI helped and where I overrode its decisions (the spec's
   `AI notes` section, fed by `docs/decisions.md`).

It is followed by a 60-minute live session: a 10 min demo, then 40 min where the
panel adds requirements and I extend the solution live, then 10 min of questions.
**I must be able to explain, defend, and modify everything.** Prefer code that is
obvious over code that is clever. Every unit should be explainable out loud in a
sentence.

## How we work

The build moves through deliberate phases, each its own command. Every command
ends at a **human checkpoint**: I sign off before the next phase begins.

| Command | Does | Reads | Writes |
| --- | --- | --- | --- |
| `/write-spec` | Fill the spec from the settled decisions | `docs/decisions.md`, template | `spec/SPEC.md` |
| `/plan-tickets` | Ordered ticket board, walking skeleton first | `spec/SPEC.md`, `docs/decisions.md` | `docs/roadmap.md` |
| `/implement-ticket` | Build one ticket to done | `docs/roadmap.md` | code, docs, decisions |
| `/extend` | Live-session fast path: one new requirement, end to end | the request | code, one-line decision |
| `/finalize` | Verify run steps, write README, complete AI notes | everything | `README.md`, `spec/SPEC.md` |

`/implement-ticket` repeats, one ticket per run, until the core board is done or
the time box is reached. Then `/finalize` closes out the build. `/extend` is for
the live session only. It skips the spec/roadmap ceremony on purpose.

Do not skip ahead or run the next command automatically. Each command stops and
hands back.

## Time box

The build is 2–3 hours. **The last 20 minutes are protected** for finishing
`spec/SPEC.md` (including AI notes), the README, and a full end-to-end
verification via `/finalize`. If a ticket would eat into that window, stop and
say so. Don't start it. An unfinished ticket that is documented honestly beats a
finished one with no spec.

## Stack

- **Plain JavaScript (CommonJS) on Node.** No TypeScript, no build step, no
  transpiler. Match the kit's existing style (`require`, `module.exports`).
- **Backend:** `backend/handler.js` exposes `route(method, path, body)`. The
  Express server in `backend/local-server.js` and the Lambda `handler` both call
  that same `route`, so there is one implementation and two entry points.
- **The local Express server is the primary dev and demo path** (`make api` on
  :3001), with CLIP in-process. The Lambda path (`make deploy`) is secondary: the
  Lambda has no model and calls the embedding service (`make embed` on :3002)
  over HTTP (decision 24).
- **Storage:** DynamoDB table `images` and S3 bucket `images` on LocalStack
  (`make up`, endpoint `http://localhost:4566`, credentials `test`/`test`).
- **Frontend:** the kit's React/Vite app (`make web` on :5173). It calls
  `POST /search` and must keep working unchanged.
- **Embeddings:** CLIP `Xenova/clip-vit-base-patch32` via
  `@huggingface/transformers` (transformers.js), running in Node.
- **Data:** the committed `data/sample_images.json` holds 44 picsum placeholders
  whose captions don't match their images. The real 400-image Unsplash sample
  comes from `make dataset` (`scripts/fetch_unsplash.py`, `SAMPLE_N=400`), which
  writes the git-ignored `data/unsplash_sample.json` (decision 20); `make ingest`
  loads it. Never commit it.

## Settled decisions (constraints, not suggestions)

These are recorded in full in `docs/decisions.md`. Treat them as fixed. Changing
one is a reversal, and it gets recorded as a new decision that supersedes the old.

1. **Embedding model:** CLIP via transformers.js in Node. The same code embeds
   images at ingest and query text at search. The model loads once and is
   reused. No hosted API and no Python embedding service.
2. **Data model:** one DynamoDB table `images`, partition key `id`. Fields:
   `id`, `url`, `description`, `keywords`, `s3Key`, `embedding` (512 numbers,
   normalized), `embeddingModel`, `createdAt`. Original image bytes go to the S3
   bucket `images` so everything can be re-embedded.
3. **Normalize at ingest:** stored vectors have length 1, so similarity is a
   plain dot product. These are small, pure, unit-tested functions with no
   package.
4. **Search:** brute-force dot product against every stored vector, held in
   memory after the first load. ANN is the scale plan, not this build.
5. **Ingest is synchronous:** download → decode and embed → S3 → DynamoDB →
   respond, so a 422 leaves nothing behind (refined by decision 10).
6. **API:**
   - `POST /search` keeps the kit's request/response shape
     (`{ query, limit }` → `{ query, count, results: [{ id, url, description, score }] }`).
     Empty query → 400. `limit` defaults to 12, capped at 50.
   - `POST /images` is the ingest endpoint: `{ url, id?, description?, keywords? }` →
     201 `{ id, url, description, embeddingModel, createdAt }`. Missing or invalid
     URL → 400. Image can't be fetched or decoded → 422. An existing `id` is
     overwritten, which makes re-embedding after a model change a re-ingest
     through the same endpoint. Ingest is also idempotent as a result.
   - `GET /health` is unchanged.
7. **One ingest path:** a bulk script calls `POST /images` for each item in
   `data/sample_images.json`. There is no direct-to-database seed for real data.
8. **Out of scope, split two ways:** the buildable out-of-scope features
   (delete, ownership filtering, pagination, hybrid keyword + semantic search)
   go in the roadmap's Backlog, and the data model must keep each one a small
   change. The scale items — ANN index, async ingest, separate embedding
   service, a bulk re-embedding pipeline (reprocessing every stored original in
   the background after a model change) — are reasoned about in the spec's
   Scale plan and never built.

### Improvement options (tracked, not built)

There are two kinds, and they are handled differently:

- **Backlog (buildable):** delete, ownership/permissions filtering, pagination,
  hybrid keyword + semantic search. These are out of scope for the core build
  and ranked in the Backlog section of `docs/roadmap.md`. If the core board
  lands early, they are pulled top-down via `/implement-ticket`.
- **Scale plan only (never built):** an ANN vector index, async ingest (S3
  upload → queue → embedding workers), a separate embedding service,
  a bulk re-embedding pipeline (reprocessing every stored original in the
  background after a model change), per-instance cache drift, and
  Group-scoped search. These are reasoned about in the spec's Scale plan. They never become
  tickets or backlog items.

## Known pitfalls

- **Scan pagination.** The kit's `loadItems()` makes a single `ScanCommand` call
  with no pagination. A Scan returns at most 1MB per call, and 400 items with
  512-number vectors exceed that, so results would be **silently truncated**.
  The real loader must page through `LastEvaluatedKey` until it is absent.
- **Cache freshness.** The in-memory vector cache must include images ingested
  after it was loaded, so update it on ingest. "Loaded" is a separate flag, set
  only after a full paginated Scan completes, and it decides whether a search
  waits for the load. A non-empty cache does not mean loaded. Ingest always
  adds to the cache. The Scan only adds records the cache doesn't already have,
  so it never overwrites a newer copy, and an image ingested mid-Scan is never
  dropped. Concurrent searches during the first load share one in-flight Scan
  (a single promise), not one each (decision 17). Delete has the reverse race:
  a Scan page read before the delete could re-add the image, so delete must
  track recent deletes until the load finishes. With multiple Lambda instances,
  each instance holds its own cache and they drift. That is one reason the scale
  plan uses a real vector store.
- **Same model, same code.** Image vectors and query vectors must always come
  from the same model through the same code path. Store `embeddingModel` on
  every record. Never compare vectors across models.
- **Routes live in two places.** A new route must be registered in
  `backend/handler.js` (`route`) **and** `backend/local-server.js` (Express).
  The Lambda's Function URL sends every path to the handler, so `deploy.sh` has
  no per-route list.
- **Express 4 swallows async errors.** An async route handler that throws
  leaves the request hanging, not failing. One shared error boundary around
  `route` turns any unexpected error into `500 { "error": "internal error" }`
  and logs the real error, for both the Express server and the Lambda handler.
- **The kit's seed writes data directly.** `make seed` (`scripts/seed.js`)
  creates the table and bucket, then batch-writes `sample_images.json` straight
  into DynamoDB with no embeddings. That conflicts with decision 7. Table and
  bucket creation stays; the data load goes through `POST /images`.
- **Cold model load.** The first CLIP load downloads the model weights. Warm the
  cache before any demo, and never demo a cold first load.
- **Platform support.** `onnxruntime-node` 1.30 bundles binaries for macOS
  arm64, Linux and Windows, but appears to have none for Intel Macs (untested).
  `/finalize` notes this as a known limitation in the README.
- **Never put the model in the Lambda (measured in ticket 10).** With
  transformers.js the zip was 555MB against a 50MB upload limit, and `sharp` is a
  macOS build. The Lambda zip is `handler.js` + `lib` only (about 12KB); the
  nodejs20.x runtime provides the AWS SDK. Anything that `require`s
  `lib/embedding/local.js` must stay off the Lambda path; `lib/embedding/index.js` switches.
- **Lambda path needs three things running:** LocalStack, the embedding service
  (`make embed`), and the frontend through the proxy (`make web-lambda
  LAMBDA_URL=…`). Free LocalStack has no API Gateway v2 (the Lambda uses a
  Function URL), and its gateway blocks browser origins such as
  `localhost:5173`, checking `Origin` and, when it's absent, `Referer`. Don't
  loosen that with `EXTRA_CORS_ALLOWED_ORIGINS`; the Vite proxy strips both
  headers. Test browser paths with browser headers, not a bare `curl`.

## Code conventions

- **No code comments.** The code must read on its own. A comment that explains
  *what* the code does is a signal to rewrite it: clearer names, smaller
  functions, and better structure carry the meaning instead. When you touch kit
  code, don't add comments. Removing the kit's `TODO(candidate)` block when you
  replace it is expected.
- **JSDoc on exported functions.** JSDoc is documentation, not a comment. Every
  exported function gets a `/** … */` block covering its contract: what it does
  in a line, `@param`, `@returns`, and `@throws` where it throws. Private
  helpers whose names say what they do don't need one.
- **Small, single-purpose units** with clear interfaces, each understandable and
  testable in isolation. Keep pure logic (normalize, similarity, ranking,
  request validation) separate from I/O (DynamoDB, S3, HTTP, the model) so it
  can be tested directly.
- **Minimal new dependencies.** Each one must earn its place against the cost of
  adding it, and gets recorded with the **recording-decisions** skill.
  `@huggingface/transformers` is already settled. No test framework, no
  validation library, no vector math package.
- **Evidence before assertions.** Never claim something works without running
  it and seeing the output.

## Testing

- **TDD for pure logic only:** normalize, similarity, ranking, request
  validation. Write a failing test, then the minimum code to pass, then
  refactor.
- **`node --test`** with `node:assert`. No test framework dependency. Test files
  sit next to the code as `*.test.js` and run from `backend/`.
- **Wired behavior is proven by running it,** not by mocks. That covers the
  model, DynamoDB, S3, and the HTTP routes. Run the server against LocalStack
  and exercise it with `curl` (or the bulk script / frontend). Don't fabricate
  tests for setup or scaffolding.

## Definition of done (per ticket)

- **Tests green, with the actual output reported** (not just asserted).
- **Runs end to end against LocalStack:** the behavior exercised through the
  running local server, with the real request and response shown.
- **Docs updated:** `spec/SPEC.md` if the shape, data model, or API changed;
  `README.md` if run steps changed; the ticket's status in `docs/roadmap.md`.
- **Committed.**

## Commits

One coherent slice per commit, using
[Conventional Commits](https://www.conventionalcommits.org/): `type: subject`,
where type is `feat`, `fix`, `test`, `refactor`, `docs`, or `chore`, and the
subject is imperative and lowercase. The body says *why*, not just what. (The harness appends its own trailer. Don't add one by
hand.)

## Decisions

When you settle a genuine fork (a design choice, a scope cut, a new dependency,
a reversal), record it with the **recording-decisions** skill in
`docs/decisions.md`. Routine mechanics with no defensible alternative are not
decisions. The log is the defense script for the live session, and its
**AI vs. me** field is the raw material for the spec's required AI notes, so
keep it honest.
