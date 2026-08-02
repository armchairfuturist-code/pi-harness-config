---
name: context-rot-forensics
description: Analyze pi session JSONL logs to detect where context quality collapses — turn/token/tool-result thresholds, error clustering, re-read patterns, and bloat events. Provides both post-hoc forensics and a real-time sentinel extension for proactive handoff.
---

# Context-Rot Forensics

Detects context degradation in pi coding agent sessions by analyzing JSONL logs
in `~/.pi/agent/sessions/--home-alex--/`. Inspired by the "contextrot" project
(Claude Code session analysis) and "Kote" (engineering context capture), adapted
for pi's specific session format and extension API.

## What it does

1. **Post-hoc forensics** — `scripts/rot-forensics.py` analyzes completed sessions
   using the contextrot project's statistical methodology (Wilson-interval
   bucketing, knee detection, 5 behavioral signals) adapted for pi's JSONL format
2. **Real-time sentinel** — `~/.pi/agent/extensions/rot-sentinel.ts` hooks the pi
   `context` event to detect rot live and trigger proactive handoff

## Methodology (from contextrot, adapted for pi)

The core insight from contextrot: **quality is proxied by behavioral heuristics,
not token counts.** Token counts measure *context fill* (the x-axis), not
degradation. The 5 behavioral signals are:

| Signal | What it detects | How (pi-adapted) |
|--------|----------------|------------------|
| `tool_error` | Any tool call returned an error | Tool result text contains error keywords |
| `edit_failure` | An editing tool returned an error (strongest signal) | Tool name in EDIT_TOOLS set + error |
| `retry` | Step repeats a (tool, target) that errored within 6 steps | Recent-error lookup with 6-step window |
| `reread` | Step re-reads a file already read earlier | File path in READ_TOOLS + already-seen set |
| `self_correction` | Assistant text matches apology/correction phrases | Regex: "i apologize", "my mistake", "let me fix", etc. |

A step is **degraded** if ANY signal fires. The rot curve buckets steps by
context fill % (10-point buckets), computes Wilson 95% CIs per bucket, and
detects the **knee** — the first bucket where degradation rate is ≥1.5× the
fresh-zone rate with non-overlapping CIs.

**Pi-specific additions** (not in contextrot): token bloat events, output
decline (quartile analysis), compaction tracking, model-swap detection,
live monitoring, and a real-time sentinel extension.

## This user's rot profile (measured)

Based on 30 non-trivial sessions (July-Aug 2026):

