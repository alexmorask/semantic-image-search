---
description: Verify every run command actually works, update README.md with real run steps and what was built, and complete the spec's AI notes from docs/decisions.md. Then stop.
argument-hint: (none; reads the docs and the code)
---

This is the **finalize** phase, run in the protected last 20 minutes. It makes
the front door honest: the README and the spec must describe what was
*actually built*, not what was planned. I will defend both out loud.

## Read first

- `docs/roadmap.md`: which tickets are `done` and which are not.
- `docs/decisions.md`: the tradeoffs, and the **AI vs. me** fields.
- `spec/SPEC.md`: the spec as written.
- The code, `Makefile`, and `package.json` scripts: the source of truth for how
  it runs.

If core tickets are still `todo`, say so. Finalizing with honestly documented
gaps is fine. Claiming unbuilt features is not.

## Verify every run command

The commands in the README are promises. Run each one, from a clean LocalStack
where practical, and watch it succeed:

1. Install dependencies (`make install`), start LocalStack (`make up`), and
   create the table and bucket.
2. Warm the model and start the local API (`make api`). Confirm `GET /health`.
3. Run the bulk ingest through `POST /images` and confirm the count of stored
   records. If only the 44 placeholders are present (no `make dataset`), say
   which dataset was verified.
4. Run several `POST /search` queries and check that the top results are
   plausibly right. Check the error statuses: empty query → 400, bad URL → 400,
   unfetchable image → 422.
5. Run the tests: `node --test` from `backend/`.
6. Run the frontend (`make web`) and confirm it returns results.
7. Try `make deploy` only if time allows. Report its real state either way.

Document only commands you watched succeed. If one fails, fix it or document
the real state. Don't paper over it.

## Update README.md

Keep the kit's framing short and replace the parts that are no longer true:

1. **What was built:** one paragraph covering semantic search with CLIP, one
   ingest path, and one read path, with a link to `spec/SPEC.md`.
2. **Run steps:** the exact verified commands, in order. Include prerequisites
   (Node version, Docker), the first-run model download, and how to get the
   400-image Unsplash set.
3. **API:** the three endpoints with one `curl` example each.
4. **Scope:** what is built, and what is deliberately deferred (with a link to
   the spec's out-of-scope and scale-plan sections).
5. **Tests:** how to run them, and what they cover (pure logic) versus what was
   verified by running (wired behavior).

## Complete the spec's AI notes

Fill `spec/SPEC.md`'s **AI notes** from the **AI vs. me** fields in
`docs/decisions.md`. Cover where AI helped (drafting, code, debugging, review)
and the specific places I corrected or overrode it, each with a one-line why.
Be honest and specific. Don't invent overrides or hide them. While you're in the
spec, make sure every section still matches what shipped, and that it stays
within two pages.

## Then stop

Present the README and spec changes along with the verification evidence, and
let me refine the wording. Don't commit until I've reviewed.
