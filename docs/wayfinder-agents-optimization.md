# Wayfinder: Agent Harness Optimization

## Goal

Analyze and optimize all three agent harnesses (OMP v16.4.3, Pi v0.81.1, OpenCode2) on this
machine to **minimize token consumption, eliminate configuration drift/bugs, and maximize
performance** — producing concrete **config fixes, cache hygiene rules, and benchmark-driven
recommendations**. Tracker: local markdown (no git repo). Skills to consult:
`diagnosing-bugs`, `ponytail`, `tdd`. Benchmark suite: `~/bench-systima/` (see "Benchmark suite" below).

> **Audit note (correction pass):** A prior agent rewrote this map with several false claims
> — most importantly marking ticket 03 "REVERTED" and treating the stale `pi-configuration.md`
> export as source of truth (backwards). It also recorded fixes that were never made (08) and
> "still broken" items that are non-issues (OMP default model). This map has been re-verified
> against the live filesystem on 2026-07-21 and corrected. Ground truth = live files, not the
> export doc.
>
> **Benchmark suite replaced (2026-07-22):** The custom `~/bench/` Terminal-Bench-style
> suite was deleted — false positives from stream-parsing token extraction (zero-token bugs),
> non-deterministic ambient state (find_in_files), and flaky test specs (git_commit_check
> expecting `main` branch from `git init` which creates `master`). Replaced with
> `~/bench-systima/` (systima-ai/agentic-coding-tools-comparison — HTTP proxy-based, tamper-evident
> audit log). Historical findings from the old suite are preserved below but must be re-validated.

## Decisions so far

- [01-omp-db-schema](tickets/01-omp-db-schema.md) — ✅ **RESOLVED** (premise corrected: the file
  *does* exist). `~/.omp/stats.db` (20 MB) is the metrics source. Tables: `messages`,
  `user_messages`, `tool_calls`, `file_offsets`, `meta`. `tool_calls` is a real SQL table
  (cols: `session_file, entry_id, tool_name, model, provider, timestamp, args_chars,
  result_chars, is_error`) — NOT JSONL-only as an earlier note claimed. `~/.omp/agent/agent.db`
  (888 KB) also exists but `stats.db` is the benchmark source.
- [02-opencode-db-schema](tickets/02-opencode-db-schema.md) — ✅ **RESOLVED** (premise corrected:
  the DB *does* exist). `~/.local/share/opencode/opencode-next.db` (51 MB, actively written).
  `session` table has `tokens_input, tokens_output, tokens_reasoning, tokens_cache_read,
  tokens_cache_write, cost`. `message` table has `data` JSON. Benchmark query is valid as-is.
- [03-pi-config-drift](tickets/03-pi-config-drift.md) — ✅ **RESOLVED** (re-applied correctly
  after a bad revert). `~/.pi/agent/settings.json` set to `defaultProvider: opencode-zen`,
  `modelRoles.default: lilac/moonshotai/kimi-k2.6`, `defaultThinkingLevel: low`,
  `keepRecentTokens: 10000`, full 15-package list. Added the 3 genuinely-missing packages
  (`@hypabolic/pi-hypa`, `pi-context-prune`, `pi-readcache`); **kept** `pi-subagents` + `pi-btw`
  (installed and load-bearing — an earlier agent wrongly deleted them by treating the stale
  `pi-configuration.md` export as authoritative). `opencode-zen` is a built-in provider
  (`OPENCODE_ZEN_API_KEY` is in env); `models.json` listing only `Lilac` is not a contradiction.
- [04-omp-mcp-restore](tickets/04-omp-mcp-restore.md) — ✅ **RESOLVED** (verified). `mcp.json`
  has `context-mode`, `context7` (http), `ponytail` (node). Minor: the `$schema` line from
  `mcp.json.bak` was dropped — optional to restore.
- [05-omp-model-discrepancy](tickets/05-omp-model-discrepancy.md) — ✅ **RESOLVED** (verified).
  `config.yml modelRoles.default = opencode-zen/hy3-free:xhigh`, matches `CRITICAL_MEMORIES.md`.
  `opencode-zen` is a built-in provider (correctly absent from `models.yml`). The earlier "still
  broken" worry that this conflicts with Pi's `models.json` was a **non-issue** — OMP and Pi
  have independent provider configs.