- **4/30 sessions show knee detection** (edge verdict)
- **Average knee: 42% context fill, step 76, 377K cumulative tokens**
- **→ Handoff should trigger BEFORE ~28% fill** (knee minus safety margin)
- Signal frequency across all sessions:
  - `tool_error`: 22.7% of steps (dominant signal — pi's shell allowlist blocks many commands)
  - `retry`: 6.1% of steps
  - `reread`: 3.2% of steps
  - `self_correction`: 0.6% of steps
  - `edit_failure`: 0.5% of steps
- Most sessions verdict "insufficient" (too short for statistical significance) —
  this is expected for pi's shorter sessions vs Claude Code's 500+ turn sessions

## Additional pi-specific signals

| Signal | What it means | Detection method |
|--------|--------------|-----------------|
| Token bloat | Large tool results injected into context | Per-turn input token jump > threshold |
| Output decline | Quality collapsing — shorter responses | Q4 avg_out < 50% of Q1 avg_out |
| Compaction events | Context overflow forced reset | `type: "compaction"` entries in JSONL |
| Model swaps | Operator noticed degradation | `type: "model_change"` entries |

## Usage

### Post-hoc analysis

```bash
# Analyze top 5 largest sessions + cross-session summary
python3 ~/.pi/agent/skills/context-rot-forensics/scripts/rot-forensics.py

# Analyze all sessions
python3 ~/.pi/agent/skills/context-rot-forensics/scripts/rot-forensics.py --all

# Cross-session summary only (fast)
python3 ~/.pi/agent/skills/context-rot-forensics/scripts/rot-forensics.py --summary

# Specific session
python3 ~/.pi/agent/skills/context-rot-forensics/scripts/rot-forensics.py <file.jsonl>

# Live-monitor active session (tail-follow)
python3 ~/.pi/agent/skills/context-rot-forensics/scripts/rot-forensics.py --live <file.jsonl>
```

### Real-time sentinel

Enable the `rot-sentinel.ts` extension by setting `PI_ROT_ENABLED=1`:

```bash
# In your shell profile or pi launch env:
export PI_ROT_ENABLED=1
export PI_ROT_WARN_PCT=55        # context % that triggers warning
export PI_ROT_CRITICAL_PCT=70    # context % that triggers handoff
export PI_ROT_AUTO_COMPACT=0     # set to 1 to auto-compact at critical
export PI_ROT_BLOAT_THRESHOLD=15000  # per-turn input jump that flags bloat
```

When rot score ≥ 70, the sentinel writes a handoff marker to
`~/.pi/.scratch/ROT_HANDOFF.md` and emits a visible warning.

### Integration with ce-lite

The ce-lite orchestrator's "Context health" section already specifies proactive
handoff at ~60% context usage. The rot-sentinel + forensic analysis extends this:

- ce-lite checks `ctx_stats` / context-usage indicator (single signal: % full)
- rot-sentinel adds: error clustering, bloat events, re-read detection, output decline,
  self-correction detection (contextrot's 5 behavioral signals)
- **Measured data shows your sessions rot at ~42% fill / step 76 / 377K tokens**
- **Recommended: lower ce-lite's handoff trigger from 60% to ~28% fill** based on
  this data, OR use the rot-sentinel's multi-signal score instead of a single %
- The handoff marker at `~/.pi/.scratch/ROT_HANDOFF.md` is readable by ce-lite's
  handoff protocol — when it exists, ce-lite should read it and execute the
  standard handoff (write HANDOFF.md, model note, resume from runId)

### Could contextrot itself be used directly?

Yes — contextrot has an adapter system (`src/contextrot/adapters/`) that supports
Claude Code, OpenCode, Codex, Gemini CLI, and Cline. Adding a pi adapter would
require:
1. Implementing `SessionAdapter` subclass with `discover()` + `parse()`
2. Mapping pi's JSONL fields to the normalized `Session`/`Step`/`ToolCall` model
3. Pi's `message.usage.input` → fill tokens, tool results → `is_error`, etc.

However, the forensic script in this skill already implements contextrot's
core methodology natively for pi, so a separate adapter is optional — useful
only if you want contextrot's HTML reports, statusline integration, or
multi-agent comparison features.

## Session JSONL format (pi-specific)

Pi sessions are JSONL files in `~/.pi/agent/sessions/<cwd-slug>/`:
- Each line is a JSON object with a `type` field
- `type: "session"` — session metadata (cwd, id, version)
- `type: "message"` — chat messages with `message.role`, `message.content[]`, `message.usage`
  - `usage.input` / `usage.output` / `usage.totalTokens` — token counts per turn
  - `content[]` blocks: `text`, `thinking`, `toolCall`, `toolResult`
- `type: "compaction"` — compaction event with `summary`, `tokensBefore`, `firstKeptEntryId`
- `type: "model_change"` — model swap with `provider`, `modelId`
- `type: "thinking_level_change"` — thinking level adjustment

## What ctx_stats / lean-ctx already provides

- `lean-ctx stats` — aggregate token savings, compression rates, CEP session data
- `lean-ctx stats json` — detailed per-tool, per-day, per-session compression metrics
- `lean-ctx tools health` — tool budget rot report (unused tools costing tokens)

### What's MISSING (what this skill adds)

- **Per-turn token growth curve** — ctx_stats gives aggregates, not the trajectory
- **Error clustering detection** — not tracked anywhere
- **Re-read detection** — transcript-pruner deduplicates but doesn't count/flag
- **Output decline metric** — not tracked
- **Collapse point estimation** — "at what turn/token count does quality drop?"
- **Real-time rot score** — ctx_stats is post-hoc; sentinel is live
- **Cross-session pattern** — "your sessions rot at N turns / M tokens"
