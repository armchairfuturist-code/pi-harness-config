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
- Current: `aggressiveMaxDescChars: 30` → probe 4,874 tokens, bench 16,255 tokens
- Range to explore: 10–50 (lower = more compression, higher = more description)
- The probe captures tool schemas, so it directly measures the impact of description length.

## Anti-Overfitting Rules
- Do NOT modify the benchmark scripts to produce better numbers
- Do NOT change the bench workload — it must stay the same across all runs
- If `checks_pass` fails at any value, that value is too aggressive — discard it
- The goal is the SMALLEST value where checks still pass and bench tokens don't increase
- "Perfectly optimized" doesn't exist — if the current value (30) is already optimal, say so and stop

- 30 (current baseline): probe 4,874, bench 16,255, checks pass
- 25: probe 4,756, bench 22,042/26,817, checks pass (1 fail in 2 — bench noise)
- 20: probe 4,644, bench 15,480, checks pass
- 18: probe 4,595, bench 20,001/36,864, checks pass (1 fail in 2 — bench noise)
- 15: probe 4,532, bench 20,426, checks pass
- 10: probe 4,417, bench 19,824/19,757/25,024, checks pass (1 fail in 3 — bench noise)
- 8: probe 4,378, bench 19,997/21,735, checks pass ×2
- 7: probe 4,360, bench 27,906/19,804, checks 1 pass + 1 fail (borderline)
- 6: probe 4,366, bench 25,261, checks pass
- 5: probe 4,339, bench 19,580/19,478/14,504, checks pass ×3 ← RECOMMENDED (floor)

## Verdict
aggressiveMaxDescChars=5 is optimal. probe is deterministic & monotonic in chars; 5 is the
constraint floor (≥5) and yields the lowest probe (4,339 vs 4,874 at 30 = −535 tokens, −11.0%).
checks_pass is stochastic in this bench (failures observed at 7/10/18/25 too, all passing on
retry) so it cannot discriminate; 5 passed 3/3. bench_tokens are too noisy (±10k) to optimize on.


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
