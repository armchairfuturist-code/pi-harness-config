# CE upstream radar (v1 — doc only, no bot)

**Ticket:** 11 | **Locked:** 2026-07-27
**Purpose:** watch Compound Engineering upstream for mechanisms worth adopting into the CE-lite Pi harness, on a fixed cadence, without automation.

## Watched repos / paths

| Repo / path | Why |
|-------------|-----|
| `EveryInc/compound-engineering-plugin` root + `plugins/compound-engineering/` | Core loop (plan→work→review→compound), skill-orchestrates-agents pattern |
| `CONCEPTS.md`, workflow docs, `skills/ce-compound*` | Compound semantics drift |
| Pi Target / converter paths in that repo | CE lists Pi as a conversion Target — a native Pi output would be adopt-worthy |
| Releases / CHANGELOG | Adopt triggers |
| `QuintinShaw/pi-dynamic-workflows` releases | Our orchestration engine; tier/pattern additions matter |
| `leing2021/super-pi` `docs/token-cost-evaluation.md` | Token-budget discipline benchmark class |
| `SKZL-AI/tscg` releases + changelog | TSCG compiler upstream — may ship deterministic schema compression beyond our heuristic maxDesc=30 truncation |
| `asadani/tool-attention` releases + `arXiV:2604.21816` | Tool Attention / two-phase lazy schema loading — biggest uncaptured token optimization if Pi-native package emerges |
| `majordude/TokenTamer` releases | Real-time code context compression middleware (50-80% claimed). Relevant if we ever want external-to-pi compression at the API boundary. |
| `atlassian-labs/mcp-compressor` releases | Two-wrapper-tool compression pattern. Adaptable to non-MCP tool loading if we want search-first semantics. |

## Cadence

- **Monthly quick diff** (first of month, ~15 min), **or** when friction appears in a CE-lite stage (grill/plan/review/compound feels missing), **or** on a major release notice of a watched repo.
- Radar review is a ce-lite contract: pull CHANGELOGs/diffs, log below, decide per item.

## Adopt / adapt / ignore criteria

- **Adopt** into CE-lite only if ALL: reduces operator gates (fewer things to remember), clears the multi-agent capability bar where relevant, and probe delta is neutral/negative always-on tokens vs the locked 3,919 kernel.
- **Adapt** if: mechanism is right but Claude-shaped (rewrite to pi tools/workflows, e.g. skill → ce-lite phase or dyn-workflows pattern).
- **Ignore** if: marketplace/converter chrome, extra review personas, dev-only assumptions (PR culture), or skill sprawl without AFK gain.

## Log

| Date | Upstream ref | Decision | Reason |
|------|--------------|----------|--------|
| 2026-07-27 | CE CONCEPTS.md + workflow (initial pass, research 03) | adapt | Stole loop + skill-orchestrates-agents + compound store; rejected bulk install |
| 2026-07-27 | super-pi v0.24 token eval | ignore (as install) / adopt (as budget benchmark) | ~4.1k fixed overhead exceeds locked kernel; keep as measurement reference |
|
| 2026-07-28 | Tool Attention (arXiV:2604.21816) | watch | Two-phase tool loading achieves 95% per-turn token reduction. Needs new Pi package — no config toggle reaches this. Radar for when Pi-native impl emerges. |
| 2026-07-28 | SKZL-AI/tscg v? (TSCG deterministic compiler) | watch | Current config uses heuristic maxDesc=30 truncation. TSCG compiler claims 50-72% with accuracy gains. Upgrade pi-tscg to use compiler if/when available. |
| 2026-07-28 | TokenTamer (majordude/TokenTamer) | ignore (at v0) | Context compression at API boundary — interesting concept but v0 quality. Re-evaluate at stable release. |
| 2026-07-28 | ACE context management (arXiV:2606.31564) | ignore (research) | Lossless reversible context management. Pure research, no production impl. Re-evaluate if Pi-native package emerges. |
