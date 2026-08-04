# Pi Harness Config — Lean Compound Engineering

A thin, measured Pi configuration for a **non-developer, contract-only operator**. One orchestrator (`ce-lite`) routes everything — simple questions get direct answers, non-trivial work runs a contract loop (grill only blocking questions → terms → plan → subagent execution → verify → compound learnings). No skill names to memorize, no gates to hop.

## Why lean matters

Every always-on token is a tax. It compounds across every request, every session, every task. The fixed overhead — tokens that load before you type a single word — determines how long your context stays clean, how much useful work fits before compaction, and how much you pay per session.

This config attacks that overhead without sacrificing capability. The result: **4,339 tokens of fixed overhead** (down from 5,789 pre-optimization, −25.1%), **12 always-on tools** (down from 37), and **zero always-on skill descriptions** — yet the harness still runs multi-agent workflows, autonomous research campaigns, and complex contract loops.

Context rot was measured onset at **42% context fill** (step 76, 377K tokens, 22.7% tool-error rate). A leaner floor means you reach that threshold later, giving you more productive conversation before reasoning degrades.

## How: the five levers

### 1. Tool schema compression (pi-tscg)
Tool descriptions are truncated to **5 characters** (`aggressiveMaxDescChars=5`). This is the constraint floor — below 5, tool names themselves break. The tuning campaign (2026-08-03, 10 values tested 5–50) found probe tokens are **deterministic and monotonically decreasing** in description length: 30 chars → 4,874 tok; 5 chars → 4,339 tok (**−535 tok, −11.0% per request**). The model learns tool usage from APPEND_SYSTEM.md guidance, not from verbose per-tool docs.

### 2. Package curation
37 always-on tools → 12. Every package must earn its slot. Removed (measured):
- **pi-mcp-adapter** — 0 MCP servers configured; dead schema
- **pi-goal-list-loop-audit** — 11 always-on tools ≈ 1,100 tok; incompatible with the budget. Contract/audit is now ce-lite artifacts + workflow reviewer phases
- **pi-web-access** — parent web tools ≈ 1,084 tok; web moved to workflow child agents + direct `ctx_fetch_and_index`
- **pi-subagents** — never activated; would have consumed the entire ≥30% cut budget (+3,810 tok)
- **@hypabolic/pi-hypa** — npm package uninstalled but a broken `~/.local/bin/hypa` shim remained → 522 command-not-found errors in 30 days; shim + allowScripts residue removed

### 3. Single orchestrator (ce-lite)
One skill routes everything. All other skills are **excluded from the always-on schema** — the orchestrator reads them on demand when needed. Zero description overhead for skills not in use. The operator never types skill names; ce-lite internally routes to the right skill via a task-shape routing table (implement, tdd, research, diagnosing-bugs, code-review, domain-modeling, to-spec, to-tickets, handoff, workflow-authoring, graph-engineering).

The skill itself uses **progressive disclosure**: `SKILL.md` is a tight core (~1,500 words) with the routing doctrine and contract loop. Branch-specific reference is disclosed to sibling files loaded only when the relevant branch reaches them: `grilling.md` (blocking test, depth-first vs breadth-first, fog, domain modeling), `wayfinding.md` (multi-session map protocol, ticket types, blocking edges, frontier), `gather-judge.md` (evidence-judgment separation), `context-health.md` (handoff triggers), `reference.md` (recall protocol, decomposition routing, skill routing table). Zero always-on cost for reference the current task doesn't need.

### 4. Minimal system prompt
One **85-token overlay** (`APPEND_SYSTEM.md`) is the only global addition to pi's system prompt. It routes non-trivial work to ce-lite and authorizes proactive `workflow` calls. Everything else is project-level (`AGENTS.md`). Cache-prefix stability is prioritized over prose golf — churning the system prompt destroys cache hit rates (see `research/progressive-disclosure-findings.md`).

### 5. Lean-ctx bridge
Replaces raw tool surfaces with 12 lean wrappers (`ctx_shell`, `ctx_read`, `ctx_edit`, etc.). Intent-based expansion (`enableMcp: true`) was measured at **22→78 tools, +9,600 tok/request** on file tasks (A/B 2026-07-29: 3,997 vs 13,591 tok) — permanently disabled. The bridge also provides TOCTOU guards, shell allowlists, and output compression.

## Measured impact

