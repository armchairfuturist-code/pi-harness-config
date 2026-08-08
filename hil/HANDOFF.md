# HANDOFF — continue HIL (tscg + next knobs) — 2026-08-08

**Status:** Iter 11 done + consumer docs pushed. Ready for **Iter 12** in a fresh session.  
**Repo:** `/home/alex/Projects/pi-harness-config` · remote `origin/master` @ `50ef9af`  
**Shell for user-facing commands:** fish (`and`/`or`, `set -x`)

## Do NOT redo

| Iter | Result |
|------|--------|
| 5 | `aggressiveStripParamDesc` KEEP (−1025 tok/turn probe) |
| 8 | rot-sentinel (parse fix 2026-08-08) |
| 9 / 9b | prune-core + det gate; live-keep-ab → **KEEP=4** |
| 10 | unattended-loop + fast-fail |
| 11 | re-baseline; `build-variant.sh` copies `extensions/lib/`; ctx-tool canary PASS |

**Locked (no freestyle):** KEEP=4 · reserveTokens=24000 · keepRecentTokens=20000 · tscg `aggressiveStripParamDesc: true`

## Smoke first (fish)

```fish
cd ~/Projects/pi-harness-config
node bench/workload-deterministic.mjs
and node bench/live-keep-ab.mjs
and ./scripts/harness-preflight.sh
```

Optional: `bash hil/canaries/ctx-tool-exercise.sh` (proxy + Lilac).

## Baseline for Iter 12

- Trace: `hil/traces/20260808T064135-iter11-baseline.json`
- Probe: **2737** tok / 17 tools (variant, glm-5.2) — schema 6701 chars, system 2876
- Workload median ~**24956** (±25% LLM noise on live non-det models)
- Absolute numbers **not** comparable to pre-0.84 / Aug-3 era — re-observe if config epoch changes

```fish
bash hil/observe.sh iter12-baseline
# then one change →
bash hil/verify.sh hil/traces/<new-or-iter11-baseline>.json iter12-<label>
```

## Recommended next work (pick ONE change per HIL iter)

### A — TSCG depth (preferred first)

**Already shipped:** Iter 5 strip via `patches/tscg/apply-patches.mjs` + `tscg.json`:

```json
{
  "enabled": true,
  "mode": "aggressive",
  "aggressiveMaxDescChars": 30,
  "aggressiveStripParamDesc": true,
  "cacheStablePrefix": true,
  "omitEmptyProperties": false
}
```

**Deploy path:** `tscg.json` → **`~/.pi/tscg.json`** (home root, **not** `~/.pi/agent/tscg.json`).  
Patches apply under `~/.pi/agent/npm/node_modules/` via install / `patches/tscg/apply-patches.mjs`.

**Candidate experiments (one at a time + verify):**

1. **Measure live strip efficacy** — probe `tool_schema_chars` before/after confirming patch sentinels `PI_HARNESS_TSCG_STRIP` / `PI_HARNESS_TSCG_STRIP_CALL` present in installed pi-tscg. If strip not applied after pi upgrade, re-run patcher + preflight.
2. **`omitEmptyProperties: true`** — small schema win; risk: some models hate missing empty `properties`. Gate on probe schema chars + workload checks.
3. **Lower `aggressiveMaxDescChars`** (30 → 20 or 0 for top-level only) — only if (2) is neutral; Iter 5 already strips **param** descriptions entirely.
4. **Do not** re-litigate full strip revert unless ctx-tool / workload canary shows tool-selection regressions.
5. **Docs/ledger cleanup:** Iter 11 Open (a) said “live tscg missing under agent/” — **wrong path**. Live correct file is `~/.pi/tscg.json` (install deploys it). Fix any remaining docs that say `agent/tscg.json`.

**Files to touch for TSCG work:**

| File | Role |
|------|------|
| `tscg.json` | settings flags |
| `patches/tscg/apply-patches.mjs` | idempotent node patch |
| `install.sh` MANIFEST | already copies tscg.json → `~/.pi/tscg.json` |
| `scripts/harness-preflight.sh` | should stay green after patch |
| `bench/probe.sh` / `hil/observe.sh` | measure schema chars + tokens |

### B — Auto-compaction characterization (still open)

- Loop `bench/compact-probe.mjs` over contextSizes 40k/80k/120k/160k/200k with `PI_COMPACT_PROBE=1`
- Document trigger vs `reserveTokens`/`keepRecentTokens` (locked 24k/20k — characterize, don’t retune unless clear win)
- Write `hil/findings/YYYY-MM-DD-compaction-threshold.md`

### C — Verify gate noise band

- Live workload ±25% variance; single-run Δ credited as ACCEPT in Iter 11
- Change `hil/verify.sh`: require workload Δ < −1500 **or** median of ≥3 runs; probe noise band already ±10

### D — Live package/settings drift (ops, not token experiment)

- Consumer path is `./install.sh` (see README). Machines with skinny package lists should reinstall pins.
- `install.sh` now installs **one** `pi install npm:pkg@version` per call (multi-arg was broken).
- Prefer `--skip-packages` if only files needed; full pin reinstall may take time / change versions.

## Consumer surface (already done — don’t redo)

- `README.md` — locked knobs + install destinations  
- `AGENTS.md` — pointer  
- `settings.json` includes **rot-sentinel**  
- `lean-ctx/env.tuning.sh` → **PI_PRUNE_KEEP=4**  
- Pushed: `50ef9af`

## HIL discipline

1. Smoke  
2. `hil/observe.sh` baseline (or reuse Iter 11 if no epoch change)  
3. **One** change  
4. `hil/verify.sh` + append `hil/ledger.md`  
5. Update this HANDOFF + `~/.pi/.scratch/WORKSTATE.md`  
6. `git commit` as `Alex Myers <alex@thearmchairfuturist.com>` + `git push origin master`

## Optional unattended

```fish
cd ~/Projects/pi-harness-config
./scripts/unattended-loop.sh --dry-run --goal "x"
# only if dry-run OK:
./scripts/unattended-loop.sh \
  --goal "HIL Iter 12: TSCG measure + one knob (see hil/HANDOFF.md)" \
  --cwd ~/Projects/pi-harness-config \
  --handoff ~/Projects/pi-harness-config/hil/HANDOFF.md \
  --max-generations 6 \
  --max-wall-min 180
```

## Quick resume prompt (paste into next session)

```
Continue pi-harness-config HIL from hil/HANDOFF.md and ~/.pi/.scratch/WORKSTATE.md.
Repo: ~/Projects/pi-harness-config (origin/master). User shell: fish.
Do not redo Iter 5/8/9/9b/10/11. KEEP=4 locked.
Preferred: Iter 12 TSCG — measure strip efficacy, then one of omitEmptyProperties / maxDescChars; observe → verify → ledger → push.
```
