---
description: Break the build into an ordered ticket board in docs/roadmap.md, walking skeleton first. Discuss, write after agreement, then stop.
argument-hint: (none; reads spec/SPEC.md and docs/decisions.md)
---

This is the **planning** phase. It decides what gets built in the time box, and
in what order, as a ticket board. It is the most important checkpoint before
code. No code yet.

## Read first

Read `spec/SPEC.md` and `docs/decisions.md`. If the spec is missing, stop and
tell me to run `/write-spec` first. Also re-read the **Time box**, **Known
pitfalls**, and **Improvement options** in `CLAUDE.md`.

## Budget

The build is 2–3 hours, and the last 20 minutes are reserved for `/finalize`.
Plan the core to fit comfortably inside what remains, with slack. Give each
ticket a rough size (S/M/L, or minutes), and show the running total against the
budget.

## Order for a walking skeleton first

The first tickets must leave **something runnable end to end as early as
possible**: a real query, embedded by the real model, ranked against real stored
vectors, and returned through the running local server. Thin first, then
widen. Every later ticket should keep the system demoable, so the build can stop
at any point with a coherent demo.

Respect these constraints when ordering:

- Pure logic (normalize, similarity, ranking, request validation) is test-first
  and can land early.
- The ingest path (`POST /images`) and the bulk loader must exist before
  `make dataset` data can be searched. Decision 7 means there is no
  direct-to-database shortcut for real data.
- The paginated Scan loader and the cache update on ingest are core, not polish.
  They are known pitfalls.
- Exercising the Lambda path (`make embed`, `make deploy`, `make web-lambda`) is
  its own late ticket, and the first one to cut.

## Ticket shape

Each ticket is one coherent slice with:

- **Title** and a one-line description of the slice.
- **Acceptance:** the observable behavior that proves it works (a `curl`
  request and its expected response, or a test).
- **Size**.
- **Status:** `todo` to start.

The definition of done is the same for every ticket and lives in `CLAUDE.md`.
Reference it; don't repeat it per ticket.

## Backlog

Below the core board, list the **backlog**: the buildable out-of-scope features
(delete, ownership/permissions filtering, pagination, hybrid keyword + semantic
search). Rank them by value per minute and by risk, and note the dependencies
for each. For each item, give one or two lines on **how I'd build it on this
data model**: the files touched and the change. If the core board lands early,
I pull from the backlog top-down via `/implement-ticket`. These lines are also
my prep notes for the live session.

The **scale items** (ANN index, async ingest, separate embedding service, a
bulk re-embedding pipeline (reprocessing every stored original in the
background after a model change), per-instance cache drift, Group-scoped
search) are **not backlog**. They are reasoned about in the spec's Scale plan only and
never built. Don't put them on the board or in the backlog.

## Record the scope calls

A notable cut or ordering call is a decision. Record it with the
**recording-decisions** skill.

## Discuss first, then write

Present the ordered core board, the budget math, and the ranked backlog in chat,
and settle them with me. Scope is my call. Do not write the file until it is
agreed.

Once agreed, write `docs/roadmap.md` with these sections: Core (the ordered
board), Backlog (ranked), and a short Order rationale.

Then **stop**. Do not start building.
