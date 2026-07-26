# Pi Harness Config

Optimized configuration for the [Pi coding agent](https://pi.dev) — a token-efficient, context-aware setup tuned from 172 sessions of real usage data, 10+ autoresearch benchmark experiments, and a prompt-quality autoresearch study.

## What's in here

```
pi-harness-config/
├── settings.json            # Pi core: 17 packages, 7 extensions, compaction
├── models.json              # Provider + model definitions (Lilac provider)
├── scripts/
│   └── ensure-reasoning-levels.js # Inject thinkingLevelMap (xhigh/max) for any reasoning-effort model
├── tscg.json                # pi-tscg config (tool-schema compression, maxDesc=30)
├── AGENTS.md                # Project instructions injected into every session
├── extensions/
│   └── delegate.ts          # Minimal subagent tool (24 tok vs 3,808)
├── lean-ctx/
│   ├── config.toml          # lean-ctx shell config (allowlist disabled)
│   └── pi-config.json       # pi-lean-ctx bridge: replace mode, lean profile
├── rules/
│   └── lean-ctx.md          # Auto-injected rules: ctx_* tool mapping, batching
├── research/
│   └── progressive-disclosure-findings.md  # What works and what doesn't
├── bench/
│   ├── measure.sh           # Short workload bench (list, read, summarize, create)
│   ├── measure-long.sh      # Long workload bench (8-step, triggers compaction)
│   ├── prompt-long.md       # Long workload prompt
│   └── probe.sh             # 1-request probe for per-request fixed overhead
└── skills/
    ├── mattpocock/ # 22 engineering + productivity skills
    ├── agents-skills/ # 14 domain skills (finance, health, copy, ponytail, etc.)
    └── prompt-sharpen/ # opt-in vague-request sharpener
```

## Optimizations applied

### 1. Tool consolidation — ~4,500 tokens/request off the schema floor

Removed `@hypabolic/pi-hypa` and `@ff-labs/pi-fff` (7 redundant tools with near-zero usage).
Set `pi-lean-ctx` to `mode: replace` so `ctx_shell`/`ctx_read`/`ctx_grep` become the sole tool family (Pi core `bash`/`read`/`grep` are disabled). Disabled the shell allowlist so `ctx_shell` never blocks.

**Measured:** turn-1 gross context dropped from 14,748 → 10,221 tokens (−30.9%), deterministic across trials.

### 2. Session guardrail — ~18-27% of total input tokens

Added a `## Session Guardrail` section to `AGENTS.md` (auto-injected by Pi core via `<project_instructions>`). It tells the agent to suggest `/handoff` at 50 assistant turns and re-suggest at 100.

**Why:** every turn re-sends the entire conversation, so cost grows O(turns²). 5% of sessions consumed 80% of all input tokens. Splitting mega-sessions via `/handoff` resets the context to zero, killing the quadratic cost.

### 3. Tool-schema compression — ~22% per-request reduction

`tscg.json` with `aggressive` profile and `aggressiveMaxDescChars: 30` compresses tool descriptions. Per-request tool-schema overhead dropped from ~14,676 → ~11,385 tokens (−22%).

### 4. Lean package selection — 63.5% per-request reduction

Removed 6 expensive packages (measured individually via probe.sh), replaced with minimal alternatives. Per-request overhead: 14,698 → 5,394 tokens. See package tables below.

### 5. Minimal subagent extension — 159× cheaper than pi-subagents

Custom `delegate.ts` extension provides subagent capability (spawn fresh agent session, read/bash/grep/find/ls tools) for 24 tokens/req vs 3,808 for pi-subagents.

## Research findings (progressive disclosure & system prompt terseness)

Tested extensively; **most interventions are counterproductive** due to prompt caching. See `research/progressive-disclosure-findings.md` for full details.

**What works:**

- ✅ `tscg.json` `aggressiveMaxDescChars: 30` — ~22% tool-schema reduction
- ✅ Package removal — measured each package's token cost, removed the expensive ones
- ✅ Minimal `delegate.ts` extension — subagent capability at 24 tokens vs 3,808
- ✅ Skills (mattpocock) — zero per-request cost, loaded on-demand
- ✅ Keeping the system prompt STABLE — preserves prompt cache (cached original is cheaper than any pruned version)
- ✅ Session guardrails — handoff at 50/100 turns kills quadratic cost growth

**What doesn't work (tested and rejected):**

- ❌ **System prompt pruning** — invalidates prompt cache. Pruned 55% of system prompt (7720→3447 bytes) but total tokens stayed at 14,090 because cacheRead dropped from 13,888 to 13,312 while uncached input rose from 202 to 797. Net zero or worse.
- ❌ **End-only prompt pruning** (removing Pi docs block only) — complete cache invalidation. Total went from 14,090 to 14,698 (cacheRead=0). Any modification to the system prompt invalidates the entire cache prefix.
- ❌ **Terseness directives** (adding "be concise" instructions to system prompt) — increased request count unpredictably (5→10 requests). Aggressive directive: 153k vs 85k baseline. Mild directive: 119k vs 85k. Directives change model behavior, not just output format.
- ❌ **Compaction tuning** (keepRecentTokens 20k→8k) — overhead exceeds savings on workloads <50 requests. Short workload: no effect. Long workload: 113k vs 85k baseline (worse).
- ❌ **Lean-ctx ephemeral threshold** (ephemeral_min_tokens 2000→800) — no measurable effect. Tool outputs in the bench workload are too small to trigger the ephemeral firewall.
- ❌ **Lean-ctx compression level changes** (lite→standard→max) — negligible savings (~30 tokens) but destabilized model behavior. Reverted.

**Key insight:** The provider caches the system prompt prefix. The original prompt costs ~14,090 tokens but only ~202 are uncached (cacheRead=13,888). Any modification invalidates the cache, making pruned prompts MORE expensive than the cached original.

**Research alignment:** The research findings about "hierarchical pruning" and "sliding windows" apply to long sessions (50+ requests) where context genuinely exceeds model limits. For short workloads (5-10 requests), these techniques add overhead without benefit. "Progressive disclosure" via system prompt modification is counterproductive when prompt caching is active.

## Packages (17 — lean config)

Measured token cost per package (via probe.sh, 2025-07-25):

| Package | Tokens/Req | Purpose |
| --- | --- | --- |
| `context-mode` | 1,757 | BM25 knowledge base, compressed file reads, ctx_* tools (ESSENTIAL) |
| `pi-goal-list-loop-audit` | 1,025 | Goal/loop/audit with isolated auditor (replaces super-pi + pi-goal) |
| `pi-web-access` | 718 | Web search + fetch tools |
| `pi-lean-ctx` | included | Shell/read/grep compression, ctx_* tool family |
| `pi-tscg` | 0 | Tool-schema compression (`aggressiveMaxDescChars: 30`) |
| `pi-slim` | 0 | Trims Pi's default system-prompt docs block |
| `pi-mcp-adapter` | 0 | MCP server bridge |
| `pi-autoresearch` | 0 | Background research agent |
| `pi-continue` | 0 | Continue from checkpoint |
| `cc-safety-net` | 0 | Safety checks |
| `@plannotator/pi-extension` | 0 | Planning annotations |
| `pi-context-usage` | 0 | Passive token observability |
| `pi-cache-graph` | 0 | Prompt-cache visualization |
| `pi-cache-optimizer` | 0 | Cache-hit optimization |
| `@ogulcancelik/pi-model-thinking` | 0 | Model thinking level control |
| `@ogulcancelik/pi-model-agents` | 0 | Multi-model agent support |
| `pi-herdr-btw` | 0 | Herdr by-the-way integration |

**Total per-request overhead: ~5,394 tokens (down from 14,698 — 63.5% reduction)**

### Removed packages (measured cost, justified removal)

| Package | Cost | Why removed |
| --- | --- | --- |
| `pi-subagents` | 3,808 | Most expensive package (26% of total). Massive tool schema. Replaced by `delegate.ts` (24 tok). |
| `@leing2021/super-pi` | 2,884 | 31 tool names, CE pipeline overlap with mattpocock skills + pi-goal-list-loop-audit |
| `@ogulcancelik/pi-herdr` | 1,590 | Only useful with Herdr terminal multiplexer |
| `pi-lens` | 1,271 | LSP diagnostics available via built-in tools |
| `@narumitw/pi-goal` | 526 | Replaced by pi-goal-list-loop-audit |
| `pi-smart-compact` | 275 | Overlaps with built-in compaction |

## Extensions (6 from `@samfp/pi-essentials` + 1 custom)

- `@samfp/pi-essentials`: auto-session-name, auto-title, compact-header, clipboard-image, image-context-pruner, markdown-viewer
- `delegate.ts` — minimal subagent tool (24 tokens vs 3,808 for pi-subagents). Spawns a fresh pi agent session via `createAgentSession()` with read/bash/grep/find/ls tools.

## Skills (39 — all user-invoked, zero per-request cost)

**All 39 skills have `disable-model-invocation: true`** — none auto-load into context.
This saves ~1,380 tokens/turn (previously 29 model-invoked skill descriptions were
injected every turn). Reach any skill via `/ask-matt`, the global router.

**`/ask-matt`** — router over every skill. Describe your situation; it names the
skill or flow to run. Covers the full idea→ship engineering flow (grill → spec →
tickets → implement → review) plus all domain and utility skills.

**Engineering (22, from mattpocock/skills):** ask-matt (router), codebase-design,
code-review, diagnosing-bugs, domain-modeling, grill-me, grill-with-docs, grilling,
handoff, implement, improve-codebase-architecture, prototype, research,
resolving-merge-conflicts, setup-matt-pocock-skills, tdd, teach, to-spec,
to-tickets, triage, wayfinder, writing-great-skills

**Domain & utility (17):** impeccable (UI design — the sole design skill),
last30days, invest-optimizer, calibrate-longevity, ai-consultant-career,
conversion-copywriting, prompt-sharpen, caveman-compress, full-output-enforcement,
ponytail (+ ponytail-audit/debt/gain/help/review), system-health-check, find-skills

**Removed:** 5 UI-design sprawl skills (design-taste-frontend, high-end-visual-design,
industrial-brutalist-ui, minimalist-ui, stitch-design-taste) — superseded by
`/impeccable`, which covers all frontend design comprehensively.

Key skills:
- `/ask-matt` — global router; describe the situation, get the skill or flow
- `/handoff` — replaces super-pi's context_handoff + session_checkpoint
- `/code-review` — replaces super-pi's 7 reviewer tools with one skill
- `/prompt-sharpen` — turn a vague request into a sharp brief before running
- `/writing-great-skills` — methodology for writing skills (no-op test, single source of truth)
- `/improve-codebase-architecture` — scans for deepening opportunities, produces HTML report (uses `delegate` for codebase exploration)

See [WORKFLOW.md](WORKFLOW.md) for how to use these skills with pi-goal-list-loop-audit and delegate.

## Model setup

- **Default:** `zai-org/glm-5.2` via Lilac provider (changes often — user uses multiple models)
- **Roles:** not configured (user changes models frequently)
- **Thinking:** `medium` by default (saves reasoning tokens vs `high`); `xhigh`/`max` available on reasoning-effort models
- **Compaction:** 60k reserve, 20k keep-recent (tested optimal — lower values add overhead)

Available models in `models.json`: Kimi K2.6, GLM 5.2, Gemma 4 31B, MiniMax M3 — all via Lilac (OpenAI-compatible API, env var `LILAC_API_KEY`).

### Config flow: models.json → runtime

Pi reads `~/.pi/agent/models.json` as the **source of truth**, but the runtime model used for API calls lives in `~/.pi/agent/models-store.json` — an enriched cache that adds per-model `compat`, `cost`, and `thinkingLevelMap` fields via pi-ai's `provider-composer` merge layer. The key merge rule:

```js
// provider-composer.js — thinkingLevelMap from models.json merges into runtime
thinkingLevelMap: override.thinkingLevelMap
  ? {...model.thinkingLevelMap, ...override.thinkingLevelMap}
  : model.thinkingLevelMap,
```

This means **anything you set in `models.json` flows through to the runtime** — including `thinkingLevelMap`, per-model `compat`, and `maxTokens`. You do **not** need to edit `models-store.json` directly.

### Reasoning levels (xhigh / max)

Pi's shift-tab thinking dial only shows `xhigh`/`max` when a model's `thinkingLevelMap` explicitly defines them — a model can have `supportsReasoningEffort: true` yet still hide those levels if the map is absent. The gate is in pi-ai's `models.js`:

```js
// getSupportedThinkingLevels — xhigh/max are gated on the map
if (level === "xhigh" || level === "max")
  return model.thinkingLevelMap?.[level] !== undefined;
```

`models.json` ships with `thinkingLevelMap` set on every reasoning-effort-capable model:

```json
"thinkingLevelMap": {
  "minimal": "low",   // clamps to lowest accepted API value
  "low":     "low",
  "medium":  "medium",
  "high":    "high",
  "xhigh":   "xhigh",
  "max":     "max"
}
```

The provider/model-agnostic script `scripts/ensure-reasoning-levels.js` re-derives these maps from the `reasoning` + `supportsReasoningEffort` flags (checks per-model compat, falls back to provider-level compat). Run it after adding any new provider or model:

```bash
node scripts/ensure-reasoning-levels.js models.json              # repo source
node scripts/ensure-reasoning-levels.js ~/.pi/agent/models.json  # live config
```

### defaultThinkingLevel and per-model overrides

`settings.json` has `defaultThinkingLevel` — the thinking level Pi starts each session with. Acceptable values: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. Defaults to `off` (no reasoning effort unless changed by shift-tab).

For **per-model overrides** (persist a thinking level across sessions for a specific model), use `~/.pi/agent/model-thinking.json` (managed by `@ogulcancelik/pi-model-thinking`):

```json
{
  "providers": {
    "Lilac": "medium"
  },
  "models": {
    "Lilac/zai-org/glm-5.2": "high"
  }
}
```

Model-level entries override provider-level entries. To clear all per-model pins: `/model-thinking reset`.

### Lilac provider verification

To verify the endpoint is pulling correct model configuration:

```bash
# 1. Check the endpoint responds and returns valid model data
curl -s https://api.getlilac.com/v1/models -H "Authorization: Bearer $LILAC_API_KEY" | python3 -m json.tool

# 2. Check a specific model accepts reasoning_effort (for GLM 5.2)
curl -s https://api.getlilac.com/v1/chat/completions \
  -H "Authorization: Bearer $LILAC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/glm-5.2","messages":[{"role":"user","content":"say ok"}],"max_tokens":16,"reasoning_effort":"xhigh"}'
```

Compare the `supported_parameters` array from `/v1/models` against `models.json`:

| Field | Source | Where to check |
| --- | --- | --- |
| `reasoning_effort` in `supported_parameters` | Live API `/v1/models` | Only GLM 5.2 has it — others accept/ignore it silently |
| `supportsReasoningEffort` | `models.json` compat flag | Must be `true` for the reasoning effort dial to send `reasoning_effort` |
| `thinkingLevelMap` | `models.json` model field | Must define `xhigh` and `max` for them to appear in shift-tab |
| `contextWindow` / `maxTokens` | `models.json` | Verify against API `top_provider.context_length` / `max_completion_tokens` |

If the endpoint returns HTTP 200 but reasoning levels still don't appear:
1. Check `models.json` has `"supportsReasoningEffort": true` in the provider-level `compat`
2. Check the model has `"reasoning": true`
3. Check the model has `thinkingLevelMap` with `"xhigh": "xhigh"` and `"max": "max"`
4. Run `node scripts/ensure-reasoning-levels.js ~/.pi/agent/models.json`
5. Restart pi fully (not just reload)

## Troubleshooting

### xhigh / max don't appear in shift-tab thinking dial

The shift-tab dial only shows `xhigh`/`max` when all three conditions are met:

1. `models.json` has `compat.supportsReasoningEffort: true` (provider-level or per-model)
2. The model has `reasoning: true`
3. The model has a `thinkingLevelMap` with non-null values for `xhigh` and `max`

Run the diagnostic:

```bash
# Check what levels pi thinks are available for your current model
node -e "
  const fs = require('fs');
  const d = JSON.parse(fs.readFileSync(process.env.HOME + '/.pi/agent/models.json', 'utf8'));
  const models = d.providers?.Lilac?.models || [];
  for (const m of models) {
    const effort = m.compat?.supportsReasoningEffort ?? d.providers?.Lilac?.compat?.supportsReasoningEffort;
    console.log(m.id, 'reasoning:', m.reasoning, 'effort:', effort, 'map:', m.thinkingLevelMap ? 'present' : 'MISSING');
  }
"
```

If the map is missing, run the fix:

```bash
node scripts/ensure-reasoning-levels.js ~/.pi/agent/models.json
# Then restart pi fully
```

### Skill conflict: "SKILL.md collision"

If you see `[Skill conflicts] <skill-name> collision` at session start, a skill exists in both `~/.pi/agent/skills/<name>/SKILL.md` and `~/.agents/skills/<name>/SKILL.md`. Pi loads the user (`.pi`) copy and skips the system (`.agents`) copy, but the warning persists. Fix by removing the duplicate:

```bash
# Check which skills have duplicates
for d in ~/.agents/skills/*/SKILL.md; do
  name=$(basename $(dirname "$d"))
  [ -f ~/.pi/agent/skills/$name/SKILL.md ] && echo "CONFLICT: $name"
done

# Remove the .agents duplicate (keeps the .pi user copy)
rm ~/.agents/skills/<conflicting-skill>/SKILL.md
```

### models.json changes not taking effect

Pi reads `models.json` into an in-memory cache on startup. If you edit the file while a session is running, **restart pi fully** (not just reload). To verify the runtime loaded your changes:

```bash
# Check the runtime store reflects your models.json
node -e "
  const d = JSON.parse(require('fs').readFileSync(process.env.HOME + '/.pi/agent/models-store.json', 'utf8'));
  const glm = d.Lilac?.models?.find(m => m.id === 'zai-org/glm-5.2');
  console.log('GLM 5.2 supportsReasoningEffort:', glm?.compat?.supportsReasoningEffort);
  console.log('GLM 5.2 thinkingLevelMap:', glm?.thinkingLevelMap ? 'present' : 'MISSING');
"
```

### Reasoning effort sent but ignored by API

Some models accept `reasoning_effort` silently (HTTP 200) but don't actually use it. Check the API's `supported_parameters` in the `/v1/models` response — only models with `"reasoning_effort"` in that list truly support the dial. For Lilac, only `zai-org/glm-5.2` currently lists it. The others (kimi, gemma, minimax) accept the param without error but ignore it.

## Bench tooling

```bash
# Short workload (4-6 requests)
./bench/measure.sh 3

# Long workload (8 steps, tests compaction)
./bench/measure-long.sh 3

# Quick per-request overhead probe
./bench/probe.sh
```

All benches report `totalInputTokens` (Σ input + cacheRead + cacheWrite across requests) and verify correctness checks pass.

## Install / Restore

```bash
# 1. Copy config files into place
cp settings.json ~/.pi/agent/settings.json
cp models.json ~/.pi/agent/models.json
# 1a. (Optional) re-derive thinkingLevelMap for any new reasoning-effort models
node scripts/ensure-reasoning-levels.js ~/.pi/agent/models.json
cp tscg.json ~/.pi/tscg.json
cp AGENTS.md ~/Projects/AGENTS.md   # or your project root
mkdir -p ~/.pi/agent/extensions/pi-lean-ctx
cp lean-ctx/pi-config.json ~/.pi/agent/extensions/pi-lean-ctx/config.json
mkdir -p ~/.config/lean-ctx
cp lean-ctx/config.toml ~/.config/lean-ctx/config.toml
mkdir -p ~/.pi/rules
cp rules/lean-ctx.md ~/.pi/rules/lean-ctx.md

# 1b. Copy delegate extension (minimal subagent tool)
cp extensions/delegate.ts ~/.pi/agent/extensions/delegate.ts

    ├── mattpocock/ # 22 engineering + productivity skills
cp -r skills/mattpocock/* ~/.pi/agent/skills/

# 3. Install packages (17 — lean config, ~5,394 tokens/req)
pi install npm:context-mode npm:pi-lean-ctx npm:pi-tscg npm:pi-context-usage \
  npm:pi-cache-graph npm:pi-cache-optimizer npm:pi-mcp-adapter npm:pi-slim \
  npm:pi-web-access npm:pi-autoresearch npm:pi-continue npm:cc-safety-net \
  npm:@plannotator/pi-extension npm:pi-goal-list-loop-audit \
  npm:@ogulcancelik/pi-model-thinking npm:@ogulcancelik/pi-model-agents \
  npm:pi-herdr-btw

# 4. Set your API key
export LILAC_API_KEY="your-key-here"

# 5. Resolve skill conflicts (if any)
# Skills in ~/.agents/skills/ collide with ~/.pi/agent/skills/ when both
# contain a SKILL.md for the same skill name. Remove the duplicate:
#   ls ~/.agents/skills/<skill-name>/SKILL.md  # if this exists, delete it
#   rm ~/.agents/skills/<skill-name>/SKILL.md
```

## What's NOT included (secrets + bulk)

- `auth.json` — contains real API tokens
- `models-store.json` — ~9000-line enriched runtime cache that pi reads at runtime. It's auto-generated by pi-ai's `provider-composer` from `models.json` + built-in provider data, adding per-model `compat`, `cost`, and `thinkingLevelMap` fields. **You do not edit this file** — edit `models.json` instead; changes merge through on next load. Excluded because it contains cached API cost data and can be 200KB+.
- `sessions/` — personal conversation history
- `npm/node_modules/` — reproducible from the package list
- Large skill assets (images, mp3, zips) — excluded to keep the repo lean
