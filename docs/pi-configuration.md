# Pi Agent — Full Configuration Reference

> **Purpose**: Replicate this Pi setup on another machine.
> **Authoritative sources**: `install.sh` (deployment manifest) + `README.md` (quick-start).
> This doc provides reference detail only. Live `settings.json`/`models.json` in the repo are authoritative over any snapshot here.
> **Updated 2026-08-02**: fish shell (§10), current extensions (§7), replication via install.sh (§14).

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
14. [Replication (Authoritative)](#14-replication-authoritative)

---

## 1. Directory Structure

```
~/.pi/
├── agent/
│   ├── auth.json              # API keys (NEVER vendored)
│   ├── models.json            # Provider + model definitions (Venice + Lilac)
│   ├── settings.json          # Core Pi settings (provider, model, compaction, packages)
│   ├── APPEND_SYSTEM.md       # CE-lite activation hook (~85 tok, the ONLY global overlay)
│   ├── tscg.json              # Tool Schema Compression Group (aggressive, load-bearing)
│   ├── AGENTS.md              # Project instructions (session guardrail)
│   ├── extensions/
│   │   ├── transcript-pruner.ts  # cross-message dedup/stale pruning (default ON; PI_TRANSCRIPT_PRUNE=0 disables)
│   │   └── session-index.ts      # session-end extractive summaries → memory/sessions/
│   ├── lean-ctx/
│   │   └── config.toml        # lean-ctx bridge config (replace mode, lean profile)
│   ├── npm/node_modules/      # Installed Pi packages (15 packages)
│   ├── sessions/              # Chat session history (JSONL)
│   ├── skills/                # Agent skill definitions
│   └── pi-cache-optimizer-stats.json
├── context-mode/
│   ├── content/               # Indexed knowledge base content
│   └── sessions/              # Context-mode session stats
├── rules/
│   └── lean-ctx.md            # Lean-ctx behavioral rules
└── workflows/
    ├── model-tiers.json       # Pinned model routing (leaf/worker/reviewer)
    └── saved/                 # Saved workflows (e.g. memory-consolidate.json)
```
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
"npm:context-mode"
    "npm:pi-autoresearch"
    "npm:pi-cache-graph"
    "npm:pi-cache-optimizer"
    "npm:pi-context-usage"
    "npm:pi-continue"
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
| **pi-continue** | `pi-continue` | Session continuation helpers |
| **pi-dynamic-workflows** | `@quintinshaw/pi-dynamic-workflows` | Dynamic multi-agent workflow orchestration |

Additional npm packages installed as dependencies include: `@anthropic-ai`, `@aws`, `@aws-sdk`, `@clack`, `@earendil-works`, `@google`, `@hono`, `@mistralai`, `@modelcontextprotocol`, `@sinclair`, `better-sqlite3`, `ajv`, `bowser`, `context-mode`, and others.

---


## 7. Extensions

**Path**: `~/.pi/agent/extensions/`

### 7a. `transcript-pruner.ts` — Cross-message Redundancy Pruning

- Hooks the `context` event (fires before every LLM call, sees a structuredClone of the transcript)
- **DEDUP**: exact-duplicate read-only tool results (same tool, same args, byte-identical output) → short pointer to first occurrence. Cross-tool content dedup collapses byte-identical results for the same path.
- **STALE**: path-read results for a path later written/edited → one-line stale notice
- Safety: only text content replaced; message pairing (toolCallId) preserved; dedup requires byte-identical output
- Default ON (DEDUP+STALE+CLEAR keep=4). Set `PI_TRANSCRIPT_PRUNE=0` to disable; toggles: `PI_PRUNE_DEDUP` / `PI_PRUNE_STALE` (1/0); threshold via `PI_PRUNE_MIN_LEN` (default 40 chars)
- Proven -15.7% billed tokens on dev-loop benchmark (2026-08-01)

### 7b. `session-index.ts` — Session-end Summaries

- Session-end extractive summaries → `memory/sessions/`
- Zero LLM tokens (heuristic extraction, not a model call)

### Removed extensions (2026-07-30, do NOT reinstall)

- `rtk.ts` — RTK bash rewrite; inert under lean-ctx replace mode (model calls `ctx_shell`, never `bash`, so rtk's hook never fires). Belongs to the OMP harness.
- `orca-agent-status.ts`, `orca-prefill.ts`, `orca-titlebar-spinner.ts` — Orca integration; removed with Orca.
- `delegate.ts` — superseded by pi-dynamic-workflows.

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

## 14. Replication (Authoritative)

> **This section supersedes all prior replication instructions.**
> The `install.sh` script in the repo root is the **single source of truth** for deployment.
> The README.md "Install / restore" section is the canonical quick-start.
> This doc provides reference detail only.

### Prerequisites

- **OS**: CachyOS (Arch-based), login shell `/bin/fish`
- **Pi**: installed via the pi-node installer at `~/.local/share/pi-node/`
- **Env vars**: set in `~/.config/fish/config.fish` using `set -gx` (see §10)

### Deploy

```fish
git clone https://github.com/armchairfuturist-code/pi-harness-config.git
cd pi-harness-config
./install.sh           # deploy all vendored config + verify
./install.sh --check   # verify zero drift
```

### First install on a fresh machine

Also install the npm packages and set env vars (see README.md "Install / restore"):

```fish
pi install npm:pi-lean-ctx npm:context-mode npm:@quintinshaw/pi-dynamic-workflows \
  npm:pi-tscg npm:pi-slim npm:pi-cache-optimizer npm:pi-cache-graph npm:pi-context-usage \
  npm:pi-continue npm:pi-autoresearch npm:@plannotator/pi-extension \
npm:@ogulcancelik/pi-model-agents npm:@ogulcancelik/pi-model-thinking

set -gx LILAC_API_KEY "your-key-here"
set -gx VENICE_API_KEY "your-venice-key-here"
set -gx VENICE_BASE_URL "https://api.venice.ai/api/v1"
set -gx PI_TRANSCRIPT_PRUNE 1  # enable transcript-pruner (-15.7% billed tokens)
```

### What `install.sh` deploys (manifest)

The manifest in `install.sh` is authoritative. It copies:
- `settings.json` → `~/.pi/agent/settings.json` (optional, `--settings` flag)
- `models.json` → `~/.pi/agent/models.json`
- `APPEND_SYSTEM.md` → `~/.pi/agent/APPEND_SYSTEM.md`
- `tscg.json` → `~/.pi/agent/tscg.json`
- `AGENTS.md` → `~/.pi/agent/AGENTS.md`
- `extensions/transcript-pruner.ts` → `~/.pi/agent/extensions/transcript-pruner.ts`
- `extensions/session-index.ts` → `~/.pi/agent/extensions/session-index.ts`
- `lean-ctx/config.toml` → `~/.pi/agent/lean-ctx/config.toml`
- `skills/` → `~/.pi/agent/skills/` (recursive)
- `workflows/` → `~/.pi/agent/workflows/` (recursive)
- `rules/lean-ctx.md` → `~/.pi/rules/lean-ctx.md`

### Not deployed (per-machine or secrets)

- `auth.json` — API keys (never vendored)
- `settings.json` — excluded by default (provider/model differ per machine; overlay with `--settings`)
- `sessions/` — session history
- `npm/node_modules/` — installed via `pi install`
- Personal or project-specific extensions are intentionally not vendored.

### Verify

```fish
./bench/probe.sh     # must print total ≤ 4052
./bench/measure.sh 3 # all checks_pass=1
```

### Context-mode local patch (re-apply after npm upgrade)

`buildBatchNodeOptionsPrefix` emits `export NODE_OPTIONS=...; <cmd>` so `for`/`if`/`while` survive ctx_shell. A context-mode npm upgrade overwrites `build/server.js` + bundles — re-apply (see `~/.pi/agent/memory/consolidated.md`).
