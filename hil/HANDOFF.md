# HANDOFF — continue HIL — 2026-08-08

**Status:** Iter 13 done (auto-compaction characterized; **no unlock**). Ready for **Iter 14**.
**Repo:** `/home/alex/Projects/pi-harness-config` · `origin/master`
**Shell for user-facing commands:** fish

## Do NOT redo

| Iter | Result |
|------|--------|
| 5 | TSCG strip KEEP |
| 8 | rot-sentinel |
| 9 / 9b | prune-core + det gate; **KEEP=4** |
| 10 | unattended-loop + fast-fail |
| 11 | re-baseline; build-variant copies extensions/lib |
| 12 | strip A/B; **maxDescChars=20 KEEP** |
| 13 | auto-compact char — trigger @ **>500288** on Lilac glm-5.2; **no unlock** |

**Locked:** KEEP=4 · reserve=24000 · keepRecent=20000 · tscg strip on · maxDescChars=20

## Smoke (fish)

```fish
cd ~/Projects/pi-harness-config
node bench/workload-deterministic.mjs
and node bench/auto-compact-char.mjs
and ./scripts/harness-preflight.sh
```

## Baseline

- Iter12: `hil/traces/20260808T070906-iter12-maxdesc20-20260808T070906Z.json` (probe ~2832 / schema 6529)
- Compaction evidence: `research/auto-compact-char-20260808.md` + `.scratch/bench-results/iter13-auto-compact-char.json`

## Iter 13 takeaway (do not remeasure unless model window changes)

```
shouldCompact = contextTokens > contextWindow - reserveTokens
```

- Lilac `zai-org/glm-5.2` window **524288** → fire only **> 500288** tokens
- Locked reserve 24k vs default 16k: trigger **7.6k earlier** only; keepRecent already matches upstream (20k)
- Auto-compact **dormant** for normal sessions; unlock not justified

## Recommended next (pick ONE)

HIL is intentionally **paused** — no pressing token levers remain. Only resume on regression or new evidence.

### A — ~~Verify noise band~~ DONE (2026-08-08 hygiene)

`hil/verify.sh` now has `WORKLOAD_NOISE=8000` + `PROBE_WORSE` guard: workload |Δ| < 8000 is neutral, and workload can no longer ACCEPT over a worse probe.

### B — Further TSCG (small, optional)

- maxDesc **20→10 or 0** with probe A/B + tool-call quality smoke
- Diminishing returns; strip already did the bulk

### C — Smaller-window model path (only if product needs it)

- If a ≤128k model becomes primary, re-run `bench/auto-compact-char.mjs` and reconsider reserve HIL
- Do not freestyle unlock on glm-5.2 evidence alone

## Method

1. Smoke / preflight  
2. **One** change  
3. `hil/observe.sh` → `hil/verify.sh <baseline> <label>` (when knobs change)  
4. Append `hil/ledger.md`  
5. Rewrite this HANDOFF + `~/.pi/.scratch/WORKSTATE.md`  
6. Commit + `git push origin master`  
7. Stop  

## Provider exit playbook

- **If Lilac is dropped:** re-pin bench variant (`bench/build-variant.sh` / `probe.sh` glm-5.2 → a Venice model), then re-baseline — all probe/trace numbers reset (cross-model numbers are not comparable). Locked absolute-token knobs (KEEP=4, 24k/20k, tscg) carry over unchanged.
- **Fallback providers:** Venice e2ee models; api.deepseek.com (v4 flash) per operator preference.
- **Config sync after any repo config edit:** `bash scripts/sync-live.sh` (repo → live; probe reads repo, sessions read live — do not edit only one).

## Paths

| What | Where |
|------|--------|
| Live TSCG | `~/.pi/tscg.json` |
| Repo TSCG (probe SoT) | `tscg.json` |
| Compaction settings | `settings.json` → `~/.pi/agent/settings.json` |
| Auto-compact bench | `bench/auto-compact-char.mjs` |
