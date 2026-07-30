# Pi Harness Config — CE-lite

A thin, measured Pi configuration for a **non-developer, contract-only operator**. One orchestrator (`ce-lite`) routes everything — simple questions get direct answers, non-trivial work runs a contract loop (grill only blocking questions → terms → plan → subagent execution → verify → compound learnings). No skill names to memorize, no gates to hop.

All decisions and measurements: `.scratch/thin-pi-harness/map.md` (wayfinder, 13 tickets) + `.scratch/thin-pi-harness/spec.md` (operator pack).

## Measured (2026-07-27, Lilac/zai-org/glm-5.2)

| Metric | Old (live) | CE-lite kernel | Δ |
|---|---:|---:|---:|
| Always-on overhead (`bench/probe.sh`) | 5,789 tok | **4,014 tok** | **−30.6%** |
| Workload (`bench/measure.sh`) | 18,403 tok | 12,449 tok | −32.4% |
| bench-systima A/B, first request | 5,780 tok | 3,979 tok | −31.2% |
| Behavioral suite, T1–T3 median-of-2 (2026-07-29) | 70,657 tok | **58,551 tok** | **−17.1%** |
| Always-on tools | 37 | 22 | −15 |
| Always-on skill descriptions | 0 | 0 | — |

Canary definitions + as-run results: `.scratch/thin-pi-harness/issues/12-grill-canaries.md`.

## What's in here

```
pi-harness-config/
├── settings.json          # 15 packages, 6 extensions (thin kernel)
├── models.json            # Provider + model definitions (Lilac)
├── APPEND_SYSTEM.md       # CE-lite activation hook (~85 tok, the ONLY global overlay)
├── tscg.json              # pi-tscg: aggressive schema compression — LOAD-BEARING, do not retune
├── AGENTS.md              # Project instructions (session guardrail)
├── skills/
│   └── ce-lite/           # THE orchestrator skill (routing doctrine + contract loop)
├── scripts/
│   └── ensure-reasoning-levels.js
├── lean-ctx/              # lean-ctx bridge config (replace mode, lean profile)
├── extensions/
│   └── session-index.ts # session-end extractive summaries → memory/sessions/ (zero LLM tokens)
├── workflows/
│   ├── model-tiers.json # pinned model routing (leaf/worker/reviewer)
│   └── saved/memory-consolidate.json # session-end memory consolidation workflow
├── bench/
│   ├── probe.sh           # token canary: 1-request fixed overhead
│   ├── probe-variant.sh   # probe an ALTERNATE agent dir (A/B without touching live)
│   ├── measure.sh         # workload bench (live config)
│   ├── measure-variant.sh # workload bench (alternate agent dir)
│   └── measure-long.sh
├── research/
│   ├── wayfinder/         # 6 research tickets (inventory → model routing)
│   ├── ce-upstream-radar.md  # monthly upstream watch doc (no bot)
│   └── progressive-disclosure-findings.md
└── .scratch/thin-pi-harness/  # wayfinder map, 13 tickets, spec.md operator pack
```

## The kernel (what runs always-on)

**Packages (15):** pi-lean-ctx, context-mode, @quintinshaw/pi-dynamic-workflows, pi-tscg, pi-slim, pi-cache-optimizer, pi-cache-graph, pi-context-usage, pi-continue, pi-autoresearch, @plannotator/pi-extension, @ogulcancelik/pi-model-agents, @ogulcancelik/pi-model-thinking, cc-safety-net, pi-herdr-btw.

**Removed (measured):** pi-mcp-adapter (no MCP servers configured; dead schema), pi-goal-list-loop-audit (11 always-on tools ≈ 1,100 tok — incompatible with the −30% budget; contract/audit is now ce-lite artifacts + workflow reviewer phases), pi-web-access (parent web tools ≈ 1,084 tok — web moved to workflow child agents + direct `ctx_fetch_and_index`), extensions/delegate.ts (superseded by dyn-workflows), pi-subagents never activated (+3,810 tok).

**Extensions (6):** @samfp/pi-essentials (session naming, titles, clipboard images, compact header, image pruning, markdown viewer) — UI only, zero schema cost.

## How work routes (ce-lite)

1. **Simple** → answered directly. No ceremony.
2. **Lookup** → direct fetch (`ctx_fetch_and_index`) or a research workflow when source-sensitive. Sources included.
3. **Non-trivial** → contract loop: blocking questions only → acceptance terms → short plan → `workflow` fanout (tiers small/medium/big) → reviewer verifies against terms → deliver + save reusable patterns.
4. **Loop-shaped** ("keep improving X") → pi-autoresearch campaign.
5. Side questions anytime → `/btw` (pi-herdr-btw).

Multi-agent fanout uses pi-dynamic-workflows' 5 built-in patterns (deep-research, adversarial-review, code-review, multi-perspective, codebase-audit) — verified: 7-agent run, 0 failures. The APPEND_SYSTEM.md hook authorizes proactive workflow use; the operator never types trigger words.

