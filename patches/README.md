# Patches

Patches applied to installed npm packages that are overwritten on upgrade.
Re-apply after `pi update --extensions` or `ctx_upgrade`.

## Measured impact

| Patch | Probe tokens | Delta |
|---|---|---|
| Baseline (no patches) | 4,118 | — |
| context-mode admin tools off | 3,851 | −267 (−6.5%) |
| + TSCG recursive truncation | 3,802 | −49 (−1.2%) |
| + dynamic-workflows slim | 3,802* | est. −450–1,000 (not yet re-probed) |
| **Total** | **3,802** | **−316 (−7.7%) +  slim** |

Probe: `bench/probe.sh` through capture proxy, single request, no tool calls.
Full workload: `bench/measure.sh` — 22,342 tokens median (replace mode) vs 24,856 (additive), −10.1%.

## context-mode admin tools

**File**: `context-mode/apply-patches.sh`

Removes 5 diagnostic/admin tool schemas (`ctx_stats`, `ctx_doctor`, `ctx_upgrade`, `ctx_purge`, `ctx_insight`) from the API request when `CTX_MODE_ADMIN_TOOLS=0`.

These tools are registered by context-mode's MCP bridge (`build/adapters/pi/mcp-bridge.js`). They cannot be removed via `lean-ctx`'s `disableTools` config (different extension) or Pi's `setActiveTools` (controls callability, not schema presence). The patch filters them at MCP `listTools()` registration time.

Also removes their references from the routing anchor injected via the `context` hook.

**Env var**: `CTX_MODE_ADMIN_TOOLS=0` (set in fish config and lean-ctx `env` map).

**Re-apply**: `bash patches/context-mode/apply-patches.sh`

## TSCG recursive truncation

**File**: `tscg/apply-patches.mjs`

Patches `truncateLongDescriptions` in `pi-tscg/extensions/tscg.ts` to recurse into nested parameter descriptions (array items, nested objects). Previously only first-level parameter descriptions were truncated to `aggressiveMaxDescChars` (30). Now all levels are truncated.

**Re-apply**: `node patches/tscg/apply-patches.mjs`

## dynamic-workflows routing

**File**: `dynamic-workflows/apply-patches.mjs`

Slims the always-on workflow authoring description and adds cross-provider tier fallback: configured `small`/`medium`/`big` anchors remain preferred; an unavailable anchor is replaced from the authenticated catalog using the package's existing cost/capability/context ranking, with thinking suffix preservation and at most one-tier downgrade. It never mutates `model-tiers.json` or auto-upgrades.

**Version-pinned**: refuses to patch if the installed package version ≠ `3.5.1` (update the pin after intentional upgrades).

**Re-apply**: `node patches/dynamic-workflows/apply-patches.mjs` or add `--self-test`.

## Why these patches exist

`setActiveTools()` in Pi's extension API controls which tools the agent can *call*, but does NOT remove their schemas from the API request sent to the model. The only way to remove tool schemas is to not register them in the first place — hence the patches to context-mode's MCP bridge and TSCG's truncation function.

## pi-lean-ctx MCP bridge resilience

**File**: `pi-lean-ctx/apply-patches.sh`

Patches `extensions/mcp-bridge.ts` `callTool()` to fix 495 MCP bridge errors across
121 sessions (Jul-Aug 2026). Two changes:

1. **Internal-error retry**: The existing code retries on timeout errors for
   retry-safe tools. The patch extends this to catch "lean-ctx internal error"
   (daemon alive, tool call failed) for ALL tools — force-reconnect + retry once
   before surfacing the error. Most internal errors self-heal on reconnect.

2. **Strip "Please retry"**: The daemon's error text says "Please retry or use a
   different approach" — the agent follows this instruction, creating retry+reread
   loops that inflate rot signals. The patch strips this phrase from errors that
   reach the agent.

Root cause was version drift (binary 3.9.15 vs npm 3.9.18) — `pi update --all`
updates the npm extension but NOT the standalone binary. Fixed by
`scripts/update-all.sh` + `preflight.py` version-sync check.

## lean-ctx extension vs rules/lean-ctx.md

**These are different things:**

- **pi-lean-ctx (the extension)**: Installed via `pi install npm:pi-lean-ctx`. Provides `ctx_shell`, `ctx_read`, `ctx_ls`, `ctx_find`, `ctx_grep`, `ctx_edit`, `lean_ctx` tools. Active, working, and complementary to context-mode (zero tool overlap). Measured −10.1% tokens in replace mode vs additive mode on the bench workload.

- **`rules/lean-ctx.md` (the file)**: A markdown instructions file in this repo. **Dead — not loaded by anything.** Pi only loads `AGENTS.md`/`CLAUDE.md` (context files) and `APPEND_SYSTEM.md` (system prompt append). No code in pi-core, lean-ctx, or context-mode reads `~/.pi/rules/`. Not in `install.sh`'s manifest. Kept for historical reference only.

## Tool ownership (no overlap)

| Provider | Tools |
|---|---|
| lean-ctx | ctx_shell, ctx_read, ctx_ls, ctx_find, ctx_grep, ctx_edit, lean_ctx |
| context-mode | ctx_execute, ctx_execute_file, ctx_index, ctx_search, ctx_fetch_and_index, ctx_batch_execute |
| Pi native | edit, write |
| dynamic-workflows | workflow, workflow_control |
