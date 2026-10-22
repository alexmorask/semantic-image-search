---
name: recording-decisions
description: Use when a load-bearing design or scope decision is settled (while writing the spec, planning tickets, mid-build, or during the live session) to record it in docs/decisions.md in the Decision → Rationale → Tradeoff → Rejected → AI vs. me format. Triggers whenever you choose between defensible alternatives, add a dependency, reverse an earlier decision, or accept a tradeoff a reviewer would question.
---

# Recording Decisions

The decision log is the defense script. It captures *why* the system is the way
it is, so the reasoning survives past the moment it was made and I can defend it
out loud in the live session. It is also the source for the spec's required
**AI notes**. Record a decision the moment it is settled, while the reasoning is
fresh.

## What counts as a decision

Record it when there was a **genuine fork**, meaning two or more defensible
options and one was picked:

- a design choice (a data shape, an interface, an algorithm, where a vector lives),
- a scope call (built now, backlog, or scale plan only),
- a new dependency (every one gets recorded),
- a reversal of an earlier decision,
- an accepted tradeoff a reviewer would question.

Do **not** record routine mechanics that had no real alternative, like naming a
variable or using the obvious standard library function. If there was no
defensible alternative, it is not a decision.

## Format

Append a numbered entry to `docs/decisions.md`. Never renumber existing entries.
A new decision gets the next number, even one that supersedes an earlier one.

```
## N. <short title>

**Decision:** what we chose, in one or two sentences.
**Rationale:** why: the reasoning that makes this the right call here.
**Tradeoff:** what we give up by choosing it. Every real decision costs something.
**Rejected:** the alternatives considered, and why each lost.
**AI vs. me:** what the AI proposed, and whether I accepted, corrected, or overrode it.
```

### AI vs. me

This field feeds the spec's required AI notes, so it must be **honest and
specific**:

- Say what the AI actually proposed and what I actually did: *accepted*,
  *corrected* (and how), or *overrode* (and why).
- Never inflate my role or invent an override that didn't happen. Never hide one
  that did.
- **Leave the field out** when there is nothing to say: no meaningful AI
  proposal, or nothing beyond routine agreement. An empty or filler entry is
  worse than none.

### Compact form (live session)

During `/extend`, speed matters. A real fork may be recorded as a one-liner:

```
## N. <short title>

**Decision:** <what> because <why>. Rejected: <alternative>. AI vs. me: <only if something to say>.
```

## Reversals

If a new decision reverses an earlier one, say so explicitly in both entries
("supersedes #5" / "superseded by #12") instead of editing the old one away. The
reversal is part of the story a reviewer wants to hear.

## Keep it lean

One tight entry per decision. The log is a reference I will defend out loud,
not an essay. A reviewer should be able to read any entry in about fifteen
seconds.