- [06-opencode-agents-md](tickets/06-opencode-agents-md.md) — ✅ **RESOLVED** (verified).
  `~/.config/opencode/AGENTS.md` has `<!-- lean-ctx-rules --> <!-- version: 8 -->` (15 rule
  matches). File pre-existed (jul 13); no action was actually needed.
- [07-api-key-security](tickets/07-api-key-security.md) — 🔶 **OPEN / SCOPE DECISION**. Plaintext
  keys in `opencode.json` + `auth.json` are documented *by design* in `pi-configuration.md`
  ("OpenCode does not read env vars here"). This is a security concern, NOT token/drift/perf —
  i.e. outside this wayfinder's destination. **Propose: move to Out of scope** unless you want a
  separate security pass.
- [08-omp-lean-ctx](tickets/08-omp-lean-ctx.md) — ✅ **ALREADY SATISFIED** (prior "FIXED v6→v8"
  claim was unverified/false: `~/.omp/AGENTS.md` has no version marker and pre-existed jul 13).
  OMP already enforces lean-ctx via `~/.omp/AGENTS.md` (9 ctx refs) + `SYSTEM.md` (4) +
  `APPEND_SYSTEM.md` (1). OMP has no `rules/` dir by design (uses SYSTEM.md). No action needed.
- [09-cache-bloat](tickets/09-cache-bloat.md) — 🔴 **OPEN** (real, numbers corrected).
  Pi context-mode `content/` = 39 MB (one db alone = 34 MB: `29c2834bd7887657.db`),
  `sessions/` = 341 stat files. OMP `blobs/` = 6.5 MB / 430 files. Directly serves the "cache
  hygiene" deliverable.
- [10-pi-duplicate-rtk](tickets/10-pi-duplicate-rtk.md) — ✅ **RESOLVED** (verified).
  `rtk.ts.disabled` removed (only `rtk.ts` active); missing packages restored via ticket 03.

## Benchmark suite

**`~/bench-systima/`** — cloned from `systima-ai/agentic-coding-tools-comparison` on 2026-07-22.
HTTP proxy-based measurement rig: sits in front of the API endpoint, captures actual
request/response payloads, produces tamper-evident audit logs (SHA-256 chain). No stream
parsing, no `TOKENS_USED:` emission. Token counts are authoritative from the wire.

Supports OMP, Pi, OpenCode2 — any harness hitting an OpenAI-compatible API. Configure
`UPSTREAM_URL`, point each harness at the proxy, run lanes via `rig/run-lane.sh`, aggregate
with `rig/analyse.mjs`. See README for setup.

**Old custom suite (deleted 2026-07-22):** `~/bench/` was a 6-task Terminal-Bench-style runner
with per-harness wrappers. Deleted due to unreliable token extraction (stream parsing →
zero-token bugs), non-deterministic test state (find_in_files seeded nothing), and broken test
specs (git_commit_check expected `main` branch from `git init`). Historical findings preserved
in "What's still broken" below for reference but must be re-validated with the new rig.


## Out of scope

(proposed)
- 07-api-key-security (security, not token/drift/perf) — pending your confirmation.

## Open tickets

| Ticket | Type | Status | Description |
|--------|------|--------|-------------|
| 07-api-key-security | task | 🔶 scope | Plaintext API keys — security, not perf (propose out-of-scope) |
| 09-cache-bloat | task | 🔴 open | Cache hygiene: 39 MB ctx-mode content, 341 sessions, 6.5 MB OMP blobs |

## What's still broken / needs attention

