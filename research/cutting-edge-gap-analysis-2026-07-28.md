# Cutting-Edge Gap Analysis — 2026-07-28

**Context:** Web research sweep (arXiv, ACL, GitHub, technical blogs) of token efficiency, execution optimization, and compression research published ~Apr–Jul 2026, compared against pi-harness-config kernel.

## Baseline (locked kernel, 3,919 tok always-on)

| Area | Config state | Finding |
|------|-------------|---------|
| Tool schema compression | tscg aggressive/maxDesc=30 | ✅ Already optimal (TSCG paper confirms 50-72%; measured 6,467 tok savings) |
| Prompt caching | System prompt stable | ✅ Already exploited (findings prove cache invalidation is net-negative) |
| Compaction | reserveTokens=60000, keepRecentTokens=20000 | ✅ Already tested counterproductive |
| Lean-ctx | mode=replace, toolProfile=lean | ✅ Already tested no-effect |
| MCP | Removed (no servers configured) | ✅ Correct decision for current setup |

## Gap: Tool Loading Strategy (not Tool Description Compression)

**Config state:** Flat loading — all tool schemas injected every request (~11k tok).

**Research frontier:**
- **Tool Attention** (arxiv 2604.21816): Intent-schema overlap scoring + two-phase lazy schema loading. Phase 1: compact summaries (~100-500 tok total). Phase 2: full JSON schemas only for top-k tools selected by semantic scoring. **95% per-turn tool token reduction** (47.3k→2.4k in 120-tool benchmark).
- **StackOne search-first**: Semantic retrieval replaces flat catalog. From >400k→6-35k tok for 400 tools.
- **Atlassian mcp-compressor**: Two-wrapper-tool pattern (`get_tool_schema` + `invoke_tool`). 70-97% reduction.
- **Code-based execution**: Agent generates and runs edge filtering. 98-99% reduction (highest, but highest complexity).

**Key difference from config's existing approach:** tscg compresses each tool's description. Two-phase loading changes HOW tools are DISCOVERED — the model sees compact summaries first, fetches full schemas on demand. This operates at the tool-loading layer, not schema-text layer. The compact phase-1 summaries are STABLE (cache-friendly), unlike the progressive-disclosure experiments that modified the system prompt.

**Token estimate for config:** ~11k tool schemas × 5-10 requests = 55k-110k per session. Two-phase could cut to ~1-2k per request = 5k-20k per session. **~70-90% reduction in tool-schema tokens.**

**Barrier:** Requires new Pi package or extension. No config toggle achieves this.

## Gap: Output-Side Compression

**Config state:** No output filtering. Tool responses returned verbatim.

**Research frontier:**
- **Response filtering** (StackOne): Strip tool outputs to only fields the model actually referenced. ~95% output token reduction per call.
- **Code-based execution** (Anthropic MCP): Agent generates filtering code that runs at the edge.
- **ACE** (arxiv 2606.31564): Lossless reversible compression of agent history — stores both raw messages and compressed abstractions.

**Token estimate:** If average tool response is 500 tok and the model keeps 50 tok, 90% output savings per call. With 5-15 tool calls per session, ~2.5k-7.5k tok savings on output side.

**Barrier:** Needs extension or middleware. Not config-level.

## Gap: Semantic Tool-Result Caching

**Config has:** pi-cache-graph + pi-cache-optimizer (general caching).

**Research frontier:**
- **ToolCacheAgent** (OpenReview): Adaptive per-tool caching plans. Automatically generates caching strategies per tool based on invocation patterns. Semantic matching (not just exact-match) broadens cache hits.
- **SpecBox semantic caching** (arxiv 2607.23933): Caches across tool/interface/deterministic-invocation boundaries.

**Config delta:** pi-cache-graph may already do exact-match. Semantic cache across similar parameter sets is additive.

## Gap: Multi-Agent Token Optimization

**Config has:** pi-dynamic-workflows (5 built-in patterns). No cross-agent token optimization.

**Research frontier:**
- **ASCP** (Agent Semantic Communication Protocol): Replaces verbose tool schemas and full histories between agents with compressed semantic representations.
- **SUPO** (ACL 2026): RL-based joint optimization of tool-use + summarization for long-horizon agents.

## Not Gaps (confirmed covered or N/A)

| Research area | Why not a gap |
|--------------|---------------|
| Speculative execution (PASTE, SpecBox, B-PASTE) | Latency optimization. Config's binding constraint is token cost, not wall-clock. |
| SkillReducer | Config already at aggressive tscg maxDesc=30 (functional equivalent). |
| TSCG paper | Config already uses pi-tscg at maxDesc=30 (aggressive profile). |
| MCP compression | MCP removed as dead weight. Re-add only if MCP servers are configured. |
| ACON / context window extension | Config has 524K-1M context models. Ceiling not binding for typical workloads. |

## Recommendations

1. **Highest impact, highest effort:** Build `pi-tool-router` package — two-phase tool loading with semantic search + on-demand schema fetch. Could cut 55k-110k tok/session from tool schemas.
2. **Medium impact, medium effort:** Response-filtering extension — tool output post-processor that strips verbatim returns to only needed fields.
3. **Watch:** Semantic caching improvements for pi-cache-graph (parameter-aware cache keys).
