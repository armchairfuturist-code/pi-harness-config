# HANDOFF after Iter 11 — 2026-08-08

Status: Iteration 11 completed cleanly (re-baseline + probe repair + ctx-tool canary KEEP). HIL loop is ready for the next iteration in a fresh session.

Do NOT redo: Iter 5 (tscg strip), 8 (rot-sentinel), 9 (prune-core + det workload), 9b (live KEEP A/B), 10 (unattended-loop + fast-fail), 11 (re-baseline + build-variant lib repair + ctx-tool canary). KEEP=4 locked; compaction thresholds unchanged.

## What Iter 11 did

1. Re-baseline: `hil/traces/20260808T064135-iter11-baseline.json` — probe 2737 tok / 17 tools (glm-5.2 variant), workload median 24956 (runs 24022–33114), det gate ok, live KEEP ok (`keep_default_4`).
2. Repaired `bench/build-variant.sh`: copies `extensions/lib/` (Iter 9's `prune-core.mjs` home) into variant homes — variant `pi` boots had been crashing, probe was null.
3. Implemented + ran ctx-tool canary (Iter 8 OPEN): `bash hil/canaries/ctx-tool-exercise.sh` → PASS (all six of ctx_ls/find/read/grep/index/search invoked; validator `bench/validate-ctx-canary.mjs`).
4. Verify vs baseline: gate ACCEPT (probe Δ−4; workload delta was a variance outlier — resample back in range). Effectively NEUTRAL, KEEP.
5. Ledger: `hil/ledger.md` Iteration 11.

## Why old numbers don't compare

Live agent drifted since Iter 10 (2026-08-03): default model/provider machine-local (often Venice), live `settings.json` packages/extensions can lag repo until `./install.sh`, pi upgraded to 0.84.x. **TSCG path is `~/.pi/tscg.json`** (not `agent/tscg.json`) — install deploys there; strip is on when that file matches repo. Always re-baseline after pi/provider epochs change.

## Smoke before any new work

```fish
cd ~/Projects/pi-harness-config
node bench/workload-deterministic.mjs
and node bench/live-keep-ab.mjs
and bash hil/canaries/ctx-tool-exercise.sh
```

## Next iteration candidates (pick one change)

- **a. Reconcile live settings to repo:** run `./install.sh` on machines whose `~/.pi/agent/settings.json` packages/extensions lag (rot-sentinel + full package lock). Provider/model preserved unless `--settings`.
- **b. Auto-compaction characterization:** loop `bench/compact-probe.mjs` over contextSizes 40000/80000/120000/160000/200000 with `PI_COMPACT_PROBE=1`; document trigger threshold; write `hil/findings/`.
- **c. Verify gate noise band:** `hil/verify.sh` workload gate currently credits single-run LLM variance as improvement; require Δ < −1500 tok or compare medians of ≥3 runs.

## Consumer docs

`README.md` is the install + locked-knobs surface for other agents reading GitHub. Keep it in sync when knobs change.

## Unattended-loop usage (optional)

```fish
cd ~/Projects/pi-harness-config
./scripts/unattended-loop.sh --dry-run --goal "x"   # sanity first
# only after dry-run OK:
./scripts/unattended-loop.sh \
  --goal "Continue HIL from WORKSTATE" \
  --cwd ~/Projects/pi-harness-config \
  --handoff ~/Projects/pi-harness-config/hil/HANDOFF.md \
  --max-generations 8 \
  --max-wall-min 240
```

## Locked knobs

KEEP=4 · reserveTokens=24000 · keepRecentTokens=20000 · tscg aggressiveStripParamDesc (repo)

## Git

Repo working tree carries uncommitted HIL work (hil/, bench/, extensions/, scripts/, docs/, research/) plus audit-2026-08-07 edits (install.sh, patches/tscg/, tscg.json). Iter 11 session committed the tree as the HIL checkpoint — see `git log` before adding more.
