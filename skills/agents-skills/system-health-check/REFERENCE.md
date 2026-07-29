# System Health Check — Reference

Loaded only when the skill fires. Contains mutable configuration and known paths, keeping SKILL.md focused on the execution model.

## Known paths

### OMP agent
| Path | Purpose |
|---|---|
| `~/.omp/agent/mcp.json` | MCP server definitions |
| `~/.omp/agent/models.yml` | Model IDs and provider mappings |
| `~/.omp/agent/config.yml` | Agent config |
| `~/.omp/agent/APPEND_SYSTEM.md` | System prompt additions (RTK, Context-Mode, Context7 sections) |
| `~/.omp/agent/CRITICAL_MEMORIES.md` | Canonical critical facts |

### Mimo agent
| Path | Purpose |
|---|---|
| `~/.mimocode/mimocode.json` | Mimo config (providers, MCP servers, models) |
| `~/.mimocode/CRITICAL_MEMORIES.md` | Canonical critical facts for Mimo |
| `~/.config/mimocode/mimocode.jsonc` | Seconary config source (.jsonc format) |

### RTK
| Path | Purpose |
|---|---|
| `~/.config/rtk/config.toml` | RTK runtime config |
| `~/.config/rtk/filters.toml` | RTK output filter definitions |

### Drift anchor (baseline)
| Path | Purpose |
|---|---|
| `~/.local/state/system-health-baseline.json` | Reference state for performance comparisons |
### Session errors
| Path | Purpose |
|---|---|
| `~/.local/bin/session-error-scan` | Session error scanner (HTTP 400s, OMP logs, RTK parse failures) |
| `~/.local/state/session-error-snapshot.json` | Cross-run delta state for session errors |
### Credentials
| Path | Purpose |
|---|---|
| `~/.config/env.d/*.sh` | Single source of truth for all API keys |

### Harness benchmark
| Path | Purpose |
|---|---|
| `$HARNESS_BENCHMARK` (env) or `~/.config/harness-benchmark.json` | Location of the agent-harness benchmark suite + tokens/task accounting. If unset or absent, the Harness Efficiency probe records `skip`, not `fail`. |

## Known MCP servers

These servers are defined in `~/.omp/agent/mcp.json`. The probe reads from the file — not from this list — so user-added servers are detected automatically.

| Name | Type | Health check |
|---|---|---|
| context-mode | local command | `ctx stats` responds or check mcp process |
| context7 | remote HTTP | Endpoint `https://mcp.context7.com/mcp` |
| ponytail | local command | Check node process |

## Drift correction rules

| Condition | Action | Rationale |
|---|---|---|
| MCP process dead | Restart via original command | Idempotent, unambiguous, no data loss |
| Stale model ID | Remove it from config | Unambiguous dead entry |
| Missing env var | Regenerate from `~/.config/env.d/*.sh` | Single source of truth, deterministic |
| Git repo behind upstream | `git pull` | Safe for clean working trees |
| Session errors flagged | Flag only | No automated fix — data for human triage |
| Memory fact missing | Inject via `retain` | No side effects, checksum-safe |
| CPU temp high | Flag only | May be transient load, not a fixable state |
| Token savings drift | Flag only | Needs human judgement |
| Historical recommendation | Flag only | Needs human judgement |
| Git conflict (dirty + behind) | Flag only | Needs human resolution |
| Config unparseable | Flag only | Auto-edit could compound corruption |
| Harness benchmark drift | Flag only | Improvement is the on-demand harness-efficiency.md loop |

## Thresholds

| Metric | Threshold | Notes |
|---|---|---|
| CPU temperature | +15°C above anchor | |
| GPU temperature | +15°C above anchor | |
| Memory pressure | +20% above anchor | |
| Token savings (RTK) | -3 pp below rolling anchor | 7-day window |
| MCP consecutive failure | 3 runs → escalate | Counter stored in anchor file `failure_count` field per server |
| Session errors | Any new high-severity errors since last scan | `session-error-scan` drift = `drifted` |
| Benchmark score | -3 pp below anchor | Composite harness task score |
| Tokens per task | +10% above anchor | From benchmark run or harness accounting |

## GPU detection order

1. `nvidia-smi` — standard NVIDIA
2. `sensors -j` — look for `amdgpu`, `k10temp`, `xe` sections
3. `/sys/class/drm/*/device/hwmon/*/temp1_input` — direct sysfs

First to return a value wins. If nothing returns → `unknown`.


## Agent session adapters

### OpenCode

Agent-specific probe source for Workflow Reflection (probe set 7). Use when
`~/.local/share/opencode/opencode.db` exists.

**Session discovery:**
```bash
bun -e "import Database from 'bun:sqlite'; const db = new Database('$HOME/.local/share/opencode/opencode.db'); console.log(db.query('SELECT id, directory, title, agent, model, time_created, cost, tokens_input, tokens_output FROM session ORDER BY time_created DESC LIMIT 20').all())"
```
Session table: `id, directory, title, agent, model, time_created, cost, tokens_input, tokens_output`

**Session messages** (for per-session analysis):
```bash
bun -e "import Database from 'bun:sqlite'; const db = new Database('$HOME/.local/share/opencode/opencode.db'); console.log(db.query('SELECT data FROM message WHERE session_id = ?').all('SESSION_ID'))"
```
Message table: `id, session_id, time_created, time_updated, data` (JSON with role, agent, model, summary)

**Session summaries** cached at `~/.config/opencode/oh-my-opencode-slim/reflections/sessions/`.
Skip analysis if `<session-id>.json` already exists there.

## Known critical facts

These anchor the memory integrity probe set. Source: `~/.omp/agent/CRITICAL_MEMORIES.md`.

- RTK uses OMP extension, NOT Claude Code hook — "no hook installed" warning on `rtk gain` is harmless.
- RTK baseline: ~67.8% savings, ~412M tokens, ~2400 commands.
- MCP configs use `"type": "http"` for remote servers (OMP syntax).
- Context-Mode: MCP service for context-window protection; verify with `ctx stats`.
- Context7 endpoint: `https://mcp.context7.com/mcp` (MCP protocol, SSE).
- Ponytail: `full` intensity by default.
- Nahcrof proxy is the primary provider; direct deepseek is secondary.
- Minimax provider was added then removed — API key was invalid.
- Deepseek DIRECT models were duplicates — removed, re-added with correct IDs.
- Credentials live in `~/.config/env.d/*.sh`, NOT inlined in agent configs.

## Drift report format

Write to `/tmp/system-health-brief.md`:

```
# Drift Report — YYYY-MM-DD

Corrections applied:
  - context-mode verified active (ctx stats responds)
  - stale model ID 'minimax-m2.5' removed

Drift detected:
| Probe set | Probe | Outcome | Anchor | Current | Delta |
|---|---|---|---|---|---|
| System perf | CPU temp | fail | 54°C | 71°C | +17°C |
| AI config | Token savings | fail | 67.8% | 65.2% | -2.6 pp |

Notes:
- ~/gpu-tweaks.md recommends module_blacklist=amdgpu — still set. ✓
```
