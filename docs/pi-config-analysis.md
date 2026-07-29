# Pi Configuration Analysis

**Pi version:** 0.81.1  **Date:** 2026-07-22
**Scope:** `~/.pi/agent/settings.json`, `~/.pi/agent/models.json`, `~/.pi/agent/auth.json`, `~/.pi/agent/context-prune/settings.json`, `~/.pi/tscg.json`, `~/.pi/web-search.json`, `~/.pi/rules/lean-ctx.md`, `~/.config/opencode/opencode.json`, installed packages, env vars.
**Reference:** official pi docs (settings.md, models.md) for 0.81.x + pi source in `node_modules/@earendil-works/pi-coding-agent/dist`.

> Method: every claim below was verified against the installed pi source (`resolve-config-value.js`, `provider-composer.js`, `package-manager.js`, `extensions/loader.js`) and the official docs, not assumed.

---

## 🔴 Bugs / errors (silent failures or latent breakage)

### 1. `modelRoles` is a dead setting — role-based model routing is NOT happening

- **File:** `~/.pi/agent/settings.json`

  ```json
  "modelRoles": { "default": "deepseek/deepseek-v4-flash",
                  "smol": "deepseek/deepseek-v4-flash",
                  "advisor": "deepseek/deepseek-v4-flash" }
  ```

- **Evidence:** `modelRoles`, `smol`, and `advisor` appear **nowhere** in pi core (`@earendil-works/pi-coding-agent/dist`) nor in any installed package (`@ogulcancelik/*`, `@narumitw/*`, `@plannotator/*`, `@samfp/*`). The official `settings.md` does not document `modelRoles` — only `defaultProvider` / `defaultModel` / `defaultThinkingLevel`. grep across all of `~/.pi/agent/npm/node_modules` for these tokens found zero hits in code (only unrelated HTML in `@plannotator`).
- **Impact:** You believe simple tasks use a cheap `smol` model and reviews use `advisor`, but pi ignores this entirely. Everything runs on `defaultModel` (`zai-org/glm-5.2`). No error is shown — it's a silent no-op.
- **Fix:** Remove `modelRoles`. If you want role-based routing, use the packages that actually provide it (e.g. `@ogulcancelik/pi-model-agents` is installed but does something else — "Load model-specific AGENTS.md instructions"), or switch models manually via `/model` / `--model`. The `pi-configuration.md` doc (v0.80.7) that documents `modelRoles` is stale.

### 2. `apiKey: "LILAC_API_KEY"` in models.json is a literal, not an env-var reference

- **File:** `~/.pi/agent/models.json` → provider `Lilac`

  ```json
  "apiKey": "LILAC_API_KEY"
  ```

- **Evidence:** `resolve-config-value.js` only treats a value as an env var when it has a `$` prefix (`$VAR` / `${VAR}`). A bare uppercase string is parsed as a **literal** (confirmed by source: `parseConfigValueTemplate` finds no `$` → entire string becomes a literal). The docs state explicitly: *"Plain uppercase strings such as `MY_API_KEY` are literals; use `$MY_API_KEY` for environment variables."*
- **Why it still works today:** `provider-composer.js` `composeApiKeyAuth` resolves auth with precedence **stored credential (auth.json) > provider.apiKey**. Your `auth.json` has a `Lilac` entry with the real key, so the literal is bypassed.
- **Impact:** Latent. The moment you `/logout` Lilac or remove the `auth.json` entry, pi will send the literal string `"LILAC_API_KEY"` as the API key and auth fails — with no obvious clue why.
- **Fix:** Change to `"apiKey": "$LILAC_API_KEY"` (env var `LILAC_API_KEY` is set ✓), **or** delete the `apiKey` field entirely since `auth.json` already covers it (cleanest).

### 3. `pi-context-prune` is installed but NOT loaded → context-prune settings are orphaned

