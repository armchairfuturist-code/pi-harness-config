# 02 — Minimal harness & context engineering

**Ticket:** 02  
**Date:** 2026-07-27  
**Method:** Primary sources + brief 2024–2026 notes; aligned with repo PD findings.

## Primary claims

### 1. Progressive disclosure is the default skill architecture (Anthropic)

Source: [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) (Anthropic Engineering).

- At startup, agent pre-loads only skill **name + description** (level 1).
- Full `SKILL.md` body loads on relevance (level 2).
- Further files/scripts load on demand (level 3+).
- Skills are composable expertise packs, not always-on manuals.

**Implication:** Always-on should be *index*, not *library*. Destination “near-zero skill bodies always-on” matches upstream best practice. Even descriptions should be few if the operator uses one orchestrator.

### 2. Tool-definition bloat is a first-class cost (Anthropic MCP)

Source: [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp).

- Loading many tool definitions upfront consumes context and money.
- Intermediate tool results also burn tokens when passed through the model.
- Pattern: fewer direct tools in context; discover/execute via code or search when tool counts scale.

**Implication:** Essential tools only in schema; rest via tool-search / lean wrappers (`ctx_*`, tscg compression). Supports ≥30% always-on cut via schema cull more than via prose nips.

### 3. This repo’s PD experiments (local primary)

Source: `research/progressive-disclosure-findings.md` (2025-07-25).

Key conclusions already measured here:
- **Prompt caching dominates** total cost; unstable always-on prefixes destroy cache hits.
- Aggressive system-prompt pruning / terseness directives can be **counterproductive** if they churn the cached prefix.
- What drives total cost: conversation growth + tool results + cache misses — not only fixed overhead.
- Recommendation bias: keep **stable** always-on; cut **schema** and **skill description count**; don’t constantly rewrite system prompt.

**Implication for ≥30% fixed-overhead target:** Prefer deleting packages/tools/skill descriptions over clever prompt rewrites that bust cache. Measure with `bench/probe.sh`.

### 4. Brief external “minimal harness” notes

- Community “minimal harness” repos exist (e.g. minimal-harness / harness-engineering posts) emphasizing small system prompts and explicit tool surfaces — treat as secondary; Anthropic primaries above are stronger.
- Super Pi publishes ~4.1k new-conversation fixed cost with progressive loading ([token-cost-evaluation](https://github.com/leing2021/super-pi/blob/main/docs/token-cost-evaluation.md)) — useful **benchmark class**, not a floor to copy.

## Design implications for our destination

| Principle | CE-lite thin Pi action |
|-----------|------------------------|
| Progressive disclosure | One orchestrator skill/workflow description always-on; backends lazy |
| Tool schema diet | Keep lean-ctx/tscg path; audit every package for tools added |
| Stable prefix | Freeze kernel prompt; no experiment-of-the-day in always-on |
| Cache-aware | Optimize for cache hit rate (already strong via cache-optimizer) **and** lower fixed floor |
| Non-dev | Don’t expose disclosure ladder to user — orchestrator loads stages |
| Overlays | Prefer tool-local docs / skill references over global rules files |

## Open questions for grilling (07)
- Exact list of tools that must remain direct-call vs search-discovered
- Whether Pi supports true skill-description stripping for `disable-model-invocation` at scale
- Target absolute probe number once baseline measured
