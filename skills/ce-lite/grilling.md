# Grilling protocol

Disclosed from `SKILL.md` step 1. Read when grilling is non-trivial — when the request has real ambiguity, not just a missing detail or two.

Grilling is a relentless interview that sharpens a fuzzy request into something you can write checkable terms for. One question at a time. The operator never sees stage names or skill names — they just see questions, one at a time, each with a clear reason behind it.

## What makes a question blocking

A question is blocking only when you cannot proceed without its answer AND cannot default it. Before asking, test:

- **Can I default it?** If a reasonable default exists, state it and proceed: "I'll assume X — say so if that's wrong." This is not a question; it's a default with an escape hatch.
- **Is it actually blocking?** If you could write terms and execute without the answer, it's not blocking — save it for later or let it surface during execution.
- **Is it the next question?** If the answer depends on another unknown, ask that one first.

Only when all three fail — can't default, can't proceed, nothing else is upstream — ask.

## Two modes

### Depth-first (sharpen the destination)
Use when the operator knows what they want but the shape is blurry. Go deep on the core: what does "done" look like, what are the constraints, what's the real constraint behind the stated one. Each answer sharpens the next question. Stop when you can write checkable terms.

### Breadth-first (map the frontier)
Use when the request is large and the way forward isn't visible. Fan out across the whole space — surface the open decisions and the first steps takeable now. Don't go deep on any one thread; you're mapping, not resolving. If this surfaces no fog — the way is already clear, small enough for one session — skip wayfinding and run the contract loop directly. If it surfaces fog you can't yet phrase as a question, read `wayfinding.md`.

## Fog

Fog is what you can't yet specify sharply enough to ask about. Don't force fog into questions — it's coarser than a question, and one patch may graduate into several questions, or none, once the frontier reaches it. Name the fog ("I can't yet tell whether X or Y is the right approach — I need to understand Z first"), then either:
- Resolve it with a research subagent (`workflow` tier `small`) if it's a knowledge gap.
- Graduate it into questions when a prior answer makes it sharp enough.
- Park it in the wayfinder map's "Not yet specified" section if it's multi-session.

## Domain modeling

When the grilling reveals domain concepts the operator uses repeatedly — terms of art, entity relationships, state transitions — model them. Name each concept, define it in one line, and use that vocabulary in the terms and plan. This is not a ceremony: a shared vocabulary makes the terms checkable and the plan precise. If the domain is already modeled in `CONTEXT.md` or the knowledge store (`ctx_search`), inherit and extend it.

## Completion

Grilling is done when no blocking unknowns remain — every unknown is either defaulted, deferred to execution, or parked as fog in a wayfinder map. The test: can you write a checkable term for every aspect of "done"? If yes, grilling is complete. If any aspect of "done" is still fuzzy, keep grilling.
