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
├── models.json            # Provider + model definitions (Venice + Lilac)
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
│   └── transcript-pruner.ts # cross-message dedup/stale pruning (inert unless PI_TRANSCRIPT_PRUNE=1)
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

**Removed (measured):** pi-mcp-adapter (no MCP servers configured; dead schema), pi-goal-list-loop-audit (11 always-on tools ≈ 1,100 tok — incompatible with the −30% budget; contract/audit is now ce-lite artifacts + workflow reviewer phases), pi-web-access (parent web tools ≈ 1,084 tok — web moved to workflow child agents + direct `ctx_fetch_and_index`), extensions/delegate.ts (superseded by dyn-workflows), pi-subagents never activated (+3,810 tok). pi-hypa/@hypabolic (npm package uninstalled but a broken `~/.local/bin/hypa` shim remained — 522 command-not-found errors in 30 days; shim + allowScripts residue removed 2026-07-30).

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

> ⚠️ **Shell = Fish, NOT Bash.** The operator's login shell is `/bin/fish` on all machines (CachyOS). Any command shown to the operator must use fish syntax (`set -gx VAR val`, not `export VAR=val`). Set env vars in `~/.config/fish/config.fish`, never `.bashrc`/`.zshrc`. The `ctx_shell` tool runs bash internally — only operator-facing commands need fish syntax. See `docs/pi-configuration.md` §10.

**Single command** — copies every vendored file to its live location, verifies each
with a diff, and reports `[OK]`/`[FAIL]` per file:

```fish
./install.sh                # deploy all vendored config + verify
./install.sh --check        # verify only (no writes) — checks for drift
./install.sh --settings     # also overlay settings.json (excluded by default)
```

The manifest inside `install.sh` is the **single source of truth** for what gets deployed.
Adding a file to the repo means adding one line to the manifest — no manual `cp` list to forget.

**First install on a fresh machine** also needs the npm packages:

```fish
pi install npm:pi-lean-ctx npm:context-mode npm:@quintinshaw/pi-dynamic-workflows \
  npm:pi-tscg npm:pi-slim npm:pi-cache-optimizer npm:pi-cache-graph npm:pi-context-usage \
  npm:pi-continue npm:pi-autoresearch npm:@plannotator/pi-extension \
  npm:@ogulcancelik/pi-model-agents npm:@ogulcancelik/pi-model-thinking \
  npm:cc-safety-net npm:pi-herdr-btw
set -gx LILAC_API_KEY "your-key-here"
set -gx PI_TRANSCRIPT_PRUNE 1  # enable transcript-pruner extension (-15.7% billed tokens)
# Other skills (not vendored here — install what you want):
# npx skills add mattpocock/skills    # engineering flow library
# armchairfuturist-code/Skills        # personal packs (symlink into ~/.pi/agent/skills)
```

**Migrating into an existing install:** `./install.sh` is idempotent — run it, then `./install.sh --check`
to confirm zero drift. `settings.json` is excluded by default (provider/model differ per machine);
overlay it with `./install.sh --settings` only after checking `defaultProvider`/`defaultModel`.
Never overlay `auth.json` (not vendored).

**Remove-if-present (old kernel):** pi-mcp-adapter, pi-goal-list-loop-audit, pi-web-access (`pi remove <pkg>`), and delete `~/.pi/agent/extensions/delegate.ts`.

## Verify

```fish
./bench/probe.sh        # must print total ≤ 4052
./bench/measure.sh 3    # all checks_pass=1
```

Optional heavy web weeks: `pi install npm:pi-web-access` re-adds parent web tools (+~1,084 tok, budget becomes −13.6% — an explicit trade, remove with `pi remove npm:pi-web-access`).

## Warnings

- **Do not retune `tscg.json`.** Aggressive 30-char description truncation saves 6,467 tok of schema (autoresearch attribution 2026-07-28: removal probe → 10,483; earlier `balanced` test → 9,994). Truncated tool docs are compensated by APPEND_SYSTEM.md guidance.
- **Do not churn the system prompt.** Cache-prefix stability beats prose golf (see research/progressive-disclosure-findings.md).
- **context-mode has a local patch (2026-07-30)**: `buildBatchNodeOptionsPrefix` now emits `export NODE_OPTIONS=...; <cmd>` so `for`/`if`/`while` survive ctx_shell. A context-mode npm upgrade overwrites `build/server.js` + bundles — re-apply (see `~/.pi/agent/memory/consolidated.md`).
- **Machine environment 2026-07-30**: OMP harness, rtk, headroom, `.pi-lens` (533M) and stale add-on dirs removed; active harnesses = pi, codex, reasonix (`~/.pi/agent/memory/harnesses.md`). New live skill `harness-doctor`: verified inventory + transactional provider add/remove.
- **Harness changes are regressions gates (§8.6.1)**: any config change (packages, extensions, APPEND_SYSTEM, compaction, tscg) triggers the canary suite — scores are model–harness-pair properties. Record `config_hash.py` output in every benchmark result; run `preflight.py` before spending tokens (both in `~/.pi/agent/skills/harness-doctor/scripts/`).
- **Do not set `enableMcp: true`** in the lean-ctx config. The bridge triggers intent-based tool-surface expansion (22→78 tools, ~13.6k tok/request on file tasks; measured A/B 2026-07-29, same task: 3,997 vs 13,591). `ctx_edit` falling back to native edit is intended behavior, not a fault.
- Live `~/.pi/agent` sync from this repo is an explicit operator decision (see spec §8).

## Not included (secrets + bulk)

`auth.json`, `models-store.json`, `sessions/`, `npm/node_modules/`, large skill assets. Live-only personal extensions are intentionally not vendored: `invest-tools.ts` (operator's finance tooling). NOTE: `rtk.ts` was removed from live 2026-07-30 — verified inert: lean-ctx replace mode means the model calls `ctx_shell`, not `bash`, so rtk's `bash`-hook never fires (zero invocations since replace mode). It belongs to the OMP harness, which has no lean-ctx.
