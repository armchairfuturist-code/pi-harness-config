# Pi-native analytics baseline — 2026-08-13

## Scope

Read-only baseline for the HIL-approved measurement track. No optimizer, prompt, locked knob, or runtime configuration was changed. The HIL lock remains: `KEEP=4`, `reserveTokens=24000`, `keepRecentTokens=20000`, TSCG strip on, `maxDescChars=20`.

## Environment

- Repository: `pi-harness-config`, branch `master`
- Pi: `0.84.1`
- Active tool profile: `lean`, 12 advertised tools
- Config hash: `75eeca7d2574`
- Preflight: PASS
- Semantic canary: PASS, 33/33 CE-lite shield checks; 10/10 preload heuristic cases
- Inventory: PASS, no provider/harness drift

## Baseline measurements

### Probe

`bash bench/probe.sh baseline-20260813`

- Model: `openai-gpt-56-luna`
- Total: **5,183 tokens**
- Input: 5,167; output: 16; reasoning: 9
- Cache read/write: 0/0
- This is a cold, one-turn probe. It is not comparable to warm-session cache ratios.

### Deterministic workload

`bash bench/measure.sh 3`

- Totals: **23,513; 23,339; 23,510**
- Median: **23,510 total input/cache tokens**
- Requests: 4 per run
- Correctness: **3/3 runs passed**

### Existing cache history

Aggregated from `~/.pi/agent/pi-cache-optimizer-stats.json`:

- 1,202 requests, 1,124 hit requests: **93.51% request hit rate**
- 38,520,549 cached input tokens / 54,486,104 total input tokens: **70.70% cached-token coverage**

These are historical counters, not a causal A/B result.

## Existing capability measurements

### CE-lite preload historical replay

`node bench/ce-lite-preload-ab.mjs --json` scanned 936 sessions:

- Stub: 1,190 chars, approximately 298 tokens
- Full skill body: 2,587 chars, approximately 647 tokens
- Heuristic matched 826/936 sessions (88%)
- Multi-step recall: 730/794 (**92%**)
- Chat-like matches: 96 (**11% of all sessions**, the main overhead signal)
- Voluntary CE-lite skill reads in the historical sample: 174/936 (**19%**)
- H4 guard: PASS

This validates activation reach, not outcome quality. The missed sample contains broad analysis prompts and some sessions whose first prompt was `test`; improve only with a new canary and a one-variable A/B.

### Transcript-pruner KEEP A/B

`node bench/live-keep-ab.mjs --json` ran against the deployed extension and deterministic transcript:

| KEEP | Saved chars | Est. tokens | Clear / dup / stale | Gate |
|---:|---:|---:|---:|:---:|
| 2 | 2,829 | 707 | 7 / 4 / 1 | PASS |
| 3 | 2,681 | 670 | 6 / 4 / 1 | PASS |
| 4 | 2,533 | 633 | 5 / 4 / 1 | PASS |
| 6 | 2,237 | 559 | 3 / 4 / 1 | PASS |

Monotonicity and sink-write checks passed. KEEP=3 saves only 5.8% more than KEEP=4 on this synthetic transcript, below the existing 10% consideration bar. **Recommendation: keep KEEP=4; do not reopen the lock.**

### Trajectory/error panel

`python3 bundled-skills/harness-doctor/scripts/trajectory_metrics.py --days 30`

- 915 sessions
- 2,527 tool errors
- 9,253 retry loops
- Error classes: other 1,182; policy 500; MCP bridge 345; tool interface 320; env path 180

This is the strongest remaining measurement lead, but it is observational. It does not justify a runtime change by itself.

## Decision

1. Baseline is healthy enough to support controlled measurement: preflight, semantic gates, deterministic workload, and cache accounting all ran successfully.
2. Do not change KEEP, compaction, TSCG, or add an optimizer layer.
3. The next experiment should target **error/retry reduction**, not token compression. First classify the 9,253 retry loops into actionable recurring signatures and establish a small held-out error canary.
4. The existing Attention-kind-derived output contract is already present in `APPEND_SYSTEM.md`; no presentation A/B is justified until a target-model semantic/scannability canary exists.

## Reproduction

Run from the repository root:

```text
bash scripts/harness-preflight.sh
python3 bundled-skills/harness-doctor/scripts/inventory.py --verify
python3 bundled-skills/harness-doctor/scripts/config_hash.py
bash bench/semantic-canary.sh
bash bench/probe.sh baseline-20260813
bash bench/measure.sh 3
node bench/ce-lite-preload-ab.mjs --json
NODE_PATH=/home/alex/.local/share/pi-node/node-v22.23.1-linux-x64/lib/node_modules/prime-agent/node_modules node bench/live-keep-ab.mjs --json
python3 bundled-skills/harness-doctor/scripts/trajectory_metrics.py --days 30
```