- **File:** `~/.pi/agent/context-prune/settings.json` (enabled, summarizerModel, pruneOn, …)
- **Evidence:** The `packages` array in `settings.json` does **not** contain `npm:pi-context-prune`. The package's own docs state it only reads `~/.pi/agent/context-prune/settings.json` from its `session_start` handler — which never runs if the package isn't loaded. `@samfp/pi-essentials` *also* ships a `context-pruner.ts`, but (a) `@samfp/pi-essentials` is not in `packages`, and (b) `context-pruner.ts` is not in the explicit `extensions` list either (only 6 of its 10 extensions are loaded; `context-pruner` is excluded).
- **Impact:** You have a fully-specified pruning config (summarizer model, prune-on-agent-message, status line) that does nothing. Context is never pruned by this system. (You do still have pi's built-in compaction + `pi-smart-compact`.)
- **Fix:** If you want pruning, add `"npm:pi-context-prune"` to `packages`. Otherwise delete `~/.pi/agent/context-prune/settings.json` to avoid confusion.

### 4. `~/.pi/rules/lean-ctx.md` is not loaded by anything

- **Evidence:** pi auto-discovers only `{extensions, skills, prompts, themes}` under `~/.pi/agent/` (see `package-manager.js` `userDirs`). There is **no `rules` resource type**. `pi-lean-ctx`'s package manifest registers only `./extensions/index.ts` and contains no reference to `rules/lean-ctx.md` or `.pi/rules`. The lean-ctx instructions you see at runtime come from the lean-ctx MCP bridge's own system-prompt injection, not from this file.
- **Impact:** Dead file. Its content is also redundant with what the MCP server already injects.
- **Fix:** Delete `~/.pi/rules/lean-ctx.md` (and the empty `~/.pi/rules/` dir) — or move it into `~/.pi/agent/prompts/` if you actually want it injected as a prompt template.

---

## 🟡 Redundant / conflicting configuration

### 5. Five overlapping context/token-optimization packages all active at once

`packages` loads: `context-mode`, `pi-lean-ctx`, `pi-tscg`, `pi-cache-optimizer`, `pi-slim`, `pi-smart-compact` — plus pi's built-in compaction. Overlap:

- `pi-lean-ctx` rewrites built-in `bash`/`read`/`grep`/`find`/`ls` through lean-ctx; `context-mode` is an MCP plugin adding `ctx_*` tools + FTS5 KB. Both intercept read/search with different mechanisms → duplicated token-saving machinery and two sets of instructions telling the model to use `ctx_*`.
- `pi-tscg` (tool-schema compression), `pi-cache-optimizer` (cache hit-rate), `pi-slim` (system-prompt slimming) all attack the system prompt / tool schemas. Your own autoresearch notes (in `pi-configuration.md`) say `tscg.aggressive` is the baseline; layering `pi-slim` + `pi-cache-optimizer` on top can fight each other (e.g. slimming the prompt can change the stable-prefix that `pi-cache-optimizer` relies on for cache hits).
- `pi-smart-compact` + pi built-in compaction + `compaction.reserveTokens: 60000` (4× the docs' default of 16384) — multiple compaction triggers.
- **Not necessarily broken**, but high redundancy → unpredictable interactions and harder debugging. Recommend dropping the ones you haven't measured a benefit for; keep `pi-tscg` (aggressive) + one of `pi-lean-ctx`/`context-mode` + built-in compaction.

### 6. Three other installed-but-unloaded packages = clutter

`pi-readcache`, `@hypabolic/pi-hypa`, `pi-context-prune` are in `node_modules` but not in `packages`. They consume disk and can confuse `pi pkg list` audits but have no runtime effect. Either add to `packages` or `pi pkg remove`.

### 7. Stale credentials in `auth.json`

`auth.json` holds `openrouter`, `nvidia`, and `opencode` keys, but the only provider in `models.json` is `Lilac` (and `deepseek` is used via the built-in provider + `DEEPSEEK_API_KEY` env var). The `openrouter`/`nvidia`/`opencode` entries are leftovers from the old 3-provider setup (per `pi-configuration.md` v0.80.7). `NVIDIA_API_KEY` is even unset. Recommend removing unused entries.

### 8. `~/.config/opencode/opencode.json` is legacy / orphaned

- **Evidence:** pi core does **not** reference `opencode.json` anywhere in `@earendil-works/pi-coding-agent/dist`. The claim in your `pi-configuration.md` that *"pi is a wrapper around OpenCode; OpenCode reads providers from `~/.config/opencode/opencode.json`, NOT `models.json`"* is **outdated** — current pi (0.81.1) uses `~/.pi/agent/models.json` as the authoritative provider config (per official `models.md`).
- **Impact:** The inline plaintext DeepSeek + Lilac keys in `opencode.json` are redundant with `auth.json`/env vars. File is `0600` (good), but it's a second copy of secrets for no benefit.
- **Fix:** Delete `opencode.json` (and the `opencode` entry in `auth.json`) once you've confirmed pi works without it.

### 9. `compaction.reserveTokens: 60000` is very high

Docs default is `16384`. 60k reserved means compaction triggers earlier and keeps a large response budget. Not a bug, but combined with `pi-smart-compact` it may over-compact. Revisit if you see premature compaction.

---

## 🟠 Documentation drift (your `pi-configuration.md` vs reality)

Your `~/pi-configuration.md` is dated 2026-07-14 for **pi 0.80.7**. It no longer matches the live config (pi 0.81.1):

| Doc says | Reality now |
| --- | --- |
| `defaultProvider: opencode-zen`, `defaultModel: big-pickle` | `Lilac` / `zai-org/glm-5.2` |
| 3 providers (opencode-zen, lilac, deepseek) | 1 provider (`Lilac`) in models.json |
| `modelRoles` documented & functional | dead setting (see #1) |
| `compaction.keepRecentTokens: 10000` | `20000` |
| `defaultThinkingLevel: low` | `high` |
| packages list (13) | 21 packages, different set |
| no `extensions` field | 6 explicit `@samfp/pi-essentials` extensions |
| "providers must be registered in opencode.json" | false on 0.81.1 (models.json is authoritative) |
| `pi-readcache`, `@hypabolic/pi-hypa`, `pi-context-prune` in packages | installed but not loaded |

The doc also contains **redacted-but-still-sensitive** material in the replication steps (it shows `LILAC_API_KEY=[REDACTED…]` placeholders, but the real keys live in `auth.json`/`opencode.json`). Treat the doc as a security-adjacent file. Recommend regenerating it from the current config or deleting it.

---

## 🟢 Minor / housekeeping

- **`~/.pi/agent/.git` is an empty directory** (0 bytes, not a valid repo). Stale leftover from a prior init. Safe to `rm -rf ~/.pi/agent/.git`. (Not a secret-leak risk — it's not a functional repo.)
- **`~/.pi/agent/git/.gitignore`** contains `*` but sits in a subfolder, so it only protects `~/.pi/agent/git/`, not the agent root. Harmless given no real repo, but misleading.
- **`tscg.json`** (`enabled:true, profile:aggressive`) ✓ consistent with your autoresearch finding and the installed `pi-tscg`.
- **`web-search.json`** (`allowBrowserCookies:true`) ✓ fine.
- **`trust.json`** (`{"/home":true}`) ✓ fine for cwd `/home`.
- **models.json models** all parse, no duplicate IDs, `compat` block is valid for Lilac's OpenAI-compatible endpoint.
- **`@samfp/pi-essentials` extensions** — all 6 explicit paths exist ✓. (4 of the package's 10 extensions — `screenshot`, `subagent`, `context-pruner`, `daily-log` — are intentionally not loaded.)
- **`rtk.ts` extension** ✓ auto-loaded from `~/.pi/agent/extensions/`, and `rtk 0.43.0` is installed (≥ required 0.23.0).
- **Possible subtle issue (not confirmed):** `zai-org/glm-5.2` is marked `reasoning:true` but the Lilac provider sets `compat.supportsReasoningEffort:false` and no `thinkingFormat: "zai"`. If Lilac's GLM endpoint expects ZAI-style thinking params, extended thinking may not engage properly. Worth a quick check against Lilac's API docs if you rely on GLM reasoning.

---

## Recommended action checklist

1. **Fix `models.json` `apiKey`** → `"$LILAC_API_KEY"` (or remove the field). *(bug #2)*
2. **Remove `modelRoles`** from `settings.json` — it does nothing. *(bug #1)*
3. **Decide on context pruning**: add `npm:pi-context-prune` to `packages` OR delete `~/.pi/agent/context-prune/settings.json`. *(bug #3)*
4. **Delete `~/.pi/rules/lean-ctx.md`** (or move to `~/.pi/agent/prompts/`). *(bug #4)*
5. **Prune the optimization-stack** to what you've measured (keep `pi-tscg` + one read-router + built-in compaction). *(#5)*
6. **`pi pkg remove` the unused** `pi-readcache`, `@hypabolic/pi-hypa` (and `pi-context-prune` if you chose delete in #3). *(#6)*
7. **Clean `auth.json`**: drop `openrouter`, `nvidia`, `opencode`. *(#7)*
8. **Delete `~/.config/opencode/opencode.json`** after verifying pi still works. *(#8)*
9. **Regenerate or delete `~/pi-configuration.md`** — it's stale and key-adjacent. *(#9/docs)*
10. `rm -rf ~/.pi/agent/.git` (empty stale dir). *(housekeeping)*

All file edits are low-risk and reversible. After changes, restart pi and run `/model` to confirm the Lilac provider + `zai-org/glm-5.2` still resolve, and `pi pkg list` to confirm the package set.