## Model roles

Pinned in **one file**: `~/.pi/workflows/model-tiers.json` (vendored: `workflows/model-tiers.json`; pinned 2026-07-29). leaf=small (`Venice/mercury-2:minimal`, mechanical), worker/reviewer=medium (`Venice/gemini-3-5-flash`), reasoner=big (`Venice/kimi-k3:xhigh`). Parent = your default model. Re-benchmark quarterly. No model IDs anywhere else (exception: `~/.pi/agent/agents/Explore.md` pins flash — leaf-tier search).

## Install / restore

```bash
cp settings.json ~/.pi/agent/settings.json
cp models.json ~/.pi/agent/models.json
cp APPEND_SYSTEM.md ~/.pi/agent/APPEND_SYSTEM.md
cp tscg.json ~/.pi/tscg.json
mkdir -p ~/.pi/workflows && cp workflows/model-tiers.json ~/.pi/workflows/model-tiers.json
mkdir -p ~/.pi/workflows/saved && cp workflows/saved/memory-consolidate.json ~/.pi/workflows/saved/
cp extensions/session-index.ts ~/.pi/agent/extensions/session-index.ts
mkdir -p ~/.pi/agent/extensions/pi-lean-ctx
cp lean-ctx/pi-config.json ~/.pi/agent/extensions/pi-lean-ctx/config.json
mkdir -p ~/.config/lean-ctx && cp lean-ctx/config.toml ~/.config/lean-ctx/config.toml
cp -r skills/ce-lite ~/.pi/agent/skills/ce-lite
# Other skills are NOT vendored here (config-only repo). Install what you want:
#   npx skills add mattpocock/skills     # engineering flow library
#   armchairfuturist-code/Skills         # personal packs (symlink into ~/.pi/agent/skills)
pi install npm:pi-lean-ctx npm:context-mode npm:@quintinshaw/pi-dynamic-workflows \
  npm:pi-tscg npm:pi-slim npm:pi-cache-optimizer npm:pi-cache-graph npm:pi-context-usage \
  npm:pi-continue npm:pi-autoresearch npm:@plannotator/pi-extension \
  npm:@ogulcancelik/pi-model-agents npm:@ogulcancelik/pi-model-thinking \
  npm:cc-safety-net npm:pi-herdr-btw
export LILAC_API_KEY="your-key-here"
```

**Migrating into an existing install** (overlay without reinstalling packages): the safe
overlay set is `APPEND_SYSTEM.md`, `tscg.json`, `skills/ce-lite/`, `extensions/session-index.ts`,
`workflows/`, and `lean-ctx/pi-config.json`. Overlay `settings.json` only after checking
`defaultProvider`/`defaultModel` (this repo's default mirrors the operator's current machine);
`models.json` only if you want the provider definitions. Never overlay `auth.json` (not vendored).

**Remove-if-present (old kernel):** pi-mcp-adapter, pi-goal-list-loop-audit, pi-web-access (`pi remove <pkg>`), and delete `~/.pi/agent/extensions/delegate.ts`.

## Verify

```bash
./bench/probe.sh        # must print total ≤ 4052
./bench/measure.sh 3    # all checks_pass=1
```

Optional heavy web weeks: `pi install npm:pi-web-access` re-adds parent web tools (+~1,084 tok, budget becomes −13.6% — an explicit trade, remove with `pi remove npm:pi-web-access`).

## Warnings

- **Do not retune `tscg.json`.** Aggressive 30-char description truncation saves 6,467 tok of schema (autoresearch attribution 2026-07-28: removal probe → 10,483; earlier `balanced` test → 9,994). Truncated tool docs are compensated by APPEND_SYSTEM.md guidance.
- **Do not churn the system prompt.** Cache-prefix stability beats prose golf (see research/progressive-disclosure-findings.md).
- **Do not set `enableMcp: true`** in the lean-ctx config. The bridge triggers intent-based tool-surface expansion (22→78 tools, ~13.6k tok/request on file tasks; measured A/B 2026-07-29, same task: 3,997 vs 13,591). `ctx_edit` falling back to native edit is intended behavior, not a fault.
- Live `~/.pi/agent` sync from this repo is an explicit operator decision (see spec §8).

## Not included (secrets + bulk)

`auth.json`, `models-store.json`, `sessions/`, `npm/node_modules/`, large skill assets. Live-only personal extensions are intentionally not vendored: `invest-tools.ts` (operator's finance tooling). NOTE: `rtk.ts` was removed from live 2026-07-30 — verified inert: lean-ctx replace mode means the model calls `ctx_shell`, not `bash`, so rtk's `bash`-hook never fires (zero invocations since replace mode). It belongs to the OMP harness, which has no lean-ctx.
