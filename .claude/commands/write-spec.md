---
description: Fill spec/SPEC.md from the template using the settled decisions. Discuss section by section, write only after agreement, then stop.
argument-hint: (none; reads spec/SPEC_TEMPLATE.md and docs/decisions.md)
---

This is the **spec** phase. It turns the settled decisions into the 1–2 page
`spec/SPEC.md` the assignment requires. No tickets and no code yet.

## Read first

- `spec/SPEC_TEMPLATE.md`: the required sections, in order.
- `docs/decisions.md`: the settled decisions. The spec describes them and does
  not reopen them.
- `CLAUDE.md`: the settled-decisions summary, the improvement options, and the
  known pitfalls.
- `README.md` and `data/README.md`: the kit's framing and dataset notes.

If `spec/SPEC.md` already exists, read it and treat this run as a revision, not
a rewrite.

## Draft each section

Follow the template's sections and order exactly:

1. **Problem:** who searches, for what, and what a good result looks like. This
   is a ranked set where the top few are visibly right for the query.
2. **Approach:** CLIP embeds images at ingest and query text at search, into the
   same space with the same code, and results are ranked by dot product of
   normalized vectors. Say plainly what gets embedded (the image itself, not the
   caption) and why.
3. **Data model:** the `images` table and its fields, the S3 bucket and its key
   scheme, where vectors live, and the write path and read path step by step.
   Include a small ASCII diagram of both paths. It is the fastest thing to
   explain in the demo.
4. **API:** `POST /search`, `POST /images`, and `GET /health`, with request and
   response shapes and every error status.
5. **Scale plan:** a few hundred images versus millions. Cover the ANN index,
   async ingest (S3 → queue → workers), a separate embedding service, a bulk
   re-embedding pipeline (reprocessing every stored original in the background
   after a model change), pagination, per-instance cache drift, hot paths, and
   cost. Name the AWS vector-store options: Amazon S3 Vectors,
   OpenSearch Service with k-NN, and Aurora PostgreSQL with pgvector. Cover
   **Group-scoped search**: users search their own Groups, not all 14B photos.
   Filtering by Group first, through vector-store metadata filters or by
   partitioning by Group, keeps each search small. That is about 5,000 photos ×
   2KB ≈ 10MB, versus about 28TB to hold every vector. This is what ties the
   scale plan to permissions. This section is reasoning, not building.
6. **Out of scope:** the out-of-scope features from the Backlog (delete,
   permissions/ownership, pagination, hybrid search), each framed as a choice,
   with one line on how the data model keeps it a small change.
7. **AI notes:** draft what is already known from the decisions' **AI vs. me**
   fields. `/finalize` completes it at the end of the build.

Keep the whole spec to **one to two pages**. Prefer tables and short bullets to
prose. Every sentence should be something I can defend out loud.

## Discuss section by section, then write

Present each section in chat, one at a time, and settle it with me before moving
on. If drafting surfaces a genuine new fork the settled decisions don't cover,
present the options with a recommendation and let me choose. Then record it with
the **recording-decisions** skill.

Do not write the file until every section is agreed. Then write `spec/SPEC.md`.

Then **stop**. Do not run `/plan-tickets`. The spec is a checkpoint.