All measurements 2026-08-03, Lilac/zai-org/glm-5.2, `CTX_MODE_ADMIN_TOOLS=0`.

| Metric | Pre-optimization | Current | Δ |
|---|---:|---:|---:|
| Always-on overhead (`bench/probe.sh`) | 5,789 tok | **4,339 tok** | **−25.1%** |
| TSCG desc chars (30→5, same-day A/B) | 4,874 tok | 4,339 tok | −11.0% |
| Always-on tools (lean-ctx tools lean) | 37 | **12** | −25 |
| Always-on skill descriptions | many | **0** | — |
| Prompt cache hit rate (GLM-5.2) | — | **83%** | — |
| Prompt cache hit rate (DeepSeek V4 Flash) | — | **95%** | — |
| Context rot onset (37 sessions) | — | **42% fill / step 76 / 377K tok** | — |

Canary definitions + as-run results: `.scratch/thin-pi-harness/issues/12-grill-canaries.md`.

## Yet highly functional

The harness doesn't trade capability for leanness. What it does:

- **Multi-agent fanout** — 5 built-in workflow patterns (deep-research, adversarial-review, code-review, multi-perspective, codebase-audit). Verified: 7-agent runs, 0 failures. Triggered proactively — no trigger words needed.
- **Autonomous optimization** — Autoresearch campaigns run measured experiment loops (hypothesis → measure → check → learn). This very config was tuned by one (tscg chars=5, terseness −17.1%, thinking-level economics).
- **Contract loops** — Non-trivial work runs as a structured contract: grilling (blocking questions only, with depth-first vs breadth-first modes and fog handling) → acceptance terms → short plan → axis diagnosis → fanout → verify against terms → save reusable patterns.
- **Wayfinding** — Multi-session work is charted as a map of decision tickets (research, prototype, grilling, task types) with blocking edges and a frontier. One ticket per session; fog graduates into tickets as it sharpens. The operator sees questions and progress, never the map structure.
- **Memory** — `session-index.ts` extension produces extractive summaries at session end (zero LLM tokens). `memory-consolidate` workflow deduplicates constraints across sessions.
- **Context rot forensics** — 5-signal detection with knee analysis. Handoff trigger at 40% fill (pre-rot), 28% with rot-sentinel.
- **Model tier routing** — One file (`workflows/model-tiers.json`) pins leaf/worker/reviewer models. Mechanical tasks use cheap models; complex reasoning uses expensive ones. Automatic.
- **Per-model thinking routing** — `model-thinking.json` sets thinking levels per model. GLM-5.2→high, Gemini Flash→medium, small models→low. No manual switching.
- **Side questions** — `/btw` (pi-herdr-btw) opens a side thread that doesn't disturb the main conversation.

## What's in here

```
pi-harness-config/
├── settings.json             # 17 packages, 6 extensions (thin kernel)
├── models.json               # Provider + model definitions (Venice + Lilac + DeepSeek)
├── model-thinking.json       # Per-model thinking-level routing (GLM-5.2→high, Flash→low)
├── APPEND_SYSTEM.md          # CE-lite activation hook (~85 tok, the ONLY global overlay)
├── tscg.json                 # pi-tscg: aggressive schema compression (desc chars=5) — LOAD-BEARING, do not retune
├── AGENTS.md                 # Project instructions (session guardrail)
├── skills/
│   ├── ce-lite/              # THE orchestrator skill (routing doctrine + contract loop + progressive disclosure:
│   │                         #   grilling.md, wayfinding.md, gather-judge.md, context-health.md, reference.md)
│   ├── harness-doctor/       # harness inventory, provider ops, preflight, trajectory metrics
│   ├── context-rot-forensics/ # session-log rot detection (5-signal, knee analysis, rot-sentinel)
│   ├── action-context-axes/  # 2×2 axis diagnosis (action vs context complexity → optimization routing)
│   ├── graph-engineering/    # agent graph topologies (DAG, SharedStore, cycles, fan-in)
│   ├── poor-mans-distill/    # trace extraction + few-shot digest from prior sessions
│   └── shard-security/       # harness-level security controls assessment (bwrap, permissions)
├── scripts/
│   ├── ensure-reasoning-levels.js
│   ├── base64_bench.py       # ungamed private benchmark for provider ranking
│   └── base64_bench_providers.json
├── lean-ctx/                 # lean-ctx bridge config (replace mode, lean profile)
├── extensions/
│   ├── session-index.ts      # session-end extractive summaries → memory/sessions/ (zero LLM tokens)
│   └── transcript-pruner.ts  # cross-message dedup/stale pruning (default ON: DEDUP+STALE+CLEAR keep=4; PI_TRANSCRIPT_PRUNE=0 disables)
├── workflows/
│   ├── model-tiers.json      # pinned model routing (leaf/worker/reviewer)
│   └── saved/                # memory-consolidate, gather-judge-split, review-fix-graph
├── bench/
│   ├── probe.sh              # token canary: 1-request fixed overhead
│   ├── probe-variant.sh      # probe an ALTERNATE agent dir (A/B without touching live)
│   ├── measure.sh            # workload bench (live config)
│   ├── measure-variant.sh    # workload bench (alternate agent dir)
│   └── measure-long.sh
├── research/
│   ├── wayfinder/            # 6 research tickets (inventory → model routing)
│   ├── ce-upstream-radar.md  # monthly upstream watch doc (no bot)
│   └── progressive-disclosure-findings.md
└── .scratch/thin-pi-harness/ # wayfinder map, 13 tickets, spec.md operator pack
```

