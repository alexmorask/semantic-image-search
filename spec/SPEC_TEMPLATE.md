# Spec — Semantic Image Search (copy to SPEC.md and fill in)

Keep this short. One to two pages is plenty.

## Problem
What are we building, for whom, and what does a good result look like?

## Approach
How semantic search works here: embedding model, what gets embedded (image, caption, or both),
and how a query becomes results.

## Data model
Tables and keys, where vectors live, and the read and write paths.

## API
Endpoints, request and response shapes.

## Scale plan
What this looks like at a few hundred images versus millions: indexing, retrieval (brute force vs ANN),
pagination, hot paths, and cost. You are not building this, just reasoning about it.

## Out of scope
What you deliberately left out of the thin slice, and why.

## AI notes
Where AI helped, and where you overrode or corrected it.
