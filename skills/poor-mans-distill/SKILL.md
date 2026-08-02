# Poor-Man's Distillation — Session-Trace → Few-Shot Skill

**Status:** experimental · measured against 37 sessions (2026-07-14 → 2026-07-27)
**Conventions:** pi-autoresearch — measure, keep/discard, iterate.

## What this is

"Distilling an agent from code traces" *without fine-tuning*: extract the user's
best pi session traces (successful edits, good tool calls) and reuse them as a
curated skill context / few-shot bank. No GPU, no weights, no cluster.

## How to run

```bash
python3 ~/.pi/scripts/poor_mans_distill.py
```

Outputs (in this skill dir):
- `distilled_traces.jsonl` — every intent→action pair, ranked by outcome score.
- `fewshot_digest.md` — top 25 traces, formatted for pasting into a system prompt.
- `route_shortcuts.md` — task-type → dominant tool sequence, with hard-code flags.

## What it measures

- **outcome score (0..1)** — heuristic from the session tail: success markers
  (+), error markers (−), edits/writes that landed (+0.2). Imperfect but cheap.
- **task-type** — keyword classifier: error-fix, test, install, research, build,
  refactor, inspect, other.
- **route dominance** — % of a task-type that takes a given tool sequence.

## Measured results (37 sessions, 100 pairs)

| task-type | pairs | dominant route | confidence |
|-----------|------:|----------------|-----------:|
| error-fix | 33 | bash | 18% |
| other | 34 | ctx_execute | 29% |
| research | 12 | read | 25% |
| install | 7 | ctx_batch_execute | 29% |
| test | 4 | ctx_execute | 50% |
| refactor | 4 | bash | 25% |
| inspect | 3 | read | 33% |
| build | 3 | bash | 33% |

**Keep:** the few-shot extraction works and is immediately useful — the top
traces are genuine, high-quality intent→action examples (error-fix routes to
ctx_grep→ctx_shell, install routes to batch-execute). Pasting the top 5-10 into
a specialist system prompt is a real, measurable win.

**Discard (for now):** hard-coding harness route shortcuts. Zero task-types hit
≥70% confidence at ≥3 instances. Routing is too diffuse at this corpus size.
Re-measure after ~100 sessions per task-type; the script already flags the
threshold, so this is a "re-run later" decision, not a permanent discard.

**Iterate:**
1. Replace the keyword `classify_intent` with an LLM call (cheap model labels
   each intent) — the keyword classifier puts 34/100 in "other".
2. Improve `session_outcome` — currently tail-heuristic. A real signal: did the
   user send a follow-up correction? (correction = negative label). Parse the
   parentId chain.
3. Per-project slicing: tag sessions by cwd so Investment-Engine traces get their
   own few-shot bank.

## How to use the few-shot bank

The intended consumer is a specialist prompt for a narrow task (e.g.
Investment-Engine MCP edits). Load the top-N traces for that task-type as
few-shot examples in a system message. This is the "poor man's" version of
fine-tuning: behavior transfer via demonstration, not gradient updates.