## The kernel (what runs always-on)

**Packages (17):** pi-lean-ctx, context-mode, @quintinshaw/pi-dynamic-workflows, pi-tscg, pi-slim, pi-cache-optimizer, pi-cache-graph, pi-context-usage, pi-continue, pi-autoresearch, @plannotator/pi-extension, @ogulancelik/pi-model-agents, @ogulancelik/pi-model-thinking, cc-safety-net, pi-herdr-btw, https://github.com/gvkhosla/last30days-pi, @samfp/pi-essentials.

**Extensions (6):** @samfp/pi-essentials (session naming, titles, clipboard images, compact header, image pruning, markdown viewer) — UI only, zero schema cost.

## How work routes (ce-lite)

1. **Simple** → answered directly. No ceremony.
2. **Lookup** → direct fetch (`ctx_fetch_and_index`) or a research workflow when source-sensitive. Sources included.
3. **Non-trivial** → contract loop: grill blocking questions (depth-first to sharpen, breadth-first to map) → acceptance terms → short plan → axis diagnosis (action-bound vs context-bound) → `workflow` fanout (tiers small/medium/big) → reviewer verifies against terms → deliver + save reusable patterns. When a term needs judgment over gathered evidence, a gather-judge split enforces separation architecturally.
4. **Multi-session** → wayfinder map: chart the destination and frontier as decision tickets, then resolve one per session. The orchestrator initiates this internally when grilling reveals work too big for one session.
5. **Loop-shaped** ("keep improving X") → pi-autoresearch campaign.
6. Side questions anytime → `/btw` (pi-herdr-btw).

Multi-agent fanout uses pi-dynamic-workflows' 5 built-in patterns — verified: 7-agent run, 0 failures. The APPEND_SYSTEM.md hook authorizes proactive workflow use; the operator never types trigger words. Skill routing is internal: ce-lite matches task shape to the right skill (implement, tdd, research, diagnosing-bugs, code-review, domain-modeling, to-spec, to-tickets, handoff, etc.) via a routing table in `reference.md`.

## Model roles

Pinned in **one file**: `~/.pi/workflows/model-tiers.json` (vendored: `workflows/model-tiers.json`; pinned 2026-07-29). leaf=small (`Venice/mercury-2:minimal`, mechanical), worker/reviewer=medium (`Venice/gemini-3-5-flash`), reasoner=big (`Venice/kimi-k3:high`). Parent = your default model. Re-benchmark quarterly. No model IDs anywhere else (exception: `~/.pi/agent/agents/Explore.md` pins flash — leaf-tier search).

## Install / restore

> ⚠️ **Shell = Fish, NOT Bash.** The operator's login shell is `/bin/fish` on all machines (CachyOS). Any command shown to the operator must use fish syntax (`set -gx VAR val`, not `export VAR=val`). Set env vars in `~/.config/fish/config.fish`, never `.bashrc`/`.zshrc`. The `ctx_shell` tool runs bash internally — only operator-facing commands need fish syntax. See `docs/pi-configuration.md` §10.

**Single command** — copies every vendored file to its live location, verifies each
with a diff, and reports `[OK]`/`[FAIL]` per file:

