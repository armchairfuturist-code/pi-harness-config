# 01 — Inventory local corpus

**Ticket:** `.scratch/thin-pi-harness/issues/01-inventory-local-corpus.md`  
**Date:** 2026-07-27  
**Weighting rule:** newer files + current `pi-harness-config` beat older historical notes.

## 1. Live `~/.pi/agent` (truth for runtime)

Source: `~/.pi/agent/settings.json` (read 2026-07-27).

| Surface | Count | Notes |
|--------|------:|-------|
| Packages | **17** | See list below |
| Extensions | **7** | `delegate.ts` + 6× `@samfp/pi-essentials` |
| Skills | **26** | All mattpocock engineering set (no domain skills in live skills dir) |
| Agents | 1 usable | `Explore.md` (+ glla sync json) |
| Rules | 0 | empty |
| Sessions | ~809 jsonl / 859 paths | heavy history |
| Default model | `kimi-k3` @ Venice | differs from repo baseline |
| Compaction | reserve 60k / keepRecent 20k | |

### Packages (live)

1. `@ogulcancelik/pi-model-agents`
2. `@ogulcancelik/pi-model-thinking`
3. `@plannotator/pi-extension`
4. `cc-safety-net`
5. `context-mode`
6. `pi-autoresearch`
7. `pi-cache-graph`
8. `pi-cache-optimizer`
9. `pi-context-usage`
10. `pi-continue`
11. `pi-goal-list-loop-audit`
12. `pi-herdr-btw`
13. `pi-lean-ctx`
14. `pi-mcp-adapter`
15. `pi-slim`
16. `pi-tscg`
17. `pi-web-access`

**Present in node_modules but NOT in live packages list:** `pi-subagents`, `@quintinshaw/pi-dynamic-workflows` (transitive or leftover installs — not activated).

### Extensions (live)

- `~/.pi/agent/extensions/delegate.ts` — minimal subagent (~200 tok schema claim in file header)
- pi-essentials: auto-session-name, auto-title, clipboard-image, compact-header, image-context-pruner, markdown-viewer

### Skills (live) — 26

ask-matt, code-review, codebase-design, diagnosing-bugs, domain-modeling, grill-me, grill-with-docs, grilling, handoff, impeccable, implement, improve-codebase-architecture, prototype, research, resolving-merge-conflicts, setup-matt-pocock-skills, setup-pre-commit, setup-ts-deep-modules, tdd, teach, to-questionnaire, to-spec, to-tickets, triage, wayfinder, writing-great-skills

## 2. Repo `pi-harness-config` (current iteration)

Sources: repo `settings.json`, `README.md`, `WORKFLOW.md`, `research/progressive-disclosure-findings.md`, `bench/`.

| Item | Repo state |
|------|------------|
| Packages | Differs from live (repo was snapshot; live has herdr-btw, model-agents, etc.) |
| Domain skills | Documented under `skills/agents-skills/` in README tree; **not** in live `~/.pi/agent/skills` |
| Matt skills | Documented in README; live has them |
| Delegate | `extensions/delegate.ts` |
| Bench | `probe.sh`, `measure.sh`, `measure-long.sh` |
| Prior research | `research/progressive-disclosure-findings.md` (2025-07-25) |

**Live vs repo package delta (approx):** live-only includes model-agents, model-thinking, plannotator, herdr-btw, web-access, continue, autoresearch, etc. Treat **live** as runtime truth; repo as design baseline + benches.

## 3. Session evidence (keyword co-occurrence, crude)

Scanned ~809 session jsonl files for keyword presence (not invocation precision):

| Keyword | Sessions mentioning |
|---------|--------------------:|
| implement | 101 |
| research | 80 |
| workflow | 61 |
| goal | 51 |
| loop | 50 |
| tdd | 45 |
| subagent | 44 |
| grill | 34 |
| delegate | 34 |
| code-review | 31 |
| ask-matt | 31 |
| diagnosing | 31 |
| wayfinder | 30 |
| to-spec / to-tickets | 28 |
| herdr | 25 |

**Interpretation (candidates only):** execution + research + goal/loop show up more than full matt gate chains; subagent/herdr interest is real but not dominant; user still hits many skill names → supports “single orchestrator” destination.

## 4. Historical notes (context only)

| Path | Gist |
|------|------|
| `Projects/pi-harness-config/**` | **Current** baseline + benches + PD findings |
| `Projects/harness-optimization-analysis.md` | Multi-harness compare; Pi cache optimizer praised; package bloat called out |
| `Projects/harness-performance-review.md` | Related performance review |
| `pi-config-analysis.md`, `pi-configuration.md` | Older live-config dumps |
| `wayfinder-agents-optimization.md` | Prior wayfinder/agents optimization notes |
| `.config/harness-audit-report.md` | Audit report |
| `.autoresearch-pi/progressive-disclosure-findings.md` | Parallel PD experiment notes |
| `mindscape-site/autoresearch-harness.md` | Project-local harness experiment |

## 5. Always-on cost measurement method

**Do not invent a baseline number here** — method only:

```bash
cd /home/alex/Projects/pi-harness-config
# Fast fixed-overhead probe (system + tool schemas), trivial prompt:
./bench/probe.sh
# Short / long workload:
./bench/measure.sh
./bench/measure-long.sh
```

`probe.sh` header: measures per-request fixed overhead with a trivial prompt for config diffs.

Also available: `pi-context-usage`, cache-optimizer stats at `~/.pi/agent/pi-cache-optimizer-stats.json`.

**Gap:** run probe against *current live* settings and record number before apply canary (ticket 12).

## Keep / kill *candidates* (NOT decisions)

### Likely keep (kernel candidates)
- Token/efficiency: `pi-lean-ctx`, `pi-tscg`, `pi-cache-optimizer` (and maybe slim/cache-graph — audit overlap)
- AFK contracts: `pi-goal-list-loop-audit` (possibly **internal** to orchestrator)
- Multi-agent path: **one of** herdr-btw / pi-subagents / dynamic-workflows / delegate — bar in ticket 05
- Safety: `cc-safety-net` (if low cost)
- Web: `pi-web-access` if research is common

### Likely lazy / discoverable only
- Full matt skill pack (26 descriptions always-on is anti-destination)
- `pi-autoresearch` (power tool, not always-on narrative)
- Domain library (already not in live skills dir)

### Likely kill / consolidate candidates
- Overlapping context packages (`pi-context-usage` vs lean-ctx vs cache-graph — prove each)
- Essentials extensions that don’t earn tokens (markdown-viewer, etc. — usage unknown)
- `delegate.ts` **if** replaced by a fuller multi-agent pack that still meets token ceiling
- Dead node_modules packs not in settings

### Operator-surface candidates to **remove from memory burden**
- Individual matt gates (grill-with-docs → to-spec → to-tickets → implement…) as things user must type
- Replace with single CE-lite orchestrator (destination)

## Open gaps
1. Exact always-on token baseline via `probe.sh` on live config
2. Which skill *descriptions* are injected vs user-invoked only in Pi (disable-model-invocation)
3. Precise schema token cost of herdr-btw vs pi-subagents vs dynamic-workflows
4. Whether domain skills exist elsewhere (project-local) not scanned here
