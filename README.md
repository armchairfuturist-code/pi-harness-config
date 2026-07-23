# Pi Harness Config

Optimized configuration for the [Pi coding agent](https://pi.dev) — a token-efficient, context-aware setup tuned from 172 sessions of real usage data.

## What's in here

```
pi-harness-config/
├── settings.json              # Pi core: packages, extensions, model roles, compaction
├── models.json                # Provider + model definitions (Lilac provider, 4 models)
├── AGENTS.md                  # Project instructions injected into every session
├── lean-ctx/
│   ├── config.toml            # lean-ctx shell config (allowlist disabled for ungated ctx_shell)
│   └── pi-config.json         # pi-lean-ctx bridge: replace mode, lean profile
├── rules/
│   └── lean-ctx.md            # Auto-injected rules: ctx_* tool mapping, batching, compression
└── skills/
    ├── agent-skills/          # 37 skills in ~/.pi/agent/skills (ask-matt flow, grilling, TDD, etc.)
    └── agents-skills/         # 56 skills in ~/.agents/skills (copywriting, design, research, etc.)
```

## Optimizations applied

Tuned from analysis of 172 agent sessions (22.6 MB, 2,657 tool calls, 13.7M input tokens). Two changes, both validated:

### 1. Tool consolidation — ~4,500 tokens/request off the schema floor

Removed `@hypabolic/pi-hypa` and `@ff-labs/pi-fff` (7 redundant tools with near-zero usage). Set `pi-lean-ctx` to `mode: replace` so `ctx_shell`/`ctx_read`/`ctx_grep` become the sole tool family (Pi core `bash`/`read`/`grep` are disabled). Disabled the shell allowlist so `ctx_shell` never blocks.

**Measured:** turn-1 gross context dropped from 14,748 → 10,221 tokens (−30.9%), deterministic across trials. The saving is paid on every cold start and cache miss.

### 2. Session guardrail — ~18-27% of total input tokens

Added a `## Session Guardrail` section to `AGENTS.md` (auto-injected by Pi core via `<project_instructions>`). It tells the agent to suggest `/handoff` at 50 assistant turns and re-suggest at 100.

**Why:** every turn re-sends the entire conversation, so cost grows O(turns²). The data showed 5% of sessions consumed 80% of all input tokens. Splitting mega-sessions via `/handoff` resets the context to zero, killing the quadratic cost. A 400-turn session costs ~160,000× a 1-turn session; four 100-turn sessions cost a fraction of that.

## Packages (12)

| Package | Purpose |
|---|---|
| `context-mode` | BM25 knowledge base, compressed file reads, session memory |
| `pi-lean-ctx` | Shell/read/grep compression, ctx_* tool family (sole tools in replace mode) |
| `pi-tscg` | Tool-schema compression (`aggressive` profile, `aggressiveMaxDescChars: 30` - tuned to cut per-request tool-schema overhead ~22% without degrading tool-calling) |
| `pi-context-usage` | Passive token observability |
| `pi-cache-graph` | Prompt-cache visualization |
| `pi-cache-optimizer` | Cache-hit optimization |
| `pi-mcp-adapter` | MCP server bridge |
| `pi-slim` | Trims Pi's default system-prompt docs block |
| `pi-web-access` | Web search + fetch tools |
| `pi-autoresearch` | Background research agent |
| `pi-subagents` | Subagent delegation + chaining |
| `pi-btw` | — |

**Extensions** (7 from `@samfp/pi-essentials`): auto-session-name, auto-title, compact-header, clipboard-image, daily-log, image-context-pruner, markdown-viewer.

## Model setup

- **Default:** `moonshotai/kimi-k2.6` via Lilac provider
- **Roles:** `default`/`smol`/`advisor` all → `deepseek/deepseek-v4-flash`
- **Thinking:** `high` by default
- **Compaction:** 60k reserve, 20k keep-recent

Available models in `models.json`: Kimi K2.6, GLM 5.2, Gemma 4 31B, MiniMax M3 — all via Lilac (OpenAI-compatible API, env var `LILAC_API_KEY`).

## Install / Restore

```bash
# 1. Copy config files into place
cp settings.json ~/.pi/agent/settings.json
cp models.json ~/.pi/agent/models.json
cp tscg.json ~/.pi/tscg.json  # pi-tscg config (tool-schema compression)
cp AGENTS.md ~/Projects/AGENTS.md          # or your project root
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
  npm:pi-web-access npm:pi-autoresearch npm:pi-subagents npm:pi-btw

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
