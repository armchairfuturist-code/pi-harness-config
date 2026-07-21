---
name: system-health-check
description: Morning ritual — run all drift probes, correct where safe, present a brief report.
user-invocable: true
disable-model-invocation: true
argument-hint: run
---

# System Health Check
## Before starting

Read `skill://system-health-check/REFERENCE.md` and `skill://system-health-check/CONTEXT.md`.

## Probe sets (in execution order)

Each probe set is autonomous: failures in one do not block another. Each
produce their outcomes into a shared drift report (`/tmp/system-health-brief.md`).

A probe set is complete only when every probe in it has an unambiguous outcome
recorded. Until then, do not advance to the next set.

### 1. MCP Health

**When**: every MCP server defined in `~/.omp/agent/mcp.json` has been probed
and its outcome recorded. Servers not listed in `mcp.json` are not probed.

Probe each server:
- **Local command** — check if the process is running (pid or port). If dead,
  attempt drift correction: restart using the original command. Record the
  outcome: `pass` (responding), `corrected` (restarted), `fail` (won't start).
- **Remote HTTP** — probe the `url` for a 200 response. Outcome: `pass`
  (responds), `fail` (unreachable).

**Correction**: restart a dead local MCP process.

**Escalation**: an MCP that fails to start on 3 consecutive runs gets flagged
with `escalated: true` and no restart is attempted. The failure count is
stored under each server name in the drift anchor file
(`~/.local/state/system-health-baseline.json`).

### 2. Config Integrity

**When**: every sub-probe below has run and its outcome recorded:

- **Model IDs** — every ID in `models.yml` and `config.yml` resolves against
  the listed provider's endpoint. Stale IDs → drift correction (remove).
- **API keys** — every key referenced in config exists as an env var
  (`DEEPSEEK_API_KEY`, `NAHCROF_API_KEY`, etc.). Missing → drift correction
  (regenerate from `~/.config/env.d/*.sh`).
- **RTK configs** — `filters.toml` and `config.toml` parse under `tomllib`.
  Does not check semantic validity (dead filters in filters.toml).
- **APPEND_SYSTEM.md** — still contains the Context7 section.

**Correction**: remove stale model IDs; regenerate missing env vars from the
env.d/ single source of truth.

### 3. Source Currency

**When**: every git repo under the skills directory and any MCP server path
that points into a git repo has been checked.

- `git remote update` then `git status`. If behind upstream → drift correction
  (`git pull`).
- If the repo has uncommitted changes AND is behind upstream: outcome =
  `conflict`. Flag for manual resolution. Do not pull.

**Correction**: `git pull` on repos behind upstream with a clean working tree.

### 4. System Performance

**When**: every metric below has been collected, compared against the drift
anchor, and any threshold violation recorded.

Collect one-liners:

| Metric | How |
|---|---|
| CPU governor | `cpupower frequency-info -p 2>/dev/null \| grep governor` |
| CPU thermals | `sensors -j` or `/sys/class/thermal/thermal_zone*/temp` |
| Memory pressure | `free -h \| head -2` |
| Swap usage | `swapon --show 2>/dev/null` |
| Disk free on / | `df -h / \| tail -1` |
| GPU temp | Try: `nvidia-smi`, then `sensors -j` for `amdgpu`/`xe`, then sysfs |

Compare each against the drift anchor
(`~/.local/state/system-health-baseline.json`). A metric that deviates beyond
the threshold (REFERENCE.md → Thresholds) records `fail`.

GPU driver not found? Record `unknown` with the probe attempted and the result
— do not guess.

**Correction**: none — flag only.

### 5. AI Config Health

**When**: every sub-probe below has run:

- **RTK savings** — `rtk gain`. Compare against the 7-day rolling anchor
  (tracked in the drift anchor file). A drop of 3+ pp → `fail`.
- **Session errors** — run `session-error-scan --brief`. If drift reports
  new high-severity errors: `fail` with count. Otherwise → `pass`.
- **Config timestamps** — any agent config file modified since the last run?
  Flag: "`models.yml` changed since last check — review changes."
 - **context-mode** — run `ctx stats`. If it fails to respond or storage is uninitialized: `fail`.

**Correction**: none — flag only.

### 6. Memory Integrity

**When**: every known critical fact (REFERENCE.md → Known critical facts) has
been checked against each agent's memory backend and the result recorded.

Files to read:
- `~/.omp/agent/CRITICAL_MEMORIES.md`
- `~/.mimocode/CRITICAL_MEMORIES.md`

For each fact: compare what the file says against what the memory backend
returns. Missing fact → drift correction: inject via `retain` (OMP) or
equivalent (Mimo).

Only check agents whose CRITICAL_MEMORIES.md exists. If Mimo is not
installed (no `~/.mimocode/`), skip it — record `skip`, not `fail`.

**Correction**: inject missing facts into the agent's memory.

### 7. Workflow Reflection (weekly)

**When**: every 7 days, or on explicit `/health reflect` request. Every probe
below has run and its outcome recorded.

Uses **drift probe** language (`pass`/`fail`/`unknown`/`conflict`) but the
anchor is the ideal of no repeated manual work — are we still doing by hand
what should be tooled?

**Probe: session scan** — check agent logs for repeated patterns.
Probe sources in order of falling precision:
1. `ctx_search(sort: "timeline")` — repeated task shapes across sessions.
2. Agent session directories (`~/.local/state/*/sessions/`).
3. Agent-specific adapter in REFERENCE.md (e.g. OpenCode SQLite).

**Probe: asset inventory** — list existing skills, commands, config rules
in `~/.agents/skills/` and `~/.config/env.d/`.

**Probe: scoring** — for each candidate pattern, evaluate:
- **Frequency** — how often does it appear?
- **Cost** — wasted time, tokens, or attention per occurrence.
- **Risk** — does inconsistent execution cause bugs or bad decisions?
- **Coverage** — does an existing asset already handle it?

Score: High (all 4 positive), Medium (2-3), Low (0-1).

**Correction**: for each High or Medium candidate, package in the smallest
useful form — prompt rule → skill → command → doc → skip.

**Escalation**: 3+ High-scored candidates → flag for a dedicated
improvement session. Do not attempt mid-run.

### 8. Harness Efficiency

**When**: weekly (with Workflow Reflection, probe set 7), or on explicit
`/health harness` request. Every sub-probe below has run and its outcome recorded.

Measures the agent harness's task quality and token cost against the drift
anchor — flag-only, no code edits. The actual improve loop is the on-demand
`harness-efficiency.md` workflow (mirrors tooling-efficiency.md).

- **Benchmark score** — run the harness benchmark suite (path in REFERENCE.md →
  Harness benchmark). Capture the composite task score. Compare to anchor. A
  drop beyond threshold → `fail`.
- **Tokens per task** — capture tokens/task from the benchmark run (or the
  harness's own accounting). Compare to anchor. A rise beyond threshold → `fail`.
- **Skill coverage** — confirm the analysis skills the improve loop relies on
  are present and invocable: `super-research` (experiment loop), `ponytail` /
  `ponytail-audit`, `code-review`, `tdd`. Missing → `unknown` for that lever,
  flag (the loop can't run without it).

**Correction**: none — flag only. On `fail`, point to
`/home/alex/workflows/harness-efficiency.md` for the measure + improve loop.

**Skip**: if no harness benchmark path is configured (REFERENCE.md entry
absent) → record `skip`, not `fail`.

## Drift note (not a probe set)

**When**: every flagged recommendation file has been checked and either recorded or skipped.

After the 7 probe sets, check for stale recommendations:

Scan `/home/alex/*.md` and any `.md` file that was flagged as "recommendation" in a prior run. For each, read the filename and first 3 lines. If they describe a config change or system tweak, compare against current state and append one line to the drift report:

```
~/{filename}: recommends {X}, current {Y}. Intentional?
```

If no such files exist, or none describe actionable recommendations, record nothing. Do not invent summaries for files that don't exist.

**Deeper pass** (on-demand): for measure + improve across tooling (RTK, ponytail, context-mode), see `/home/alex/workflows/tooling-efficiency.md`. For agent-harness benchmark score + tokens/task improvement (super-research experiment loop, ponytail / code-review / tdd), see `/home/alex/workflows/harness-efficiency.md`. Both flag-only in this skill; invoke separately.

## Drift report

Write `/tmp/system-health-brief.md` per the format in REFERENCE.md → Drift report format.

## Edge cases

- **First run**: no drift anchor exists → create it from current state, write
  "Baseline established, no comparison possible."
- **MCP fails 3 consecutive runs**: set `escalated: true` in the drift anchor,
  do not attempt restart on the 4th run.
- **git pull conflicts**: skip, flag `conflict` in drift report.
- **Config unparseable**: flag, do not auto-edit.
- **All nominal**: "All nominal" — one line.
