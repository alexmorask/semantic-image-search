---
description: Build the next ticket from docs/roadmap.md: test-first for pure logic, run it end to end against LocalStack, prove the definition of done, commit, and close it.
argument-hint: [optional ticket title to target; defaults to the next todo]
---

This is the **build** phase. It takes one ticket to done. One ticket per run, so
I stay in the loop *between* tickets, not inside them. Follow the conventions in
`CLAUDE.md` throughout: no code comments, small single-purpose units, minimal
dependencies, the settled decisions, the known pitfalls, and the commit
convention.

## Pick the ticket

Read `docs/roadmap.md`. If it does not exist, stop and tell me to run
`/plan-tickets` first.

Take the ticket named in $ARGUMENTS if one was given. Otherwise take the first
`todo` ticket on the core board. Restate it: its slice and its acceptance
criterion. If no `todo` tickets remain, say the board is clear and stop.

**Check the time box.** If we may be inside the last 20 minutes, or this ticket
looks likely to run into them, say so and recommend `/finalize` instead. Ask me
before starting.

## Build it

First decide what kind of work this is.

**Pure logic** (normalize, similarity, ranking, request validation) is
test-first with `node --test` and `node:assert`. There is no test framework.

1. **Red.** Write a `*.test.js` beside the unit that asserts the acceptance
   behavior. Run it and watch it fail for the right reason.
2. **Green.** Write the minimum code that makes it pass. No speculative extras.
3. **Refactor.** Clean up while the tests stay green. If the code needs a comment
   to be understood, rewrite it.

**Wired behavior** (the model, DynamoDB, S3, HTTP routes, the bulk script) is
proven by running it, not by mocks. Build it, then exercise it against
LocalStack through the running local server.

**Setup** (dependencies, scripts, Makefile targets) is proven by running it.
Don't fabricate tests that a file exists.

Watch for the known pitfalls in `CLAUDE.md`, especially Scan pagination, cache
freshness on ingest, the same model and code for both vector sides, and
registering new routes in all three places (`handler.js`, `local-server.js`,
`deploy.sh`).

A new dependency must earn its place. Record it with the **recording-decisions**
skill before adding it.

## Prove the definition of done

Don't claim done without the evidence in hand. Run and show, in order:

- **Tests green:** run `node --test` from `backend/` and report the actual
  output.
- **Runs end to end against LocalStack:** with `make up` and `make api`
  running, exercise the ticket's behavior with `curl` (or the bulk script) and
  show the real request and response. Check that error cases return the right
  status.
- **Docs updated:** `spec/SPEC.md` if the data model, API, or approach changed.
  `README.md` if run steps changed.

If any check fails, fix it before continuing.

## Review before committing

Re-read the diff as a reviewer would, and as I will have to explain it live:

- Does it meet the acceptance criterion, including edge cases and error
  statuses?
- Is there dead code, a leftover comment or `TODO`, duplication, or a simpler
  equivalent?
- Can every new unit be explained in one sentence?
- Does it match `CLAUDE.md` and the surrounding code's style?

Fix what you find. If a real fork came up during the build, record it with the
**recording-decisions** skill, and fill in **AI vs. me** honestly if I corrected
or overrode something you proposed.

## Commit and close

Commit the slice as one coherent change, following the commit convention. Flip
the ticket's status to `done` in `docs/roadmap.md`, in the same commit.

Report what shipped, the evidence that it's done, and which ticket is next. Then
**stop**. I decide when to run the next ticket.
