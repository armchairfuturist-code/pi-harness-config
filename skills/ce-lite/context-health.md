# Context health — proactive handoff

Disclosed from `SKILL.md`. Read when work is long-running or context pressure is possible.

Hand off before context degrades; compaction is the fallback, not the plan. Measured rot onset for this operator: ~42% context fill (step ~76, ~377K cumulative tokens).

## Triggers

Hand off when any of these trip:
- A journaled workflow finishes 3 phases with more remaining.
- Context usage crosses ~28% fill with multi-signal rot score ≥70 (rot-sentinel), or ~40% fill as a hard ceiling (`ctx_stats` or the pi-context-usage indicator).
- The operator swaps model mid-effort.
- You catch yourself re-reading files, losing a thread, or contradicting an earlier decision.
- tool_error rate spikes (lean-ctx blocks are the dominant rot signal at 22.7% — if you see 2+ blocked commands in 5 turns, handoff is overdue).

## Protocol

1. Write the handoff to `.scratch/HANDOFF.md` for project work (OS temp dir otherwise): current objective, contract terms + status, project state, completed/current tasks, known failures, key decisions, open questions, immediate next steps, and the resumable workflow `runId` when one exists. Reference artifacts by path — never duplicate their contents.
2. Add a **model note**: current model, effective boundaries observed this session (context, tool quirks), anything the next shift's model must know — the operator swaps models often.
3. If the session did memory-heavy work, run the `memory-consolidate` saved workflow first so the next shift inherits clean state.
4. Resume the next shift from the handoff plus `resumeFromRunId`; unchanged `agent()` calls replay from cache, so completed phases cost nothing.
