---
description: Live-session fast path. Restate a new requirement, name the files it touches, make the change, run it end to end, record a one-line decision if there was a real fork, and commit.
argument-hint: <the new requirement, as the panel stated it>
---

This is the **live-session** path. The panel has just added a requirement, and
they are watching. Speed and clarity matter. There is no intake, spec, or
roadmap ceremony. The conventions in `CLAUDE.md` still hold: no code comments,
small units, the settled decisions, the known pitfalls, and evidence before
assertions.

The requirement is: $ARGUMENTS

If that is empty, ask for it in one line and stop.

## 1. Restate and scope (out loud, short)

- **Restate** the requirement in one or two sentences, in terms of this system's
  behavior. If one ambiguity actually changes what gets built, ask that single
  question. Otherwise state the assumption and move on.
- **Name the files** it touches, and the change in each, in a short list. Check the
  Backlog section of `docs/roadmap.md` first. If this is a backlog item, the
  plan is already sketched there, so use it.
- If it adds a route, list both places: `backend/handler.js` and
  `backend/local-server.js`.

Then proceed straight away. I'll interrupt if the restatement is wrong.

## 2. Make the change

Write the smallest change that satisfies the requirement and keeps the existing
behavior intact. Keep `POST /search`'s response shape backward compatible: add
fields, don't rename or remove them. If the change adds pure logic, add a small
`node --test` case alongside it, but don't let test ceremony stall the demo.

## 3. Prove it end to end

With the local server running against LocalStack, restart the server if needed,
then show the new behavior with a real `curl` (or in the frontend) and show that
existing search still works. Run `node --test` from `backend/` and report the
result. If something fails, say so plainly and fix it, or tell me what's broken.

## 4. Record and commit

- If there was a **real fork**, append a compact one-line entry to
  `docs/decisions.md` using the **recording-decisions** skill's compact form.
  Include **AI vs. me** only if there's something honest to say.
- Commit as one slice with a Conventional Commits subject and a one-line why.

Report in two or three lines: what changed, the evidence, and the commit. Then
**stop**, ready for the next requirement.
