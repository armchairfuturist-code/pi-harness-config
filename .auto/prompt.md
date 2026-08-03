# Autoresearch: TSCG aggressiveMaxDescChars tuning

## Objective
Find the optimal `aggressiveMaxDescChars` value in `~/.pi/tscg.json` that minimizes token count without degrading tool understanding or task correctness.

## Metrics
- **Primary**: `probe_tokens` (tokens, lower is better) — fixed overhead per request (system prompt + tool schemas), measured via `bench/probe.sh` through the capture proxy
- **Secondary**: `bench_tokens` — full workload tokens (list files, read largest, create file), measured via `bench/measure.sh`
- **Secondary**: `checks_pass` — correctness (1 = pass, 0 = fail)

## How to Run
`./.auto/measure.sh` — runs probe + bench, outputs `METRIC` lines.

## Files in Scope
- `~/.pi/tscg.json` — the only file to modify. Change `aggressiveMaxDescChars` value.
- `~/.pi/agent/npm/node_modules/pi-tscg/extensions/tscg.ts` — patched with recursive truncation (see `patches/tscg/apply-patches.mjs`). Do NOT modify this file.

## Off Limits
- `bench/probe.sh`, `bench/measure.sh`, `bench/build-variant.sh` — benchmark infrastructure
- `patches/` — re-apply scripts
- Any file other than `~/.pi/tscg.json`

## Constraints
- `checks_pass` must be 1 (bench workload must complete correctly)
- `aggressiveMaxDescChars` must be ≥ 5 (below 5 breaks even tool names)
- After each change, run `pi update --extensions` is NOT needed — TSCG reads the config file live via `/tscg` command, but the probe uses build-variant.sh which copies tscg.json from the repo. So edit BOTH `~/.pi/tscg.json` AND the repo copy, then run probe.
- The probe must be run with `CTX_MODE_ADMIN_TOOLS=0` to match the current optimized baseline.

## Baseline
- Current: `aggressiveMaxDescChars: 30` → probe 3,802 tokens, bench ~22,342 tokens
- Range to explore: 10–50 (lower = more compression, higher = more description)
- The probe captures tool schemas, so it directly measures the impact of description length.

## Anti-Overfitting Rules
- Do NOT modify the benchmark scripts to produce better numbers
- Do NOT change the bench workload — it must stay the same across all runs
- If `checks_pass` fails at any value, that value is too aggressive — discard it
- The goal is the SMALLEST value where checks still pass and bench tokens don't increase
- "Perfectly optimized" doesn't exist — if the current value (30) is already optimal, say so and stop

## What's Been Tried
- 30 (current baseline): probe 3,802, bench 22,342, checks pass
- (update this section as experiments accumulate)

## ASI Schema
```json
{
  "hypothesis": "what value and why",
  "mechanism": "how description length affects token count",
  "result": "what happened",
  "learned": "key insight",
  "next_focus": "next value to try",
  "dead_end": false,
  "rollback_reason": "why it failed (discard only)"
}
```
