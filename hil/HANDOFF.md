# HANDOFF — continue HIL (compaction / next knobs) — 2026-08-08

**Status:** Iter 12 done (strip measured + maxDescChars=20 KEEP). Ready for **Iter 13** in a fresh session.
**Repo:** `/home/alex/Projects/pi-harness-config` · remote `origin/master` (push after this iter)
**Shell for user-facing commands:** fish (`and`/`or`, `set -x`)

## Do NOT redo

| Iter | Result |
|------|--------|
| 5 | `aggressiveStripParamDesc` KEEP (−1025 tok/turn probe) |
| 8 | rot-sentinel (parse fix 2026-08-08) |
| 9 / 9b | prune-core + det gate; live-keep-ab → **KEEP=4** |
| 10 | unattended-loop + fast-fail |
| 11 | re-baseline; `build-variant.sh` copies `extensions/lib/`; ctx-tool canary PASS |
| 12 | strip A/B measured; **maxDescChars 30→20 KEEP**; omitEmptyProperties is phantom |

**Locked (no freestyle):** KEEP=4 · reserveTokens=24000 · keepRecentTokens=20000 · tscg strip on · **aggressiveMaxDescChars=20**

## Smoke first (fish)

```fish
cd ~/Projects/pi-harness-config
node bench/workload-deterministic.mjs
and node bench/live-keep-ab.mjs
and ./scripts/harness-preflight.sh
```

Optional: `bash hil/canaries/ctx-tool-exercise.sh` (proxy + Lilac).

## Baseline for Iter 13

- Trace: `hil/traces/20260808T070906-iter12-maxdesc20-20260808T070906Z.json`
- Probe: **2832** tok / 17 tools — schema **6529** chars, system 3308 (glm-5.2 variant)
- Prior iter11 baseline still valid for cross-check: `hil/traces/20260808T064135-iter11-baseline.json` (probe 2737 / schema 6701)
- Workload median ~**16–25k** (±25% LLM noise) — do not treat single-run Δ under ~8k as causal
- **TSCG bench note:** mutate **repo** `tscg.json` (build-variant copies it). Live `~/.pi/tscg.json` alone does not move probe. Prefer keep both in sync (`cp tscg.json ~/.pi/tscg.json`).

```fish
bash hil/observe.sh iter13-baseline
# then one change →
bash hil/verify.sh hil/traces/20260808T070906-iter12-maxdesc20-20260808T070906Z.json iter13-<label>
```

## Recommended next work (pick ONE change per HIL iter)

### A — Auto-compaction characterization (preferred)

Still untouched since Iter 9b lock.

- Instrument / log when auto-compaction fires under locked 24k/20k.
- Or dry-run threshold sensitivity **without** unlocking KEEP (observe only).
- Goal: evidence pack for whether reserve/keepRecent need a later HIL unlock — **do not freestyle unlock**.

### B — Further TSCG (optional, small)

Only if compaction work blocked:

- Real knobs in pi-tscg@0.1.5: `aggressiveMaxDescChars`, `aggressiveStripParamDesc`, `pruneJsonOverhead` (default true), `profile`, `enabled`.
- **Not a knob:** `omitEmptyProperties` (does not exist).
- Candidate: maxDesc **20→10 or 0** (top-level tool purpose only; params already stripped). Require probe A/B + tool-call quality smoke.
- Strip already delivers the bulk (−37% schema vs truncate-only; −81% vs TSCG off). Diminishing returns below 20.

### C — Verify noise band

- Workload gate still treats huge median swings as signal (Iter12 ACCEPT was workload-noise-heavy).
- Consider: require ≥3-run median, or ignore workload |Δ| < 8k when probe schema is the intended lever.

## Iter 12 results (do not remeasure unless regression)

| config | toolSchemaChars | usage.total |
|--------|-----------------|-------------|
| strip ON maxDesc=30 | 6701 | ~2877 |
| strip ON maxDesc=**20** (KEEP) | **6529** | ~2834 |
| strip OFF maxDesc=30 | 10682 | 3892 |
| TSCG off | 36340 | 9683 |

Artifacts: `.scratch/bench-results/iter12-strip-ab-summary.json`, `iter12-maxdesc-ab-summary.json`
Verify: `hil/verifications/20260808T071008-iter12-maxdesc20.json` ACCEPT

## Method (every iter)

1. Smoke / preflight
2. **One** change only
3. `hil/observe.sh` → `hil/verify.sh <baseline> <label>`
4. Append `hil/ledger.md` (KEEP/REVERT + learning)
5. Rewrite this HANDOFF + `~/.pi/.scratch/WORKSTATE.md`
6. Commit + `git push origin master`
7. Stop

## Paths

| What | Where |
|------|--------|
| Live TSCG | `~/.pi/tscg.json` (**not** `agent/tscg.json`) |
| Repo TSCG (probe source of truth) | `tscg.json` |
| Patches | `patches/tscg/apply-patches.mjs` → after package install |
| Capture tools path | `request.body.tools` |
| Baseline iter12 | `hil/traces/20260808T070906-iter12-maxdesc20-20260808T070906Z.json` |
