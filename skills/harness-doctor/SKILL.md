# Harness Doctor

Pi-native replacement for the deleted OMP system-health-check. Use when the user asks to:
- inventory/audit harnesses, agents, providers, or credentials on this machine
- add or remove a provider across agents/harnesses
- explain or reduce repeated tool/agent errors (command-not-found, edit failures)

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
tool_interface / mcp_bridge / policy / other) + retry-loop count. Baseline 2026-07-30:
903 errors/30d (env_path 203, tool_interface 166, policy 115, mcp_bridge 38).

### 5. Config hash — `scripts/config_hash.py`
12-char hash over settings/models/APPEND_SYSTEM/tscg/package.json/extensions. Record in
every benchmark result; any change = canary suite re-run (survey §8.6.1). Baseline: `bcb8dff8f834`.

### 6. Prefix-stability audit — `scripts/prefix_audit.py`
Reads `~/bench-systima/captures/<lane>/*.json`: per-lane distinct system-prefix hashes,
timestamped-prefix count, first-diff location. 2026-07-30: all celite lanes STABLE.

### 7. Context growth — `scripts/context_growth.py`
Fresh-token growth attribution: toolResult share of context bytes, clearing coverage,
tool-dominated vs conversation-dominated sessions. Baseline in script docstring.

### 8. Error audit
Ad-hoc: scan `~/.pi/agent/sessions/*/*.jsonl` for error taxonomies (see this session's
2026-07-30 audit for the pattern). Known resolved classes in `memory/consolidated.md`.

## Rules
- After inventory mutations: update `memory/harnesses.md` (maintenance rule #1 there).
- provider_ops never touches `auth.json`, never prints secret values.
- If `~/.pi/agent/npm` packages change, note that context-mode has a local patch
  (NODE_OPTIONS export fix) that an upgrade will overwrite — re-apply per
  `memory/consolidated.md` gotcha entry.
