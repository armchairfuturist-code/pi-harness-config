# Pi Agent — Full Configuration Export

> **Pi version**: `0.80.7`  
> **Generated**: 2026-07-14  
> **Purpose**: Replicate this Pi setup on another machine with identical configuration.
>
> **Corrected 2026-07-30**: package lists (snapshot below, the §6 table, and Step 5) updated to the current 15 packages. All other values (provider/model defaults, thinking level, dates) remain a 2026-07-14 snapshot — the live repo `settings.json`/`models.json` are authoritative.

---

## Table of Contents

1. [Directory Structure](#1-directory-structure)
2. [Core Config: `settings.json`](#2-core-config-settingsjson)
3. [Provider Config: `models.json`](#3-provider-config-modelsjson)
4. [Auth Config: `auth.json`](#4-auth-config-authjson)
5. [Context Prune Settings](#5-context-prune-settings)
5b. [TSCG Configuration](#5b-tscg-configuration)
5c. [Autoresearch Findings — Token Efficiency](#5c-autoresearch-findings--token-efficiency)
6. [Packages (npm)](#6-packages-npm)
7. [Extensions](#7-extensions)
8. [Skills (Agent Skills)](#8-skills-agent-skills)
9. [Rules: `lean-ctx.md`](#9-rules-lean-ctxmd)
10. [Environment Files](#10-environment-files)
11. [Pi Cache Optimizer Stats](#11-pi-cache-optimizer-stats)
12. [OMP Agent Config](#12-omp-agent-config)
13. [Zero Agent Config](#13-zero-agent-config)
14. [Start Script](#14-start-script)
15. [Replication Instructions](#15-replication-instructions)
16. [OpenCode Native Config (`opencode.json`)](#16-opencode-native-config-opencodejson)

---

## 1. Directory Structure

```
~/.pi/
├── agent/
│   ├── auth.json                  # Stored API keys (OpenRouter, Nvidia)
│   ├── models.json                # Provider + model definitions
│   ├── settings.json              # Core Pi settings
│   ├── context-prune/
│   │   └── settings.json          # Context pruning configuration
├── tscg.json                      # Tool Schema Compression Group settings
│   ├── extensions/                # Pi extensions (TypeScript)
│   │   ├── orca-agent-status.ts    # Orca integration — status reporting
│   │   ├── orca-prefill.ts         # Orca integration — prefill
│   │   ├── orca-titlebar-spinner.ts# Orca integration — animated spinner
│   │   ├── rtk.ts                  # RTK bash rewrite extension (ACTIVE)
│   │   └── rtk.ts.disabled         # RTK extension backup (same content)
│   ├── git/
│   │   └── .gitignore
│   ├── npm/node_modules/           # Installed Pi packages
│   ├── sessions/                   # Chat session history (JSONL)
│   ├── skills/                     # Agent skill definitions
│   ├── tmp/
│   │   └── extensions/
│   ├── .agents/                    # Agent system files
│   ├── .zero/                      # Zero integration data
│   └── pi-cache-optimizer-stats.json
├── context-mode/
│   ├── content/                    # Indexed knowledge base content
│   └── sessions/                   # Context-mode session stats
├── readcache/
│   ├── objects/                    # Cached file reads (SHA256)
│   └── tmp/
├── rules/
│   └── lean-ctx.md                # Lean-ctx behavioral rules
└── skills/                         # Top-level skills (empty)
```

---

## 2. Core Config: `settings.json`

**Path**: `~/.pi/agent/settings.json`

```json
{
  "lastChangelogVersion": "0.80.7",
  "theme": "dark",
  "defaultProvider": "opencode-zen",
  "defaultModel": "big-pickle",
  "modelRoles": {
    "default": "lilac/moonshotai/kimi-k2.6",
    "smol": "deepseek/deepseek-v4-flash",
    "advisor": "deepseek/deepseek-v4-flash"
  },
  "packages": [
    "npm:@ogulcancelik/pi-model-agents"
    "npm:@ogulcancelik/pi-model-thinking"
    "npm:@plannotator/pi-extension"
    "npm:cc-safety-net"
    "npm:context-mode"
    "npm:pi-autoresearch"
    "npm:pi-cache-graph"
    "npm:pi-cache-optimizer"
    "npm:pi-context-usage"
    "npm:pi-continue"
    "npm:pi-herdr-btw"
    "npm:pi-lean-ctx"
    "npm:pi-slim"
    "npm:pi-tscg"
    "npm:@quintinshaw/pi-dynamic-workflows"
  ],
  "defaultThinkingLevel": "low",
  "compaction": {
    "reserveTokens": 60000,
    "keepRecentTokens": 10000
  }
}
```

### Key Settings Explained

| Setting | Value | Notes |
|---------|-------|-------|
| `theme` | `dark` | Dark theme |
| `defaultProvider` | `opencode-zen` | Default LLM provider |
| `defaultModel` | `big-pickle` | Default model ID |
| `modelRoles.default` | `lilac/moonshotai/kimi-k2.6` | Main chat model |
| `modelRoles.smol` | `deepseek/deepseek-v4-flash` | Lightweight model for simple tasks |
| `modelRoles.advisor` | `deepseek/deepseek-v4-flash` | Advisor/review model |
| `defaultThinkingLevel` | `low` | Default reasoning effort |
| `compaction.reserveTokens` | `60000` | Tokens reserved after compaction |
| `compaction.keepRecentTokens` | `10000` | Most recent tokens preserved verbatim |

---

## 3. Provider Config: `models.json`

**Path**: `~/.pi/agent/models.json`

Three providers configured:

### a) `opencode-zen` (Default)

| Property | Value |
|----------|-------|
| `baseUrl` | `https://opencode.ai/zen/v1` |
| `api` | `openai-completions` |
| `apiKey` | `$OPENCODE_ZEN_API_KEY` (env var) |
| `authHeader` | `true` |

**Models** (21 total):

| Model ID | Name | Reasoning | Input | Context Window | Max Tokens |
|----------|------|-----------|-------|---------------|------------|
| `big-pickle` | Big Pickle | ✅ | text, image | 256K | 65K |
| `deepseek-v4-flash` | DeepSeek V4 Flash (OpenCode Zen) | ✅ | text | 1M | 131K |
| `deepseek-v4-flash-free` | DeepSeek V4 Flash (Free) | ✅ | text | 64K | 16K |
| `deepseek-v4-pro` | DeepSeek V4 Pro (OpenCode Zen) | ✅ | text | 1M | 131K |
| `gpt-5.6-sol` | GPT-5.6 Sol | ✅ | text, image | 272K | 65K |
| `gpt-5.6-terra` | GPT-5.6 Terra | ✅ | text, image | 272K | 65K |
| `gpt-5.6-luna` | GPT-5.6 Luna | ❌ | text, image | 272K | 65K |
| `claude-sonnet-4` | Claude Sonnet 4 | ✅ | text, image | 200K | 8K |
| `claude-opus-4-7` | Claude Opus 4.7 | ✅ | text, image | 200K | 8K |
| `gemini-3-flash` | Gemini 3 Flash | ✅ | text, image | 1M | 65K |
| `gemini-3-pro` | Gemini 3 Pro | ✅ | text, image | 1M | 65K |
| `glm-5.2` | GLM 5.2 (OpenCode Zen) | ✅ | text | 1M | 131K |
| `glm-4.7` | GLM 4.7 (OpenCode Zen) | ❌ | text | 202K | 202K |
| `kimi-k2.7-code` | Kimi K2.7 Code | ✅ | text, image | 262K | 262K |
| `kimi-k2.5` | Kimi K2.5 | ✅ | text, image | 262K | 262K |
| `qwen3.5-plus` | Qwen3.5 Plus | ✅ | text, image | 262K | 131K |
| `minimax-m3` | MiniMax M3 | ✅ | text, image | 1M | 131K |
| `grok-4.5` | Grok 4.5 | ✅ | text, image | 262K | 65K |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | ✅ | text, image | 200K | 8K |
| `claude-opus-4-8` | Claude Opus 4.8 | ✅ | text, image | 200K | 8K |
| `gpt-5.4-pro` | GPT-5.4 Pro | ✅ | text, image | 272K | 65K |

All models have cost set to `0` (free tier / usage-based billing).

### b) `lilac`

| Property | Value |
|----------|-------|
| `baseUrl` | `https://api.getlilac.com/v1` |
| `api` | `openai-completions` |
| `apiKey` | `$LILAC_API_KEY` (env var) |
| `authHeader` | `true` |

**Models**:

| Model ID | Name | Reasoning | Input | Context Window | Max Tokens |
|----------|------|-----------|-------|---------------|------------|
| `default` | Lilac Default | ✅ | text | 128K | 65K |

### c) `deepseek`

| Property | Value |
|----------|-------|
| `baseUrl` | `https://api.deepseek.com` |
| `api` | `openai-completions` |
| `apiKey` | `$DEEPSEEK_API_KEY` (env var) |
| `authHeader` | `true` |

**Models**:

| Model ID | Name | Reasoning | Input | Context Window | Max Tokens |
|----------|------|-----------|-------|---------------|------------|
| `deepseek-v4-flash` | DeepSeek V4 Flash | ✅ | text | 1M | 384K |
| `deepseek-v4-pro` | DeepSeek V4 Pro | ✅ | text | 1M | 384K |

---

## 4. Auth Config: `auth.json`

**Path**: `~/.pi/agent/auth.json`

```json
{
  "openrouter": {
    "type": "api_key",
    "key": "sk-or-v1-<redacted>"
  },
  "nvidia": {
    "type": "api_key",
    "key": "nvapi-<redacted>"
  }
}
```

> ⚠️ **Sensitive**: Contains actual API keys for OpenRouter and Nvidia.  
> Do not commit to version control. Obtain fresh keys from:
> - OpenRouter: https://openrouter.ai/keys
> - Nvidia: https://build.nvidia.com/

---

## 5. Context Prune Settings

**Path**: `~/.pi/agent/context-prune/settings.json`

```json
{
  "enabled": true,
  "showPruneStatusLine": true,
  "summarizerModel": "deepseek/deepseek-v4-flash",
  "summarizerThinking": "low",
  "pruneOn": "agent-message",
  "remindUnprunedCount": true
}
```

| Setting | Value | Notes |
|---------|-------|-------|
| `enabled` | `true` | Context pruning is active |
| `showPruneStatusLine` | `true` | Shows prune status in TUI |
| `summarizerModel` | `deepseek/deepseek-v4-flash` | Model used for summarization |
| `summarizerThinking` | `low` | Low reasoning effort for summaries |
| `pruneOn` | `agent-message` | Prune triggers after agent messages |
| `remindUnprunedCount` | `true` | Shows unpruned message count |

---

## 5b. TSCG Configuration

**Path**: `~/.pi/tscg.json`

```json
{
  "enabled": true,
  "profile": "aggressive"
}
```

| Setting | Value | Notes |
|---------|-------|-------|
| `enabled` | `true` | Tool Schema Compression Group is active |
| `profile` | `aggressive` | Maximum compression of tool JSON schemas |

> **Autoresearch finding**: `aggressive` profile is the correct baseline. For the
> short benchmark task (copy + read + count lines), `aggressive` and `balanced`
> produce equivalent total_input_tokens (~46.5K). However, `aggressive` is
> preferred because it produces smaller tool schemas, which reduces cache pressure
> on longer sessions. There is no penalty for using `aggressive` on short tasks.

---

## 5c. Autoresearch Findings — Token Efficiency

The following configuration was validated through 9 automated experiment runs
using `measure.sh` (runs pi on a fixed benchmark task 3× and measures
`total_input_tokens`). The benchmark task is: copy `AGENTS.md` to `/tmp/ag.md`,
read it back, count lines. Metric: `total_input_tokens` (total tokens sent to
the model, including cached — i.e. a measure of prompt size, not API cost).

### Validated Optimal Configuration

| Setting | Value | Effect |
|---------|-------|--------|
| All 13 packages loaded | **Required** | Every package is load-bearing |
| `npm:pi-slim` | **ON (installed)** | Saves ~18.1K tokens (39%) vs OFF |
| `npm:pi-cache-optimizer` | **Required** | Tracks `totalInputTokens` — the metric itself |
| `tscg.profile` | `aggressive` | Correct baseline (no penalty on short tasks) |
| `defaultThinkingLevel` | `low` | No effect on `total_input_tokens` (low/medium/high all ≈46.5K) |
| `context-prune.pruneOn` | `agent-message` | Already correct |
| `compaction` | 60K reserve / 10K keep | Does not fire on short tasks |

**Result: ~46,500 total_input_tokens** (±200 tok noise floor across 8 valid runs).

### What Was Tested and Ruled Out

1. **`pi-slim` OFF**: +18.1K tokens (64.6K vs 46.5K). pi-slim is **essential**.
2. **`tscg` balanced**: Equivalent to aggressive on short task. Aggressive preferred.
3. **`thinking` medium/high**: No effect on `total_input_tokens`. This metric counts
   total tokens sent (cache-invariant), so thinking level does not change the prompt
   size that the metric measures.
4. **Remove `pi-web-access`**: +10.5K regression (+22.6%). Package instructions
   improve pi's behavioral efficiency even on non-web tasks (fewer confused turns
   = less accumulated conversation history).
5. **Remove `pi-cache-optimizer`**: Metric = 0 (broken). This package IS the token
   counter — without it, `totalInputTokens` is never tracked.

### Methodological Rules Discovered

1. **Pi warm-up anomaly**: After ANY `settings.json` modification, the first pi
   invocation inflates `total_input_tokens` by ~35% (46.5K → 62K). The second run
   returns to normal. **Always run `measure.sh` at least twice after a config change
   and use the second run's metric.**
2. **All packages are load-bearing**: Either as token counters (pi-cache-optimizer)
   or behavioral efficiency providers (all others). The `packages` array is NOT a
   lever for reducing tokens.
3. **`total_input_tokens` is cache-invariant**: It reconstructs `input + cacheRead +
   cacheWrite` (total tokens sent), NOT billed tokens. Cache optimization affects
   cost, not this metric.

---

## 6. Packages (npm)

**Path**: `~/.pi/agent/npm/node_modules/`

Installed via `packages` array in `settings.json`:

| Package | npm Name | Purpose |
|---------|----------|---------|
| **context-mode** | `context-mode` | Lean-ctx: context management, search, indexing |
| **pi-autoresearch** | `pi-autoresearch` | Autonomous web research agent |
| **pi-cache-graph** | `pi-cache-graph` | Cache dependency graph visualization |
| **pi-cache-optimizer** | `pi-cache-optimizer` | Prompt caching optimization |
| **pi-context-usage** | `pi-context-usage` | Token usage tracking |
| **pi-lean-ctx** | `pi-lean-ctx` | Lean context mode (ctx_* tool suite) |
| **pi-slim** | `pi-slim` | Token optimization/slimming |
| **pi-tscg** | `pi-tscg` | Tool Schema Compression Group — compresses tool JSON schemas to reduce token count |
| **pi-model-agents** | `@ogulcancelik/pi-model-agents` | Model-specific subagent definitions |
| **pi-model-thinking** | `@ogulcancelik/pi-model-thinking` | Per-model thinking-level control |
| **pi-extension (plannotator)** | `@plannotator/pi-extension` | Plan annotation/review UI |
| **cc-safety-net** | `cc-safety-net` | Command safety guardrails |
| **pi-continue** | `pi-continue` | Session continuation helpers |
| **pi-herdr-btw** | `pi-herdr-btw` | herdr integration bridge |
| **pi-dynamic-workflows** | `@quintinshaw/pi-dynamic-workflows` | Dynamic multi-agent workflow orchestration |

Additional npm packages installed as dependencies include: `@anthropic-ai`, `@aws`, `@aws-sdk`, `@clack`, `@earendil-works`, `@google`, `@hono`, `@mistralai`, `@modelcontextprotocol`, `@sinclair`, `better-sqlite3`, `ajv`, `bowser`, `context-mode`, and others.

---

## 7. Extensions

**Path**: `~/.pi/agent/extensions/`

### 7a. `rtk.ts` — RTK Bash Rewrite (ACTIVE)

- Rewrites `bash` tool calls to use RTK (Rust Token Kruncher) for token savings
- Requires `rtk >= 0.23.0` in PATH
- Timeout: 2 seconds per rewrite
- Fail-open: if RTK unavailable or timeout, original command passes through
- Can be disabled at runtime via `RTK_DISABLED=1` env var
- Skips rewriting commands starting with `rtk `
- Source of truth for rewrite rules: `rtk rewrite` CLI (Rust registry in `src/discover/registry.rs`)

**There is also `rtk.ts.disabled`** — identical content, kept as backup.

### 7b. `orca-agent-status.ts` — Orca Integration (Status)

- Orca-managed Pi extension for agent lifecycle status reporting
- Posts status events to Orca via HTTP hook (`/hook/pi` or `/hook/omp`)
- Events: `before_agent_start`, `agent_start`, `tool_execution_start`, `tool_call`, `tool_execution_end`, `message_end`, `agent_end`
- Deduplication: only latest pending status sent (queue of 1)
- Timeout: 1 second per delivery; WSL fallback via Windows `curl.exe`
- Caches endpoint file reads (stat+mtime based)
- Detects OMP vs Pi at runtime via process name

### 7c. `orca-prefill.ts` — Orca Integration (Prefill)

- On `session_start` (reason: `startup`), sets editor text from `ORCA_PI_PREFILL` env var
- Only activates if `ORCA_PANE_KEY` is set (running inside Orca)

### 7d. `orca-titlebar-spinner.ts` — Orca Integration (Spinner)

- Animated braille spinner in terminal title bar during agent activity
- Frames: 10 braille dot patterns at 80ms interval
- Shows `π - {session} - {cwd}` base title
- Only activates if `ORCA_PANE_KEY` is set
- Stops on `agent_end` and `session_shutdown`

---

## 8. Skills (Agent Skills)

**Path**: `~/.pi/agent/skills/`

38 skills installed:

| Skill | Purpose |
|-------|---------|
| `ask-matt` | Matt Pocock's skill system — flow-based engineering methodology |
| `codebase-design` | Deep module design vocabulary (module, interface, seam, adapter) |
| `code-review` | Two-axis code review (Standards + Spec) |
| `design-an-interface` | Interface design skill |
| `diagnosing-bugs` | Debugging methodology with tight feedback loops |
| `domain-modeling` | Domain language sharpening and ADRs |
| `edit-article` | Article editing skill |
| `find-skills` | Skill discovery/retrieval |
| `grilling` | Core interview/requirement-sharpening primitive |
| `grill-me` | Stateless interview (no codebase) |
| `grill-with-docs` | Stateful interview with CONTEXT.md + ADRs |
| `handoff` | Cross-session context handoff |
| `implement` | Implementation driver (uses TDD internally) |
| `improve-codebase-architecture` | Codebase health survey |
| `last30days` | Last 30 days skill |
| `loop-me` | Continuous loop skill |
| `make-interfaces-feel-better` | UI polish skill |
| `obsidian-vault` | Obsidian vault integration |
| `prototype` | Throwaway prototype for design questions |
| `qa` | Quality assurance / testing |
| `request-refactor-plan` | Refactoring plan generation |
| `research` | Background research agent |
| `resolving-merge-conflicts` | Merge conflict resolution |
| `scaffold-exercises` | Exercise scaffolding |
| `setup-matt-pocock-skills` | Skill system setup (issue tracker, labels, docs) |
| `tdd` | Test-driven development (red-green slices) |
| `teach` | Multi-session learning |
| `to-spec` | Convert thread to spec |
| `to-tickets` | Split spec into tickets with blocking edges |
| `triage` | Issue triage (bug reports, feature requests) |
| `ubiquitous-language` | Ubiquitous language management |
| `wayfinder` | Greenfield/foggy effort pathfinding |
| `wizard` | Wizard interface |
| `writing-beats` | Writing structure beats |
| `writing-fragments` | Writing fragments |
| `writing-great-skills` | Skill writing reference |
| `writing-shape` | Writing shape/structure |

---

## 9. Rules: `lean-ctx.md`

**Path**: `~/.pi/rules/lean-ctx.md`

Rules enforcing compiler-level tool selection discipline:

- **Critical**: ALWAYS use `ctx_*` tools over native equivalents
- **Tool mapping**:
  - Read → `ctx_read(path, mode)`
  - Grep → `ctx_search(pattern, path)`
  - Shell → `ctx_shell(command)`
  - Glob → `ctx_glob(pattern)`
  - ls → `ctx_tree(path, depth)`
- **First tool for code understanding**: `ctx_compose`
- **Edit flow**: Read via `ctx_read` → Edit via `ctx_patch`
- **Anti-patterns**:
  - No chain `ctx_search → ctx_read → ctx_search(symbol)` — use `ctx_compose` once
  - No `ctx_read(mode=full)` for orientation — use `mode=signatures`
  - No `ctx_callgraph` for const/var refs — use `ctx_search`
- **Compression**: reversible, never re-read line-by-line
- **Output style**: concise, bullet points, no filler words

---

## 10. Environment Files

### ⚠️ Shell: Fish, NOT Bash

**The operator's login shell is `/bin/fish`** on all machines (CachyOS). This is a hard constraint.

**Any AI agent reading this must:**
- Give the operator shell commands in **fish syntax** — never bash/zsh.
- Use `set -gx VAR value` instead of `export VAR=value`.
- Use `and`/`or`/`not` instead of `&&`/`||`.
- Set environment variables in `~/.config/fish/config.fish` (or `~/.config/fish/conf.d/*.fish`), **never** in `.bashrc`/`.zshrc`/`.profile` — those files are not sourced on this machine and edits there will silently fail.
- Note: the `ctx_shell` tool internally runs bash, so commands the AI executes *via tools* can use bash syntax. Only commands **shown to the operator** for manual execution must be fish-compatible.

### Path & Format

**Path**: `~/.config/fish/config.fish` (primary) or `~/.config/fish/conf.d/*.fish` (modular)

All env vars use fish `set -gx` syntax in `config.fish`:

```fish
# lilac
set -gx LILAC_API_KEY "<your-lilac-api-key>"

# deepseek
set -gx DEEPSEEK_API_KEY "<your-deepseek-api-key>"

# github
set -gx GH_TOKEN "<your-github-token>"
```

### Key Environment Variables Reference

| Variable | Provider | Used By | Fish syntax |
|----------|----------|---------|-------------|
| `DEEPSEEK_API_KEY` | DeepSeek | Pi, OMP, Zero | `set -gx DEEPSEEK_API_KEY "..."` |
| `LILAC_API_KEY` | Lilac | Pi, OMP, Zero | `set -gx LILAC_API_KEY "..."` |
| `GH_TOKEN` | GitHub | GitHub CLI / API auth | `set -gx GH_TOKEN "..."` |
| `VENICE_API_KEY` | Venice | Pi (default provider) | `set -gx VENICE_API_KEY "..."` |
| `VENICE_BASE_URL` | Venice | Pi | `set -gx VENICE_BASE_URL "https://api.venice.ai/api/v1"` |
| `PI_TRANSCRIPT_PRUNE` | Pi harness | transcript-pruner ext | `set -gx PI_TRANSCRIPT_PRUNE 1` |
| `OPENCODE_ZEN_API_KEY` | OpenCode Zen | Pi (needed for `opencode-zen` provider — set externally) | `set -gx OPENCODE_ZEN_API_KEY "..."` |

> ⚠️ **Note**: The `OPENCODE_ZEN_API_KEY` is not stored in fish config — it may be set by the OpenCode agent or another mechanism. Check `set -x | grep OPENCODE_ZEN` on the source machine.

---

## 11. Pi Cache Optimizer Stats

**Path**: `~/.pi/agent/pi-cache-optimizer-stats.json`

- Version `6` of the stats schema
- Per-session, per-model caching statistics
- Tracks: `totalRequests`, `hitRequests`, `cachedInputTokens`, `cacheWriteInputTokens`, `missInputTokens`, `cachedOutputTokens`
- Sessions tracked include: `opencode-zen/xiaomi/mimo-v2.5`, `opencode-zen/deepseek-v4-flash`, `opencode-zen/big-pickle`
- **This file is auto-generated** — will be recreated on a fresh install; no need to copy.

---

## 12. OMP Agent Config

### `config.yml`

**Path**: `~/.omp/agent/config.yml`

```yaml
SymbolPreset: nerd
theme:
  dark: titanium
  light: light
defaultThinkingLevel: auto
providers:
  webSearch: auto
setupVersion: 1
compaction:
  idleThresholdTokens: 60000
  idleEnabled: true
  thresholdPercent: 30
  keepRecentTokens: 20000
tools:
  artifactSpillThreshold: 20
branchSummary:
  enabled: true
read:
  summarize:
    prose: true
dev:
  autoqa:
    consent: granted
memory:
  backend: local
memories:
  enabled: true
  maxRolloutAgeDays: 14
  minRolloutIdleHours: 6
  maxRolloutsPerStartup: 64
  summaryInjectionTokenLimit: 2500
modelRoles:
  default: openrouter/tencent/hy3:free
  smol: deepseek/deepseek-v4-flash
  advisor: deepseek/deepseek-v4-flash
advisor:
  enabled: true
  subagents: false
  syncBacklog: "off"
retry:
  fallbackChains:
    opencode-zen/*:
      - deepseek/deepseek-v4-flash
      - deepseek/deepseek-v4-pro
    default:
      - deepseek/deepseek-v4-flash
task:
  isolation:
    mode: auto
```

### `models.yml`

**Path**: `~/.omp/agent/models.yml`

```yaml
providers:
  lilac:
    baseUrl: https://api.getlilac.com/v1
    api: openai-completions
    apiKey: LILAC_API_KEY
    authHeader: true
    models:
      - id: default
        name: Lilac Default
        contextWindow: 128000
        maxTokens: 65536

  deepseek:
    baseUrl: https://api.deepseek.com
    api: openai-completions
    apiKey: DEEPSEEK_API_KEY
    authHeader: true
    models:
      - id: deepseek-v4-pro
        name: DeepSeek V4 Pro (Direct)
        contextWindow: 1000000
        maxTokens: 384000
      - id: deepseek-v4-flash
        name: DeepSeek V4 Flash (Direct)
        contextWindow: 1000000
        maxTokens: 384000
```

---

## 13. Zero Agent Config

**Path**: `~/.config/zero/config.json`

```json
{
  "activeProvider": "opencode-zen",
  "providers": [
    {
      "name": "deepseek",
      "provider_kind": "openai-compatible",
      "catalogID": "deepseek",
      "baseURL": "https://api.deepseek.com/v1",
      "apiKeyEnv": "DEEPSEEK_API_KEY",
      "apiKeyStored": true,
      "apiFormat": "chat-completions",
      "model": "deepseek-v4-pro"
    },
    {
      "name": "google",
      "provider_kind": "openai-compatible",
      "catalogID": "custom-openai-compatible",
      "baseURL": "https://generativelanguage.googleapis.com/v1beta/openai",
      "apiKeyEnv": "GEMINI_API_KEY",
      "apiFormat": "chat-completions",
      "model": "gemini-2.5-flash"
    },
    {
      "name": "opencode-zen",
      "provider_kind": "openai-compatible",
      "catalogID": "opencode",
      "baseURL": "https://opencode.ai/zen/v1",
      "apiKeyEnv": "OPENCODE_ZEN_API_KEY",
      "apiKeyStored": true,
      "apiFormat": "chat-completions",
      "model": "hy3-free"
    },
    {
      "name": "nvidia-nim",
      "provider_kind": "openai-compatible",
      "catalogID": "nvidia-nim",
      "baseURL": "https://integrate.api.nvidia.com/v1",
      "apiKeyStored": true,
      "apiFormat": "chat-completions",
      "model": "z-ai/glm-5.2"
    },
    {
      "name": "lilac",
      "provider_kind": "openai-compatible",
      "catalogID": "custom-openai-compatible",
      "baseURL": "https://api.getlilac.com/v1",
      "apiKeyEnv": "LILAC_API_KEY",
      "apiKeyStored": true,
      "apiFormat": "chat-completions",
      "model": "default"
    }
  ],
  "preferences": {
    "recentModels": [
      { "provider": "lilac", "model": "default" },
      { "provider": "opencode-zen", "model": "hy3-free" },
      { "provider": "opencode-zen", "model": "big-pickle" },
      { "provider": "nvidia-nim", "model": "z-ai/glm-5.2" },
      { "provider": "deepseek", "model": "deepseek-v4-pro" }
    ]
  }
}
```

---

## 14. Start Script

**Path**: `~/start-agents.sh`

```bash
#!/bin/bash
SESSION="agents"

tmux kill-session -t "$SESSION" 2>/dev/null

tmux new-session -d -s "$SESSION" \; \
  send-keys 'opencode' Enter \; \
  split-window -h \; \
  send-keys 'mimocode' Enter \; \
  split-window -v \; \
  send-keys 'omp' Enter \; \
  select-pane -t 0 \; \
  split-window -v \; \
  send-keys 'coded' Enter \; \
  select-layout tiled

tmux attach -t "$SESSION"
```

Launches 4 agents in a tmux grid:
- **OpenCode** — main coding agent
- **MimoCode** — secondary agent
- **OMP** — Orca Mode Pi (Pi variant)
- **Coded** — additional agent

---

## 15. Replication Instructions

### Step 1: Install Pi

```bash
# Install Pi via npm
npm install -g @earendil-works/pi-coding-agent

# Or via the Pi installer (if available)
# curl -fsSL https://pi.dev/install | bash
```

### Step 2: Create Directory Structure

```bash
mkdir -p ~/.pi/agent/{context-prune,extensions,npm,sessions,skills,tmp,.agents,.zero}
mkdir -p ~/.pi/{context-mode/{content,sessions},readcache/{objects,tmp},rules,skills}
mkdir -p ~/.config/env.d
```

### Step 3: Copy Core Config Files

```bash
# Pi configs
cp settings.json ~/.pi/agent/settings.json
cp models.json ~/.pi/agent/models.json
cp context-prune/settings.json ~/.pi/agent/context-prune/settings.json

# Rules
cp rules/lean-ctx.md ~/.pi/rules/lean-ctx.md
```

### Step 4: Set Up Extensions

```bash
cp extensions/rtk.ts ~/.pi/agent/extensions/rtk.ts
cp extensions/orca-agent-status.ts ~/.pi/agent/extensions/orca-agent-status.ts
cp extensions/orca-prefill.ts ~/.pi/agent/extensions/orca-prefill.ts
cp extensions/orca-titlebar-spinner.ts ~/.pi/agent/extensions/orca-titlebar-spinner.ts
```

### Step 5: Install Packages

```bash
cd ~/.pi/agent
pi pkg add context-mode
pi pkg add pi-autoresearch
pi pkg add pi-cache-graph
pi pkg add pi-cache-optimizer
pi pkg add pi-context-usage
pi pkg add pi-lean-ctx
pi pkg add pi-slim
pi pkg add pi-tscg
pi pkg add @ogulcancelik/pi-model-agents
pi pkg add @ogulcancelik/pi-model-thinking
pi pkg add @plannotator/pi-extension
pi pkg add cc-safety-net
pi pkg add pi-continue
pi pkg add pi-herdr-btw
pi pkg add @quintinshaw/pi-dynamic-workflows
```

Alternatively, the packages will auto-install from the `settings.json` `packages` array on the next Pi start.

### Step 6: Set Up Environment Variables

Copy the env files or set manually:

```bash
# ~/.config/env.d/deepseek.sh
export DEEPSEEK_API_KEY="<your-deepseek-api-key>"

# ~/.config/env.d/lilac.sh
export LILAC_API_KEY="<your-lilac-api-key>"

# ~/.config/env.d/gh_token.sh
export GH_TOKEN="<your-github-token>"

# OpenCode Zen API key (set wherever the OpenCode agent configures it)
# export OPENCODE_ZEN_API_KEY="..."
```

Ensure they're sourced in shell init (`~/.zshrc` / `~/.bashrc` / `~/.profile`):
```bash
for f in ~/.config/env.d/*.sh; do [ -f "$f" ] && source "$f"; done
```

### Step 7: Copy Skills

```bash
cp -r ~/.pi/agent/skills/* ~/.pi/agent/skills/
```

### Step 8: Set Up OMP (if used)

```bash
mkdir -p ~/.omp/agent
cp omp/config.yml ~/.omp/agent/config.yml
cp omp/models.yml ~/.omp/agent/models.yml
```

### Step 9: Set Up Zero (if used)

```bash
mkdir -p ~/.config/zero
cp zero/config.json ~/.config/zero/config.json
```

### Step 10: Register Providers in OpenCode Native Config (CRITICAL)

> **Important**: `pi` is a wrapper around OpenCode. OpenCode reads providers from
> `~/.config/opencode/opencode.json`, NOT from `~/.pi/agent/models.json`. The
> `models.json` edit alone will NOT make a provider appear at runtime — it must
> also be registered here in OpenCode's native format.

**Path**: `~/.config/opencode/opencode.json`

```json
{
  "provider": {
    "deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepSeek",
      "api": "<your-deepseek-api-key>",
      "options": { "baseURL": "https://api.deepseek.com" },
      "models": { "deepseek-v4-flash": { "name": "DeepSeek V4 Flash" } }
    },
    "lilac": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Lilac",
      "api": "<your-lilac-api-key>",
      "options": { "baseURL": "https://api.getlilac.com/v1" },
      "models": { "default": { "name": "Lilac Default" } }
    }
  }
}
```

Note: `opencode-zen` is a built-in provider (not listed here) and works as the
default without manual registration.

Copy this file or recreate it on the target machine:

```bash
mkdir -p ~/.config/opencode
cp opencode/opencode.json ~/.config/opencode/opencode.json
```

---

## 16. OpenCode Native Config (`opencode.json`)

**Path**: `~/.config/opencode/opencode.json`

This is OpenCode's native provider configuration — `pi` is a wrapper around
OpenCode, and **this file is what actually controls which providers appear at
runtime**, NOT `~/.pi/agent/models.json`. Each provider must be registered here
in OpenCode's format for it to be usable.

```json
{
  "provider": {
    "deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepSeek",
      "api": "<your-deepseek-api-key>",
      "options": { "baseURL": "https://api.deepseek.com" },
      "models": { "deepseek-v4-flash": { "name": "DeepSeek V4 Flash" } }
    },
    "lilac": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Lilac",
      "api": "<your-lilac-api-key>",
      "options": { "baseURL": "https://api.getlilac.com/v1" },
      "models": { "default": { "name": "Lilac Default" } }
    }
  }
}
```

| Field | Meaning |
|-------|---------|
| `npm` | OpenCode provider package (`@ai-sdk/openai-compatible` for OpenAI-style APIs) |
| `name` | Display name in the UI |
| `api` | API key (inlined literal — OpenCode does not read env vars here) |
| `options.baseURL` | API endpoint |
| `models` | Map of model ID → display name |

> ⚠️ The `api` key is inlined as a literal value, not an env var reference.
> Keep this file out of version control.
>
> `opencode-zen` is a built-in provider and does NOT appear in this file — it
> works as the default without manual registration.