```fish
./install.sh           # deploy all vendored config + verify
./install.sh --check   # verify only (no writes) — checks for drift
./install.sh --settings # also overlay settings.json (excluded by default)
```

The manifest inside `install.sh` is the **single source of truth** for what gets deployed.
Adding a file to the repo means adding one line to the manifest — no manual `cp` list to forget.

**First install on a fresh machine** also needs the npm packages:

```fish
pi install npm:pi-lean-ctx npm:context-mode npm:@quintinshaw/pi-dynamic-workflows \
  npm:pi-tscg npm:pi-slim npm:pi-cache-optimizer npm:pi-cache-graph npm:pi-context-usage \
  npm:pi-continue npm:pi-autoresearch npm:@plannotator/pi-extension \
  npm:@ogulancelik/pi-model-agents npm:@ogulcancelik/pi-model-thinking \
  npm:cc-safety-net npm:pi-herdr-btw npm:@samfp/pi-essentials
set -gx LILAC_API_KEY "your-key-here"
set -gx PI_TRANSCRIPT_PRUNE 1  # enable transcript-pruner extension (-15.7% billed tokens)
```

**Migrating into an existing install:** `./install.sh` is idempotent — run it, then `./install.sh --check`
to confirm zero drift. `settings.json` is excluded by default (provider/model differ per machine);
overlay it with `./install.sh --settings` only after checking `defaultProvider`/`defaultModel`.
Never overlay `auth.json` (not vendored).

**Remove-if-present (old kernel):** pi-mcp-adapter, pi-goal-list-loop-audit, pi-web-access (`pi remove <pkg>`), and delete `~/.pi/agent/extensions/delegate.ts`.

## Verify

```fish
set -gx CTX_MODE_ADMIN_TOOLS 0
./bench/probe.sh      # must print total ≤ 4,400
./bench/measure.sh 3  # all checks_pass=1
```

Optional heavy web weeks: `pi install npm:pi-web-access` re-adds parent web tools (+~1,084 tok, budget becomes −13.6% — an explicit trade, remove with `pi remove npm:pi-web-access`).

## Warnings

- **Do not retune `tscg.json`.** `aggressiveMaxDescChars=5` is the measured optimum (autoresearch 2026-08-03: 10 values tested 5–50, probe deterministic & monotonic, 5 is the constraint floor). Savings: 4,874→4,339 tok (−535, −11.0%). Truncated tool docs are compensated by APPEND_SYSTEM.md guidance. Earlier `balanced` profile inflates the kernel to 9,994 tok — do not switch profiles.
- **Do not churn the system prompt.** Cache-prefix stability beats prose golf (see `research/progressive-disclosure-findings.md`).
- **context-mode has a local patch (2026-07-30)**: `buildBatchNodeOptionsPrefix` now emits `export NODE_OPTIONS=...; <cmd>` so `for`/`if`/`while` survive ctx_shell. A context-mode npm upgrade overwrites `build/server.js` + bundles — re-apply (see `~/.pi/agent/memory/consolidated.md`).
- **Do not set `enableMcp: true`** in the lean-ctx config. The bridge triggers intent-based tool-surface expansion (22→78 tools, ~13.6k tok/request on file tasks; measured A/B 2026-07-29, same task: 3,997 vs 13,591). `ctx_edit` falling back to native edit is intended behavior, not a fault.
- **Harness changes are regression gates (§8.6.1)**: any config change (packages, extensions, APPEND_SYSTEM, compaction, tscg) triggers the canary suite — scores are model–harness-pair properties. Record `config_hash.py` output in every benchmark result; run `preflight.py` before spending tokens (both in `~/.pi/agent/skills/harness-doctor/scripts/`).
- Live `~/.pi/agent` sync from this repo is an explicit operator decision (see spec §8).

## Not included (secrets + bulk)

`auth.json`, `models-store.json`, `sessions/`, `npm/node_modules/`, large skill assets. Live-only personal extensions are intentionally not vendored: `invest-tools.ts` (operator's finance tooling). NOTE: `rtk.ts` was removed from live 2026-07-30 — verified inert: lean-ctx replace mode means the model calls `ctx_shell`, not `bash`, so rtk's `bash`-hook never fires (zero invocations since replace mode). It belongs to the OMP harness, which has no lean-ctx.