1. **Cross-harness benchmark — FIRST CLEAN BASELINE (2026-07-22).** Proxy-based measurement
   via `~/bench-systima/`. Same model (`zai-org/glm-5.2` via Lilac), same task, tokens captured
   at HTTP wire. Results in `~/bench-systima/results/comparison.md`.

   | Harness | Requests | System Prompt | Tools | Total Input Tokens | Total Output Tokens |
   |---------|----------|---------------|-------|--------------------|--------------------|
   | OMP | 3 | 22,518 ch | 11 | 50,533 | 119 |
   | Pi | 2 | 1,731 ch | 29 | 20,369 | 121 |
   | OpenCode2 | — | — | — | BLOCKED | — |

   **Key finding: Pi uses 60% fewer input tokens than OMP** (20,369 vs 50,533). OMP's system
   prompt is 13× larger (22,518 ch vs 1,731 ch). Despite more tools (29 vs 11), Pi's total
   tool schema is smaller (36,209 ch vs 43,736 ch). Pi completed in 2 API calls vs OMP's 3.
   Neither harness uses prompt caching (cacheWrite=0).

   **OpenCode2 blocked**: `opencode2 run --model <any>` fails with "Model unavailable" for all
   model ID formats (v0.0.0-next-16010 non-interactive model resolution bug). Without `--model`,
   falls back to `laguna-s-2.1-free`, bypassing the proxy.

   **Previous custom suite findings invalidated**: The old suite showed OMP as more efficient
   (18.9K vs 32.8K avg tokens/task) — that was an artifact of broken stream-parsing and
   non-deterministic model selection. Proxy-based measurement reverses the conclusion: Pi is
   more token-efficient, driven by its lean system prompt.

   Next: (a) expand to multi-task suite for statistical significance; (b) test with longer
   sessions to measure context growth and caching behavior; (c) file OpenCode2 bug upstream.
2. **Cache cleanup (ticket 09)** — real bloat, see numbers above. Needs an age-based prune +
   SQLite VACUUM plan.
3. **OMP `mcp.json` missing `$schema` line** — minor drift (`.bak` has it). Optional.

## Benchmark assets

- `~/bench-systima/` — systima-ai/agentic-coding-tools-comparison (proxy-based, cloned 2026-07-22)
- `~/Projects/.auto/measure.sh` — Pi token-efficiency autoresearch script (source of the
  ~46.5K finding in `pi-configuration.md` §5c). Different methodology than the proxy suite.

**Deleted (2026-07-22):** `~/bench/` (custom suite), `~/benchmark-harnesses.sh` (ad-hoc script),
`~/.config/harness-benchmark.json` (system-health-check pointer), `~/workflows/harness-efficiency.md`
(improvement workflow), `~/workflows/harness-metrics.md` (metrics log).

## Non-issues (recorded so we stop re-fixing them)

- OMP default model vs Pi `models.json` — independent configs; `opencode-zen/hy3-free:xhigh` is
  correct per `CRITICAL_MEMORIES.md`.
- `pi-subagents` / `pi-btw` packages — load-bearing; do NOT remove.
- `opencode-zen` provider "missing from models.json" — it's built-in; `OPENCODE_ZEN_API_KEY` is
  in env.
- OMP having no `rules/` dir — by design; enforcement is via `SYSTEM.md`.

## Key file paths

- `~/.pi/agent/settings.json` — Pi runtime config (RESOLVED: full 15-pkg list, opencode-zen)
- `~/.pi/agent/models.json` — Pi provider defs (Lilac; opencode-zen is built-in)
- `~/.pi/agent/auth.json` — Pi API keys (plaintext, by design)
- `~/.omp/agent/config.yml` — OMP model roles (RESOLVED: opencode-zen/hy3-free:xhigh)
- `~/.omp/agent/mcp.json` — OMP MCP servers (RESOLVED: 3 servers; `$schema` line dropped)
- `~/.omp/AGENTS.md` — OMP agent rules (lean-ctx present; no version marker)
- `~/.omp/agent/SYSTEM.md` — OMP tool enforcement (lean-ctx present)
- `~/.config/opencode/AGENTS.md` — OpenCode2 rules (lean-ctx v8)
- `~/.config/opencode/opencode.json` — OpenCode2 provider config (has API keys, by design)
- `~/bench-systima/` — proxy-based benchmark suite (systima-ai/agentic-coding-tools-comparison)
- `~/Projects/.auto/measure.sh` — Pi token autoresearch script
- `~/pi-configuration.md` — point-in-time export (2026-07-14); NOT source of truth
- `~/wayfinder-agents-optimization.md` — This map
- `~/wayfinder-agents-optimization/tickets/` — Individual ticket files
