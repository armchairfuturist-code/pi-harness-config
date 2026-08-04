# Closed: Pi Token Efficiency via Config (2026-07-14) — SUPERSEDED

**Status:** CLOSED 2026-08-04. No mergeable product branches (all commits were `.auto/*` session files; live config lived outside git).

## Verdict
Within the defined scope (settings.json packages/thinking/compaction only), the run **converged**:

| Lever | Result |
|-------|--------|
| pi-slim ON | **KEEP** — ~2% input tokens warm (46,145 → 45,196); later ideas.md remeasure saw larger gap when OFF |
| thinking medium | **DISCARD** — +44% on simple task |
| compaction 60K/10K | Keep as long-session guard; short tasks +1.3% overhead; 5K keep risky |
| Model switch cold | +12–13% (cache penalty) |
| Final stable | ~45–46.5K on fixed copy+read task |

## Why closed (not finalized into branches)
1. Wrong git root (`/home/alex/Projects` workspace, not `pi-harness-config`).
2. No trunk/`main`; only experiment commits.
3. Valuable delta was live `settings.json` + already-vendored kernel in pi-harness-config (pi-slim, tscg=5, compaction 24K/20K, skills gate).
4. Superseded by later harness-config campaigns (terseness, thinking, tscg chars, transcript-pruner, celite suite).

## Carry-forward (already absorbed or obsolete)
- pi-slim in kernel packages — **done** in repo settings.json
- Warm-up anomaly: first pi invoke after settings change inflates ~35%; measure 2nd run — **bench practice**
- Cache-optimizer self-verify hazard — documented in ideas.md; out of scope (package source)
- Compaction economics — refined later; live now `reserveTokens=24000 keepRecentTokens=20000`

Do not re-run this campaign. Next work: long-session tool-result clearing / kernel earning tests in pi-harness-config.
