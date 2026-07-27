# 09 — Grill: keep / kill / progressive-disclose lists

Type: grilling
Status: resolved
Blocked by: 01, 07, 08

## Question

Final lists: packages, extensions, skills, rules — **keep (always-on)**, **keep (lazy/discoverable)**, **kill**, **domain library (optional off)**. Default delete when unsure. Domain library stays separate. Matt skills are not operator surface.

## Answer

**Resolved AFK under handoff contract.** Schema costs from the 2026-07-27 probe captures (07); zero-schema items audited by package description + capture evidence (no tools in request = no always-on cost).

### Packages

**KEEP — schema-bearing kernel (measured):**
- `pi-lean-ctx` (replace+lean profile; 18 ctx tools ≈ the tool surface)
- `context-mode` (engine behind the lean-ctx bridge; load-bearing)
- `@quintinshaw/pi-dynamic-workflows` (orchestrator spine; +627 tok)

**KEEP — zero-schema hooks/commands (verified 0 always-on tools in capture):**
- `pi-tscg` — tool-schema/result compression (efficiency core)
- `pi-slim` — slims pi default system prompt (part of the 1.9k system)
- `pi-cache-optimizer` — KV cache hit rates (PD findings: cache dominates cost)
- `pi-cache-graph` — cache distribution viz (flag: kill candidate if unused in 30 days, saves nothing)
- `pi-context-usage` — context window meter (operator visibility)
- `pi-continue` — mid-turn continuation for long AFK runs
- `pi-autoresearch` — experiment loops (power tool; loop-shaped campaigns post-glla)
- `@plannotator/pi-extension` — optional interactive plan checkpoint
- `@ogulcancelik/pi-model-agents` — model-specific AGENTS.md (supports role routing)
- `@ogulcancelik/pi-model-thinking` — auto thinking levels per model
- `cc-safety-net` — blocks destructive commands (essential for non-dev operator)
- `pi-herdr-btw` — human side thread (locked 08)

**KILL (measured schema cost or dead weight):**
- `pi-mcp-adapter` — no MCP servers configured; 1,125 schema chars of dead weight
- `pi-goal-list-loop-audit` — 11 tools ≈ 1,100 tok; incompatible with 30% lock (07)
- `pi-web-access` — 4 tools ≈ 1,084 tok; web moves to dyn-workflows children (07). Optional operator overlay: `pi install npm:pi-web-access` re-adds (+~1,084 tok, budget then −13.6% — explicit trade)
- `pi-subagents` — never activate (+3,810 tok; fails ceiling)

### Extensions

**KEEP (lazy/UI, zero schema):** @samfp/pi-essentials ×6 — auto-session-name, auto-title, clipboard-image (screenshot paste for non-dev), compact-header, image-context-pruner (token-relevant), markdown-viewer.

**KILL:**
- `extensions/delegate.ts` — superseded by dyn-workflows (08); −128 chars

### Skills

**Always-on descriptions (≈230 chars total):**
- `ce-lite` (NEW — the single orchestrator; model-invocable)
- `workflow-authoring`, `workflow-patterns` (ship with dyn-workflows)

**KEEP — lazy library, `disable-model-invocation` (measured 0 always-on), backends the ce-lite orchestrator reads, never operator gates:**
- All 26 matt skills (implement, tdd, research, diagnosing-bugs, code-review, wayfinder, to-spec, handoff, grilling, etc.). Operator never types them; nothing to memorize. No kills — they cost zero and are mechanism donors.

**Domain library (optional, default OFF):**
- Repo `skills/agents-skills/` + domain packs (ponytail-*, invest-optimizer, etc.) stay OUT of the live skills dir; installed per-project only, never always-on.

### Rules / overlays

- No global rules files in the live agent dir (live already has none — keep it that way).
- Repo `rules/lean-ctx.md` remains repo documentation, not a runtime overlay.
- Project-level AGENTS.md discovery unchanged (pi default).

### Models / misc

- `~/.pi/workflows/model-tiers.json` — new role-pin file (ticket 10); created on apply.
- Repo default model stays Lilac/glm-5.2 (bench comparability); live default stays Venice/kimi-k3 — per-operator, documented, not synced.
