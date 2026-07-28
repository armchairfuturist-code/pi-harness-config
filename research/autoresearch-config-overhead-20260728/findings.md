# Findings — Autoresearch: Config Fixed-Overhead (2026-07-28)

> Branch `autoresearch/config-overhead-20260728`. 27 runs. Baseline 4,016 → final **4,007** (−9 tok).
> Session goal was polish-and-verify on an already-lean config; a near-null result was expected and is the outcome.

## Verdict

**~4,007 is a local optimum for this architecture.** Every component is now cost-attributed.
Only one safe cut survived measurement: tightening the APPEND_SYSTEM.md overlay (−9 tok, semantics preserved).
Everything else is either **free** (0 tok), **load-bearing** (pi-tscg, pi-slim), or an **operator workflow
decision** (context-mode, pi-dynamic-workflows, pi-lean-ctx — 3,000 tok of tool surface that is used daily).

## Per-component cost attribution (fixed overhead, tok; removal-probe deltas vs 4,016)

| Component | Cost | Notes |
|---|---:|---|
| context-mode | **1,757** | ctx_* tool surface. Checks pass without it (bench workload doesn't exercise ctx tools) — removal is a workflow decision, not a bug |
| @quintinshaw/pi-dynamic-workflows | **627** | workflow tool schemas; overlay doctrine routes to it |
| pi-lean-ctx | **616** | lean_ctx bridge. Already minimal: `toolProfile:"lean"` is the floor ("adds nothing", per its config.ts) |
| pi-cache-optimizer | 2 | noise-level |
| pi-model-agents, pi-model-thinking, @plannotator, cc-safety-net, pi-autoresearch, pi-cache-graph, pi-continue, pi-herdr-btw, pi-context-usage | **0** each | zero fixed payload contribution — no token reason to remove |
| 6× pi-essentials extensions (auto-session-name, auto-title, clipboard-image, compact-header, image-context-pruner, markdown-viewer) | **0** each | UI/lifecycle only, fully lazy |
| pi-slim | **−323 (saves)** | removing it raises probe to 4,339. Keep |
| pi-tscg | **−6,467 (saves)** | removing it raises probe to 10,483. Most load-bearing component in the config (README said ~6,000; measured 6,467) |
| APPEND_SYSTEM.md overlay | 93 → **84** | tightened wording kept (`f0fca10`); doctrine identical by diff |
| skills/ metadata | **0** | skills-only-ce-lite probe: Δ0. Skills are fully lazy — skill trimming is out of scope permanently |
| defaultThinkingLevel | **0** | minimal vs medium: Δ0. Not an overhead lever |
| rtk.ts (live-only drift) | unmeasured | probing it requires editing build-variant.sh (a ruler) — left for operator adopt/drop decision |

Decomposition: base floor ≈ 920 tok (core system prompt + core tools, tscg-compressed) + 3,087 attributed
surface. Combined context-mode+lean-ctx removal = 2,428 ≈ sum of parts (2,373) + 55 interaction:
**no schema duplication** between them — the dedup hypothesis is refuted.

## Kept change

- `f0fca10` — APPEND_SYSTEM.md: 93 → 84 actual tok. Directives, pattern enumeration, and skill path all
  preserved; only grammar compressed. checks_pass=1, reproducible on re-run.

## Recommended operator actions

1. **Apply overlay tightening to live** `~/.pi/agent/APPEND_SYSTEM.md` (copy from repo) → −9 tok. Then
   cold/proxied canary: expect ≤ 4,007.
2. **rtk.ts drift**: adopt into repo or drop from live `~/.pi/agent/extensions/` — currently unmeasured.
3. **models.json drift**: live is 7.5 KB vs repo 2.2 KB (invisible to probe; matters at reinstall). Sync.
4. **No package removals recommended.** 15 packages measured: 9 are free, 3 are tool surface in daily use,
   pi-slim/pi-tscg save 6,790 combined, pi-cache-optimizer is noise-level.
5. **Fix the canary**: `bench/probe.sh` (direct) is cache-contaminated — a warm prefix false-greens
   regressions (observed 2,356 on a 4,014 payload). Route through the capture proxy or gate cold-only.
6. **Upstream report**: pi-lean-ctx doubled-`agent/` config path when `PI_CODING_AGENT_DIR` is set
   (#930 half-fix) — +14.7k tok phantom in any relocated agent dir.

## Not pursued (with reasons)

- Dropping the workflow-pattern enumeration from the overlay (~−15 tok more): the workflow tool schema does
  not list pattern names; removing them degrades proactive routing. Judged net-negative, unmeasured.
- pi-slim tuning: no knobs exist (binary on/off, already on).
- context-mode tool-surface config: no user-facing config mechanism found (its configs/ are for other harnesses).
- `compaction.*`: invisible to the 1-request probe by design; needs the long-session bench (separate session).
- Real-workload A/B (`bench-systima rig/run-pi-ab.sh`) for the kept overlay change: 9-tok text rewording is
  below workload noise; behavioral checks already green. Optional for the operator.

## Method notes for future sessions

- Attribution probes are cheap and high-value: 21 single-removal probes at ~9 s each built the full cost table.
- All removal probes passed checks — the workload bench does not exercise extension features; "checks pass"
  ≠ "safe to remove" for tool-surface packages. Cost attribution is the right frame; keep/discard for
  tool-surface packages is a usage question, not a correctness question.
- Proxied measurement held deterministic (±1–2 tok) throughout; baseline reproduced exactly (4,016 twice).
