# Pi Harness Config

Optimized configuration for the [Pi coding agent](https://pi.dev) — a token-efficient, context-aware setup tuned from 172 sessions of real usage data.

## What's in here

```
pi-harness-config/
├── settings.json          # Pi core: packages, extensions, compaction
├── models.json            # Provider + model definitions (Lilac provider, 4 models)
├── tscg.json              # pi-tscg config (tool-schema compression, maxDesc=30)
├── AGENTS.md              # Project instructions injected into every session
├── lean-ctx/
│   ├── config.toml        # lean-ctx shell config (allowlist disabled)
│   └── pi-config.json     # pi-lean-ctx bridge: replace mode, lean profile
├── rules/
│   └── lean-ctx.md        # Auto-injected rules: ctx_* tool mapping, batching
├── research/
│   └── progressive-disclosure-findings.md  # What works and what doesn't
├── bench/
│   ├── measure.sh         # Short workload bench (list, read, summarize, create)
│   ├── measure-long.sh    # Long workload bench (8-step, triggers compaction)
│   ├── prompt-long.md     # Long workload prompt
│   └── probe.sh           # 1-request probe for per-request fixed overhead
└── skills/
    ├── agent-skills/      # 37 skills in ~/.pi/agent/skills
    └── agents-skills/     # 56 skills in ~/.agents/skills
```

## Optimizations applied

Tuned from analysis of 172 agent sessions (22.6 MB, 2,657 tool calls, 13.7M input tokens).

### 1. Tool consolidation — ~4,500 tokens/request off the schema floor

Removed `@hypabolic/pi-hypa` and `@ff-labs/pi-fff` (7 redundant tools with near-zero usage).
Set `pi-lean-ctx` to `mode: replace` so `ctx_shell`/`ctx_read`/`ctx_grep` become the sole tool family (Pi core `bash`/`read`/`grep` are disabled). Disabled the shell allowlist so `ctx_shell` never blocks.

**Measured:** turn-1 gross context dropped from 14,748 → 10,221 tokens (−30.9%), deterministic across trials. The saving is paid on every cold start and cache miss.

### 2. Session guardrail — ~18-27% of total input tokens

Added a `## Session Guardrail` section to `AGENTS.md` (auto-injected by Pi core via `<project_instructions>`). It tells the agent to suggest `/handoff` at 50 assistant turns and re-suggest at 100.

**Why:** every turn re-sends the entire conversation, so cost grows O(turns²). 5% of sessions consumed 80% of all input tokens. Splitting mega-sessions via `/handoff` resets the context to zero, killing the quadratic cost.

### 3. Tool-schema compression — ~22% per-request reduction

`tscg.json` with `aggressive` profile and `aggressiveMaxDescChars: 30` compresses tool descriptions. Per-request tool-schema overhead dropped from ~14,676 → ~11,385 tokens (−22%).

## Research findings (progressive disclosure & system prompt terseness)

Tested extensively; **most interventions are counterproductive** due to prompt caching. See `research/progressive-disclosure-findings.md` for full details.

**What works:**

- `tscg.json` `aggressiveMaxDescChars: 30` ✅ (already applied)
- Keeping the system prompt STABLE to preserve prompt cache ✅
- Session guardrails (handoff at 50/100 turns) ✅

**What doesn't work (tested and rejected):**

- ❌ System prompt pruning — invalidates prompt cache, net zero or worse
- ❌ Terseness directives — increase request count unpredictably
- ❌ Compaction tuning (keepRecent 20k→8k) — overhead exceeds savings
- ❌ Lean-ctx compression level changes — negligible or destabilizing

**Key insight:** The provider caches the system prompt prefix. The original prompt costs ~14,090 tokens but only ~202 are uncached (cacheRead=13,888). Any modification invalidates the cache, making pruned prompts MORE expensive than the cached original.

## Packages (22)

| Package | Purpose |
| --- | --- |
| `context-mode` | BM25 knowledge base, compressed file reads, session memory |
| `pi-lean-ctx` | Shell/read/grep compression, ctx_* tool family |
| `pi-tscg` | Tool-schema compression (`aggressiveMaxDescChars: 30`) |
| `pi-context-usage` | Passive token observability |
| `pi-cache-graph` | Prompt-cache visualization |
| `pi-cache-optimizer` | Cache-hit optimization |
| `pi-mcp-adapter` | MCP server bridge |
| `pi-slim` | Trims Pi's default system-prompt docs block |
| `pi-web-access` | Web search + fetch tools |
| `pi-autoresearch` | Background research agent |
| `pi-subagents` | Subagent delegation + chaining |
| `cc-safety-net` | Safety checks |
| `@plannotator/pi-extension` | Planning annotations |
| `@narumitw/pi-goal` | Goal tracking |
| `@ogulcancelik/pi-herdr` | Herdr terminal layout integration |
| `@ogulcancelik/pi-model-thinking` | Model thinking level control |
| `@ogulcancelik/pi-model-agents` | Multi-model agent support |
| `pi-herdr-btw` | Herdr by-the-way integration |
| `pi-lens` | Code lens diagnostics |
| `pi-continue` | Continue from checkpoint |
| `pi-smart-compact` | Smart context compaction |
| `@leing2021/super-pi` | Super-pi extensions |

**Extensions** (6 from `@samfp/pi-essentials`): auto-session-name, auto-title, compact-header, clipboard-image, image-context-pruner, markdown-viewer.

## Model setup

- **Default:** `zai-org/glm-5.2` via Lilac provider (changes often — user uses multiple models)
- **Roles:** not configured (user changes models frequently)
- **Thinking:** `medium` (saves reasoning tokens vs `high`)
- **Compaction:** 60k reserve, 20k keep-recent (tested optimal — lower values add overhead)

Available models in `models.json`: Kimi K2.6, GLM 5.2, Gemma 4 31B, MiniMax M3 — all via Lilac (OpenAI-compatible API, env var `LILAC_API_KEY`).

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
cp tscg.json ~/.pi/tscg.json
cp AGENTS.md ~/Projects/AGENTS.md   # or your project root
mkdir -p ~/.pi/agent/extensions/pi-lean-ctx
cp lean-ctx/pi-config.json ~/.pi/agent/extensions/pi-lean-ctx/config.json
mkdir -p ~/.config/lean-ctx
cp lean-ctx/config.toml ~/.config/lean-ctx/config.toml
mkdir -p ~/.pi/rules
cp rules/lean-ctx.md ~/.pi/rules/lean-ctx.md

# 2. Copy skills
cp -r skills/agent-skills/* ~/.pi/agent/skills/
mkdir -p ~/.agents/skills
cp -r skills/agents-skills/* ~/.agents/skills/

# 3. Install packages
pi install npm:context-mode npm:pi-lean-ctx npm:pi-tscg npm:pi-context-usage \
  npm:pi-cache-graph npm:pi-cache-optimizer npm:pi-mcp-adapter npm:pi-slim \
  npm:pi-web-access npm:pi-autoresearch npm:pi-subagents npm:cc-safety-net \
  npm:@plannotator/pi-extension npm:@narumitw/pi-goal npm:@ogulcancelik/pi-herdr \
  npm:@ogulcancelik/pi-model-thinking npm:@ogulcancelik/pi-model-agents \
  npm:pi-herdr-btw npm:pi-lens npm:pi-continue npm:pi-smart-compact npm:@leing2021/super-pi

# 4. Set your API key
export LILAC_API_KEY="your-key-here"
```

## What's NOT included (secrets + bulk)

- `auth.json` — contains real API tokens
- `models-store.json` — 220KB provider catalog with embedded keys
- `sessions/` — personal conversation history
- `npm/node_modules/` — reproducible from the package list
- Large skill assets (images, mp3, zips) — excluded to keep the repo lean

## Skills overview

**agent-skills** (37): the ask-matt engineering flow — `/grill-with-docs`, `/implement`, `/tdd`, `/code-review`, `/handoff`, `/wayfinder`, `/triage`, `/diagnosing-bugs`, plus domain-modeling and codebase-design vocabulary.

**agents-skills** (56): broader toolkit — copywriting, visual design, investment optimization, research, UI design (minimalist, industrial-brutalist, high-end), Ponytail finance skills, and more.
