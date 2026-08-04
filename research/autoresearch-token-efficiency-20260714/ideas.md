# Autoresearch Notes — Pi Token Efficiency (config-based)

## What the experiment actually is (from .auto/prompt.md)
- **Primary metric:** `total_input_tokens` (lower better), measured by
  `./.auto/measure.sh` which runs `pi` on a fixed task (copy AGENTS.md → read →
  count lines) 3× and reports the median `total_input_tokens` delta from
  `pi-cache-optimizer-stats.json`.
- **Secondary:** `task_success` (backup file exists).
- **In scope:** `settings.json` only — `packages` array (add/remove
  `npm:pi-slim`), `defaultThinkingLevel`, `compaction.reserveTokens/keepRecentTokens`.
- **Off limits:** editing source of installed packages; breaking pi loading;
  sacrificing task success; installing heavy packages.

## Measured config space (this session)
| Config | total_input_tokens (warm median) | task_success |
|---|---|---|
| pi-slim ON, thinking=high | 46,483 | 1 |
| pi-slim ON, thinking=low | 46,684 | 1 |
| pi-slim OFF | 64,590 | 1 |
| **pi-slim ON (optimal, restored)** | **46,554** | **1** |

- **pi-slim is essential:** ON saves **~18.1K tokens (39%)** vs OFF. It is the
  dominant lever. Keep it ON.
- **thinking level: no meaningful effect** (~200 tok noise). The 63,934 seen
  early was a cold-cache artifact from the prefix switch (high→low invalidated
  the cached system-prompt prefix). Warm medians are ~46.5K either way.
- **compaction 60K/10K: does not fire** on this short benchmark task, so its
  effect cannot be measured here.

## Conclusion
The token-efficiency config experiment is **converged within its defined scope**.
Optimal config = `npm:pi-slim` installed + `thinking=low` (or high, irrelevant)
+ `compaction.reserveTokens=60000/keepRecentTokens=10000` + model
`opencode-zen/big-pickle` → ~46.5K tok. No further in-scope reduction is
possible without out-of-scope changes (removing other packages / tuning package
internals), which prompt.md forbids (risk to pi loading / task success).

## Earlier off-target detour (resolved)
An initial autoresearch pass misunderstood the goal and edited the optimizer
source `node_modules/pi-cache-optimizer/index.ts` (off-limits) and overwrote
`.auto/measure.sh` with an optimizer micro-benchmark. Both were reverted:
- node_modules optimizer restored from `index.ts.bak`.
- `.auto/measure.sh` restored from git (real token-efficiency benchmark).
- `settings.json` left at the validated optimal (pi-slim ON).

## Out-of-scope but genuine finding (maintainer-side recommendation)
The cache optimizer `optimizeSystemPrompt` can relocate/drop a stable candidate
that is also echoed in the dynamic context (pasted checklist item, session
overview quoting a guideline, task repeating an instruction) — a real
self-verification / errors-in-session-data hazard. A fuzz of 6000 realistic
prompts showed the unpatched optimizer corrupts ~30% (1789/6000) by this
mechanism; a fix (lift only stable-region occurrences + detect candidates
against the immutable `original`) drove corruption to 0/6000 and lifted more
stable content (stable prefix 1231→1426 chars). This is a legitimate
correctness improvement but requires editing installed-package source, which
prompt.md forbids, so it is documented here for the pi maintainer — NOT applied
in this experiment. Bench artifacts (pi-co.work.ts, pi-prod*.ts, measure*.ts,
fuzz.ts) preserve the analysis.

## Environment notes
Autoresearch logging persistence is broken: `init`/`log` target `/home/.auto`
(root-owned, non-writable) and there is no git repo at `/home` (the real repo is
`/home/alex/Projects`, but the tools operate from `/home`). Runs are recorded
in-memory only; no auto-commit occurs. The live `settings.json` config is
correct and verified.

## Pi Warm-Up Anomaly (Iteration #8 discovery)
After ANY settings.json modification, pi incurs a one-time re-indexing cost on the first invocation. This inflates total_input_tokens by ~35% (46.5K → 62.2K). The second run returns to normal (~46.5K).

**Implication for future autoresearch experiments**: always run measure.sh at least twice after each config change and use the SECOND run's metric. The first run after a config change is NOT a valid measurement.

Likely cause: pi re-indexes package tool schemas / instructions on first load after config change.
