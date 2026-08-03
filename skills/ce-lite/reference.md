# Reference — recall, decomposition, mechanic's shelf

Disclosed from `SKILL.md`. Read before non-trivial work in a familiar area, or when work may span sessions.

## Recall protocol

Artifacts only pay for themselves when they are read. Before non-trivial decisions or new work in a familiar area, spend a little context to save a lot.

First, keep recall current: if `~/.pi/agent/memory/sessions/` holds files you have not indexed this session, `ctx_index` that directory with source `session-log` (summaries are auto-written at every session shutdown; re-indexing is cheap).

Then:
1. `ctx_search` the knowledge store for the topic — prior decisions, gotchas, operator preferences, past session summaries (the store includes `memory/consolidated.md` learnings and the `session-log` source).
2. Check the repo's own records when they exist: ADRs / CONTEXT.md (respect superseded markers), the wayfinder map's Decisions-so-far, open tickets.
3. Then decide. If you contradict a recorded decision, say so explicitly and record the reversal — silent drift is how the record loses trust.

Skip this only for greenfield or genuinely novel questions.

## Decomposition routing

- Work spanning sessions (multi-session efforts, anything you would hand off) → tracker-backed tickets: `/to-tickets`, or a wayfinder map when the way is foggy. Persistent, claimable, resumable.
- Within-session fan-out (research, parallel checks, reviews, one-off builds) → ephemeral workflow runs: journaled, no tracker overhead.
- Never track the same work in both. When a worker's `new_tasks` field surfaces session-spanning work, publish it as tickets — do not carry it in chat.

## Mechanic's shelf

Lazy reference — read when relevant, never mention to the operator.

The matt skill library: implement, tdd, research, diagnosing-bugs, code-review, domain-modeling, to-spec, handoff. For workflow syntax: workflow-authoring and workflow-patterns skills.
