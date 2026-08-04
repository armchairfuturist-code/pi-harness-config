# Autoresearch: Pi Token Efficiency via Config + System-Prompt Slimming

## Objective
Reduce **input tokens per realistic coding task** without sacrificing task
success. Based on session-history analysis (2.2GB of `/tmp` pi-e tests, heavy
bash/read/grep/shake usage) and 2026 harness-engineering research (token-maxing
anti-pattern, system-prompt slimming, ToolFusion-style dedup). Cache hits are
already 87–93% on your providers, so the remaining lever is **per-request input
size**: system prompt + thinking tokens + tool I/O.

## Metrics
- **Primary**: `total_input_tokens` (lower is better) — measured via
  `pi-cache-optimizer-stats.json` delta, parsed with `jq` (Python is
  shell-allowlist-blocked).
- **Secondary**: `task_success` (1/0) — backup file must exist after task.
  Guard against "cheating": a config that drops tokens but breaks the task is
  **discarded**, never kept.

## How to Run
`./.auto/measure.sh` — outputs `METRIC total_input_tokens=N` and
`METRIC task_success=0|1` lines. Runs pi on a fixed task with a fixed tracked
model, measures token delta from cache-optimizer stats.

## Benchmark Task (fixed, deterministic)
"Use a bash command to copy /home/alex/Projects/AGENTS.md to
/tmp/agents_backup.md. Then read /tmp/agents_backup.md and report how many
lines it contains."

- Exercises bash + read tools (realistic agent workload).
- Input file `AGENTS.md` is static → consistent token measurement.
- Success = `/tmp/agents_backup.md` exists (verified via `test -f`).

## Model (fixed, tracked in stats)
`opencode-zen/xiaomi/mimo-v2.5` — the model your `opencode-zen/big-pickle`
default resolves to; 93% cache hit, 512K total input tokens historically.

## Files in Scope
- `/home/alex/.pi/agent/settings.json` — modify `packages` array (add/remove
  `npm:pi-slim`), `defaultThinkingLevel` (low/medium), `compaction`
  (reserveTokens/keepRecentTokens).

## Off Limits
- Do NOT break pi loading (invalid JSON, missing deps).
- Do NOT sacrifice task success for tokens (guarded by `task_success`).
- Do NOT install heavy/deprecated-dep packages (security: pi-dcp held for XSS).
- Do NOT modify source code of installed packages — only config.

## Constraints
- Sequential runs only (stats are aggregated; no concurrency).
- Use `jq` for all JSON parsing (Python `import` is shell-blocked).
- The cache-optimizer stats reset daily; run experiments within one day or
  track deltas carefully.

## Avenues Under Test
1. **pi-slim** (v0.2.1) — slims default system prompt (doc guidance opt-in via
   `/pi`). Directly cuts per-request input tokens. Smoke-tested: loads clean, 0
   vulns.
2. **defaultThinkingLevel** — currently `low` (4096-token budget). Test
   `medium` (10240) to see if it helps hard tasks (may increase tokens).
3. **compaction.reserveTokens** — currently 60000 (fires at 70%). Test 40000
   (fires earlier) / 80000 (fires later). Note: short benchmark task may not
   trigger compaction, so this mostly affects long sessions.

## What's Been Tried
- Baseline config (this session): thinking=low, compaction=60000/10000,
  pi-readcache installed (re-read caching), tscg=aggressive,
  context-prune=agent-message. Cache hits 87–93%.
- pi-dcp: HELD — HIGH XSS advisory in deprecated `@mariozechner/pi-coding-agent`
  dep; built on old pi fork v0.73.1. Security review needed before use.
- pi-smart-router: BROKEN on Linux (native deps don't compile).
- pi-dynamic-workflows / pi-auto-router: routing decision deferred (separate
  from this token-efficiency experiment).
