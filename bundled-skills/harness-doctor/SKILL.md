---
name: harness-doctor
description: Inventory and audit local harnesses, providers, credentials, and Pi package health; add/remove providers safely; run preflight checks for broken shims, dead endpoints, and config drift; analyze context-rot in sessions (Wilson-interval bucketing, knee detection, 5 behavioral signals). Use when diagnosing harness errors, provider setup, command-not-found/shim failures, MCP bridge errors, context degradation, or system health.
---

# Harness Doctor

Pi-native replacement for the deleted OMP system-health-check. Use when the user asks to:
- inventory/audit harnesses, agents, providers, or credentials on this machine
- add or remove a provider across agents/harnesses
- explain or reduce repeated tool/agent errors (command-not-found, edit failures)
- analyze context rot / session degradation (merged from context-rot-forensics skill)
- diagnose MCP bridge errors or lean-ctx version drift

Curated context: `~/.pi/agent/memory/harnesses.md` (active/ghost inventory — update it after any mutation).

## Scripts (stdlib-only python3)

### 1. Inventory — `scripts/inventory.py`
```
python3 ~/.pi/agent/skills/harness-doctor/scripts/inventory.py [--verify]
```
Detects harnesses (binary + config dir, never name-match alone), providers per harness
(pi `models.json`, reasonix `config.toml [[providers]]`, codex app-server proxy),
env.d credential names, pi packages/extensions/skills. Writes snapshot to
`~/.pi/agent/harness-inventory.json`. `--verify` diffs against previous snapshot → drift report.

### 2. Provider ops — `scripts/provider_ops.py`
```
python3 .../provider_ops.py remove NAME [--with-env] [--apply]
python3 .../provider_ops.py add NAME --base-url URL --models a,b [--api KIND] [--key-env VAR] [--apply]
```
DRY-RUN by default; `--apply` mutates. Every mutation: snapshots to
`~/.pi/agent/harness-doctor-backups/<ts>/`, edits, re-validates (JSON/TOML parse),
residue-scan, auto-rollback on any failure. Codex is proxied (app-server catalog) —
reported, not edited. env.d credentials: reported always, removed only with `--with-env`;
`add` never writes secrets (prints the export line for the user).

### 3. Pre-flight — `scripts/preflight.py`
Validate environment BEFORE a suite/session spends tokens (survey §8.3): providers alive
(HTTP HEAD), harness binaries on PATH, **broken-shim exec-target scan** (catches hypa-class
failures), config JSON parse, extension paths exist, env.d credentials, bench rig present.
Exit 0 = green, 1 = any FAIL. First run caught 4 broken shims.

### 4. Trajectory metrics — `scripts/trajectory_metrics.py`
`--days N` / `--session FILE`: tool errors classified by harness layer (env_path /
tool_interface / mcp_bridge / policy / other) + retry-loop count. Baseline 2026-08-07:
1374 errors/30d (env_path 218, tool_interface 248, policy 214, mcp_bridge 96), retry_loops 6296.
Prior baseline 2026-07-30: 903 errors/30d (env_path 203, tool_interface 166, policy 115, mcp_bridge 38).

### 5. Config hash — `scripts/config_hash.py`
12-char hash over settings/models/APPEND_SYSTEM/tscg/package.json/extensions. Record in
every benchmark result; any change = canary suite re-run (survey §8.6.1). Baseline: `7aec62dd4a62` (2026-08-07; prior `bcb8dff8f834`).

### 6. Prefix-stability audit — `scripts/prefix_audit.py`
Reads `~/bench-systima/captures/<lane>/*.json`: per-lane distinct system-prefix hashes,
timestamped-prefix count, first-diff location. 2026-07-30: all celite lanes STABLE.

### 7. Context growth — `scripts/context_growth.py`
Fresh-token growth attribution: toolResult share of context bytes, clearing coverage,
tool-dominated vs conversation-dominated sessions. Baseline in script docstring.

### 8. Error audit
Ad-hoc: scan `~/.pi/agent/sessions/*/*.jsonl` for error taxonomies (see this session's
2026-07-30 audit for the pattern). Known resolved classes in `memory/consolidated.md`.

### 9. Read-cost panel — `scripts/read_cost.py`
Count ctx_read calls, result bytes (raw vs post-compression), miss/error rate, binary/boring-format
hit rate, extension distribution, top-read paths. Baseline: 3073 reads / 185 errors (6.0%) across
all sessions (2026-08-10). Run before and after smart-read skill adoption to measure impact.

### 10. Context-rot analysis — `scripts/rot-analysis.py` (merged from context-rot-forensics skill)
```
python3 .../rot-analysis.py              # top 5 sessions + summary
python3 .../rot-analysis.py --all        # all sessions
python3 .../rot-analysis.py --summary    # cross-session summary only
python3 .../rot-analysis.py <file.jsonl> # specific session
python3 .../rot-analysis.py --live <f>   # live-monitor active session
```
Implements the contextrot project's statistical methodology (Wilson-interval bucketing, knee
detection, 5 behavioral signals: tool_error, edit_failure, retry, reread, self_correction)
adapted for pi's JSONL format. Also tracks pi-specific signals: token bloat, output decline
(quartile analysis), compaction events, model swaps.

Uses `_session_utils.py` for shared error detection (two-tier: strict patterns in first 500
chars, broad keywords in first 200 chars). This is the single source of truth — also used by
`trajectory_metrics.py` and `read_cost.py`. Do not duplicate error detection logic.

Baseline (30 non-trivial sessions, Jul-Aug 2026): 4/30 sessions show knee detection, average
knee at 42% context fill / step 76 / 377K cumulative tokens. Handoff should trigger before
~28% fill. Signal frequency: tool_error 25.1%, reread 15.6%, retry 4.0%, edit_failure 0.3%,
self_correction 0.3% (post-false-positive-fix).

#### What ctx_stats / lean-ctx already provides (and what this adds)
- `lean-ctx stats` — aggregate token savings, compression rates
- This script adds: per-turn token growth curve, error clustering, re-read detection,
  output decline metric, collapse point estimation, cross-session patterns, live monitoring

## Shared utilities — `scripts/_session_utils.py`
Single source of truth for error detection and session parsing. All scripts that analyze
session JSONL files should import from this module. Key exports:
- `is_error_result(text)` — two-tier error detection (fixes 56% false-positive rate)
- `classify_error_layer(text)` — harness layer classification (env_path/mcp_bridge/etc)
- `parse_session(filepath)` — JSONL parser
- `extract_signals(entries)` — full contextrot behavioral signal extraction
- `wilson_interval(successes, n)` — statistical CI for rot curve
- `session_jsonls(limit)` — session discovery

## Rules
- After inventory mutations: update `memory/harnesses.md` (maintenance rule #1 there).
- provider_ops never touches `auth.json`, never prints secret values.
- If `~/.pi/agent/npm` packages change, note that context-mode has a local patch
  (NODE_OPTIONS export fix) that an upgrade will overwrite — re-apply per
  `memory/consolidated.md` gotcha entry.
