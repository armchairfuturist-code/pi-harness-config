# Pi agent harness contract

Source of truth for reusable agent-home behavior. Project rules belong in each project's `AGENTS.md`. `APPEND_SYSTEM.md` stays a thin CE-lite dispatch hook.

## Skills

On-disk skills are lazy: they may load when invoked or matched, but their bodies do not belong in the fixed prompt. Keep entry metadata concise and move detail to references. Do not use skill denylists as a token optimization without a measured regression.

CE-lite is the operator-facing orchestrator. Diagnostic and specialist skills remain on demand.

**Maintenance rule:** any skill add, rename, or remove triggers a CE-lite routing review — check the route-selection table in `reference.md` and the specialist-references list in `SKILL.md`.

Optional package profiles live under `~/.pi/profiles/`:

- `research` — recent-discourse tools; adds fixed tool schemas while enabled.
- `audit` — Better Harness slash-command review.

## Tool execution

1. Prefer `ctx_read`, `ctx_edit`, `ctx_execute`, `ctx_batch_execute`, `ctx_grep`, `ctx_find`, and `ctx_ls` over raw shell.

**Tool gateway (lean profile):** only a lean core is schema-injected per turn. All other lean-ctx tools stay callable — reach them via `ctx_call(name, args)` (MCP) or `lean-ctx call <tool> --json '<args>'` (shell). High-value ones: `ctx_knowledge` (persistent memory), `ctx_fetch_and_index` (web→KB), `ctx_execute_file` (sandbox over files), `ctx_compose` (code Q&A), `ctx_batch_execute` (parallel cmds). Full list: `lean-ctx tools list --all`. If a tool you want isn't first-class, don't conclude it's unavailable — call it through the gateway.
2. Never run inline interpreters or shell heredocs into interpreters; write a script, then run it.
3. After an edit miss, re-read the exact slice and never retry identical stale text.
4. Verify multi-file changes with the cheapest relevant parse, search, test, or build.
5. After a shell policy block, change tool strategy instead of repeating it.

`runtime-discipline.ts` injects recovery guidance only after an observed allowlist/edit failure. Long-session reminders use UI notifications rather than changing the system prompt.

## Enabled local extensions

- `transcript-pruner.ts` — DEDUP, STALE, and CLEAR transcript pruning.
- `session-index.ts` — extractive cross-session summaries without an LLM call.
- `runtime-discipline.ts` — event-driven recovery and one-shot long-session notification.

Package-provided UI extensions are listed explicitly in `settings.json`. Domain-specific tools never belong in the generic default.

## Context and session hygiene

- Preserve the last few full tool results; prune older spent output without deleting final evidence.
- Hand off before context health degrades; CE-lite owns thresholds and handoff content.
- Keep the stable system prefix small. Event-specific guidance must not sit in `APPEND_SYSTEM.md`.

## Deployment and proof

- `settings.json`, `install.sh`, package lock, extension files, and benchmark inventory must agree.
- Run `scripts/harness-preflight.sh` after settings, package, extension, or patch changes.
- Run `bench/probe.sh` for fixed overhead and `bench/semantic-canary.sh` before changing TSCG compression.
- Benchmark captures must record commit, config hash, package versions, effective TSCG config, and sorted tool names.
- Package patches are version-gated and applied by `scripts/apply-package-patches.sh`; preflight fails when their signatures are missing.
