# Harness Progress Summary

This document summarizes the optimization, configuration, and structural progress of the Pi agent harness.

## Current state

The harness configures a highly optimized, lean Compound Engineering agent model built around a minimal always-on footprint. The following details reflect the live active configuration files:

### 1. Core Settings (`settings.json`)
* **Compaction Settings**: Enforces strict context budget parameters:
  * `keepRecentTokens`: 20,000 tokens
  * `reserveTokens`: 60,000 tokens
* **Default Model Routing (Lilac Provider)**:
  * `defaultModel`: `"zai-org/glm-5.2"`
  * `defaultProvider`: `"Lilac"`
  * `defaultThinkingLevel`: `"medium"`
* **Active Extensions**: Reduced to 6 lightweight utilities to prevent background context-bloat:
  * `auto-session-name.ts`
  * `auto-title.ts`
  * `clipboard-image.ts`
  * `compact-header.ts`
  * `image-context-pruner.ts`
  * `markdown-viewer.ts`
* **Active Packages**: 15 modular packages, including:
  * `context-mode` & `pi-lean-ctx` (for active file pruning and CLI tool handling)
  * `pi-slim` & `pi-tscg` (enabling aggressive system-prompt and schema compaction)
  * `pi-autoresearch` (for autonomous optimization execution)
  * `@quintinshaw/pi-dynamic-workflows` (driving multi-agent subagent routing and review phases)

### 2. Workflow Model Tiers (`workflows/model-tiers.json`)
Routing thresholds are hardcoded to direct appropriate reasoning strength per task phase:
* **`big`**: `"Venice/kimi-k3:xhigh"` (utilized for complex, multi-perspective reasoning)
* **`medium`**: `"Venice/gemini-3-5-flash"` (utilized for intermediate processing, reviews, and worker subagents)
* **`small`**: `"Venice/mercury-2:minimal"` (utilized for leaf operations and trivial tasks)

---

## Timeline of improvements

A trace of the structural improvements made across the harness configuration history.

* **2026-07-13**:
  * Deployed the global `@hypabolic/pi-hypa` extension to address CachyOS rewrite intercept issues.
  * Solved `ENOENT` failures for `pi-lean-ctx` by importing and routing to a precompiled `lean-ctx` binary (v3.9.8) at `~/.local/bin/lean-ctx`, caching 14 tokens.
  * Deployed `pi-tscg` for automatic tool-schema compaction and `pi-context-prune` for active agent-message compaction backed by DeepSeek. Verified a 31.5% context footprint reduction (15.6KB down to 10.7KB).
  * Rewrote extraction logic in `omp launch` token metric parsing to prevent double-counting cumulative `usage.totalTokens` per `turn_end`.
* **2026-07-14**:
  * Audited provider channels, removing inactive and error-prone `Nahcrof` and `crof.ai` billing configs.
  * Authored `pi-configuration.md` as the replication blueprint defining the core config schema and packages.
* **2026-07-15**:
  * Standardized the Lilac provider in `~/.pi/agent/models.json` by adding effort levels and model slugs. Restated model-level verbosity limits via strict `maxTokens` configs.
  * Initiated the first autoresearch experiment loop to optimize the local harness, finding a "warm-up" token penalty where first request configurations carry an overhead penalty.
* **2026-07-20**:
  * Configured and integrated the newer `pi-subagents` package within core `settings.json` to process background natural language prompts via specialized subagents.
  * Restricted model access to zero-cost models using filtered configs under `opencode-zen`.
* **2026-07-21**:
  * Disabled unused Orca agent status-reporting extensions globally; purged deactivated `pi-lilac-provider` package.
  * Registered direct Lilac provider in `models.json` using a new API key and smoke-tested Qwen, Kimi, and GLM.
  * Evaluated `rtk.ts` (bash-tool interceptor and command rewriter) on the Pi harness. Found that `rtk.ts` hooks target bash tool calls, but since context-mode "replace" mode intercepts and deletes the bash tool entirely, `rtk.ts` is inert at runtime.
  * Verified rules under `~/.pi/rules/` are successfully resolved and direct models to batch operations (like `ctx_compose`).
  * Reconciled discrepancies in `settings.json` across OMP, Pi, and OpenCode2 workspaces to eliminate configuration drift.
* **2026-07-22**:
  * Audited package loading and discovered `pi-context-prune` was installed but missing from `settings.json`'s packages array. Fixed configuration discrepancies.
* **2026-07-23**:
  * Configured settings in `web-search.json` for `pi-web-access` to automatically whitelist consent permissions and prevent blocking dialogs on queries.
* **2026-07-26**:
  * Registered surplus-intelligence Venice Inference API into `~/.pi/agent/models.json` under `VENICE_INFERENCE_KEY` with 19 verified endpoints. Enabled high/max reasoning levels on both Venice and Lilac configurations.
  * Formulated findings from the "autoresearch-prompt-quality" experiment. Showed that an always-on, injected-every-turn sharpening rule yields zero correctness gains while increasing token cost by ~50%. Converted to an on-demand, opt-in `/sharpen` skill to maintain a zero-token baseline overhead.
* **2026-07-27**:
  * Formulated the Wayfinder master roadmap mapping Anthropic context-loading benchmarks, progressive disclosure, and dual-phase tool loading.
  * Deployed the "CE-lite thin kernel" configuration, slashing fixed, always-on context overhead by 30.6% (5,789 tokens to 4,014 tokens) by stripping heavy, unused background packages (e.g., `pi-mcp-adapter`, `pi-goal-list-loop-audit`, `pi-web-access`) from `settings.json`. Established `skills/ce-lite/SKILL.md` as the unified task-orchestration driver.
* **2026-07-28**:
  * Executed a 27-iteration autoresearch optimization campaign on local token-overhead. Proved `pi-tscg` (−6,467 tokens via schema compression) and `pi-slim` (−323 tokens) are highly load-bearing. Swapped and tightened grammatical phrasing in `APPEND_SYSTEM.md` (saving 9 tokens) to localize optimal overhead at 4,007 tokens.
  * Rewrote proxy-capture probe benchmark monitoring (`bench/probe.sh`) to eliminate warm cache hits and ensure cold-gated token measurements. Deleted inert `rtk.ts` from extensions entirely.
* **2026-07-29**:
  * Patched workflows to prevent subagents from inheriting the parent's `xhigh`/`max` thinking effort level (which caused Lilac API 400 crashes). Subagents now map high-thinking tiers back to `high`.
  * Context-mapped domain-specific skills to restrict installation strictly to `~/.pi/agent/skills`, preventing package collisions, and configured manual `ask-matt` router to index 39 skill paths with model-invocation disabled (saving 1,380 tokens/turn).
  * Implemented multi-model tier routing locally in `workflows/model-tiers.json`.
  * Shipped 6 long-horizon audit fixes: worker result contract, proactive handoff, read-before-decide, decomposition routing (ce-lite), `session-index.ts` (zero-token session summaries), `memory-consolidate` workflow (constraint dedup 9→6).
  * Reconciled the 4,007-token floor stat across probe.sh and bench-systima (4,014 ≈ 3,979 ≈ 4,003 — same measurement, floor intact). Found and reverted an `enableMcp:true` flip: the lean-ctx bridge triggers intent-based tool-surface expansion (22→78 tools, +9.6k tok/req on file tasks); `enableMcp:false` is load-bearing.
  * Ran complexity-gradient A/B vs OMP (systima rig): pi floor 4× leaner (4,003 vs 15,834) and complexity-invariant (~20.5k for T2/T3) while OMP compounds (48k→97k).
  * Mined cache-optimizer stats (842 sessions, 16d): 90–98% of input tokens are prefix-cache reads; fresh tokens concentrate in long sessions and cache-unfriendly models (kimi-k2.6 = 3.3× glm-5.2 fresh/req). Optimize conversation growth, not the floor.
  * Ran bounded autoresearch terseness campaign (8 iterations): two APPEND_SYSTEM.md sentences → −17.1% suite tokens, −38% output, −21% round-trips (canaries caught the best-metric iteration being a quality failure). Cross-model transfer confirmed (glm-5.2/k2.6/k3: aggregate out −28%, reqs −33%). Floor 4,005→4,071 (netted).
  * Vendored all fixes into this repo (extensions/session-index.ts, workflows/saved/memory-consolidate.json, model-tiers.json, ce-lite sync) + "Migrating into an existing install" README section. Ponytail audit applied: removed run-pi-trials.sh, 9 cache-optimizer .tmp litter files, orphaned context-prune config, inert ~/.pi/rules/lean-ctx.md (+ its .bak; backup in /tmp). Purged pi-hermes-memory remnant. Mapped 4 harnesses on this machine (pi, omp, codex, cursor); OMP has native cross-session memory — pi's equivalent is session-index + context-mode FTS5. Attribution corrections recorded in ~/.pi/agent/memory/consolidated.md.

* **2026-08-03**:
* TSCG `aggressiveMaxDescChars` tuning campaign (10 values tested 5–50). probe_tokens are deterministic & monotonically decreasing in description length. Optimum = 5 (constraint floor, ≥5): probe 4,874→4,339 tok (−535, −11.0%). checks_pass stochastic in the bench (spurious fails at 7/10/18/25 too, all pass on retry); 5 passed 3/3. bench_tokens too noisy (±10k) to optimize on. Updated both `~/.pi/tscg.json` and repo `tscg.json`. README rewritten with WHY/HOW narrative and current measurements. Probe verify threshold updated 4,052→4,400.
* **2026-07-30**:
  * Thinking-level economics campaign (Venice/kimi-k3, T1+T3): `high` beats `xhigh` by **−34% suite tokens, −40% output, −28% round-trips**; `medium` ties cost but fails the hardest-task canary (quality cliff located). Promoted `defaultThinkingLevel: xhigh → high` and reasoner-tier pin `kimi-k3:high`. Mechanism: thinking cost compounds via turn *multiplication*, not just reasoning tokens.
  * Removed `extensions/rtk.ts`: verified inert — lean-ctx replace mode means the model calls `ctx_shell`, never `bash`, so rtk's bash-hook fires zero times. rtk belongs to the OMP harness (which has no lean-ctx).
  * ce-lite suite campaign running (5 non-trivial briefs incl. operator-added wayfinder/handoff long-horizon shapes; `skill_loaded=10/10` premise confirmed). Baseline 135.9k/46 reqs; plan-economy iter1 discarded after canary caught skipped discovery (legacy-values regression).
  * Rebuilt bench rig after untracked-file loss: `proxy-oi.mjs` rewritten (+accept-encoding fix for Venice gzip, +usage-key normalization), `gradient.sh`, `run-bench.sh` (now thin wrapper); all rig files now git-tracked. Killed the zombie capture proxy and cleaned capture/label litter.
  * Key hygiene: scrubbed 3 rotated credentials from `docs/pi-configuration.md` (push protection caught them); verified full history + all branches key-free; provider configs are env-var references only.
  * Cross-model terseness transfer confirmed (glm-5.2/kimi-k2.6/kimi-k3: aggregate out −28%, reqs −33%, canaries green).
  * **Machine cleanup (evening)**: removed OMP harness + rtk + headroom entirely (binaries, `~/.omp`, audit-upgrade systemd timer, shell-rc headroom env blocks); removed `.pi-lens` (533M), `.pi-glla`, `.pi-meter`, `.autoresearch-pi`, stale caches/backups (~540M freed). Active harnesses: pi, codex, reasonix.
  * **hypa removed**: `@hypabolic/pi-hypa` was uninstalled but left a broken `~/.local/bin/hypa` shim — 522/564 of all 30-day `command not found` errors came from agents invoking it. Shim deleted, `@hypabolic` allowScripts residue cleaned, stale doc references corrected.
  * **context-mode local patch**: `buildBatchNodeOptionsPrefix` emitted `NODE_OPTIONS='...' <cmd>` — a bash syntax error before `for`/`if`/`while` (broke ctx_shell/ctx_batch_execute loops). Patched to `export NODE_OPTIONS='...'; <cmd>` in `build/server.js` + both `.mjs` bundles. **Re-apply after any context-mode upgrade.**
  * **New live skill `harness-doctor`** (`~/.pi/agent/skills/`): verified harness/provider/credential inventory (snapshot + drift) and transactional provider add/remove (dry-run default, snapshot → validate → residue-scan → auto-rollback). Pi-native replacement for the OMP system-health-check skill (deleted with OMP).

---

## Open threads

The following paths are active areas for investigation and optimization:
1. **Lazy Tool Loading Scale**: A two-phase lazy tool loading router was analyzed but deferred. It is deemed uneconomical at the current 22-tool scale, but should be re-evaluated when the local list of active tools grows beyond 50.
2. **First Request Warm-up Penalty**: Evidence indicates a "warm-up" token penalty where package configuration changes invoke higher startup costs on the first model query. Further exploration of initialization caching is required.
3. **Compactor Refinement**: Continued monitoring of context-mode integration to determine if further compression of settings, provider descriptions, and custom rules can lower the baseline overhead below the current 4,339-token floor.

---

## Evidence index

This section lists and maps the source research logs, configurations, and benchmarks confirming the harness developments:

1. **Settings configuration**: Verifiable directly via `/home/alex/Projects/pi-harness-config/settings.json` (defines packages, compaction limits, and extensions).
2. **Model and Tier Rules**: Configured and traceable inside `/home/alex/Projects/pi-harness-config/workflows/model-tiers.json`. (The inert `~/.pi/rules/lean-ctx.md` was removed 2026-07-29 — pi has no `rules/` loader; backup at `/tmp/lean-ctx-rules-backup.md`.)
3. **Core Orchestration**: Defined inside `/home/alex/Projects/pi-harness-config/skills/ce-lite/SKILL.md` and the `WORKFLOW.md` spec.
4. **Token Overhead Campaign Reports**: Detailed in findings report `/home/alex/Projects/pi-harness-config/research/autoresearch-config-overhead-20260728/findings.md` mapping the 27 runs and the local 4,007-token minimum.
5. **Prompt Quality and Sharpening Findings**: Archival data in `/home/alex/Projects/pi-harness-config/research/autoresearch-prompt-quality-20260726/findings.md` verifying the 50% surge and the transition to opt-in rules.
6. **Canary and Proxy Metrics**: Outlined in `/home/alex/Projects/pi-harness-config/research/canary-rtk-models-20260728.md` tracking cold-gated measurements via local proxy capture.

### Excluded App / System Document Checklist
To ensure the harness progress remains isolated from independent projects, the following files are excluded from these harness metrics per workspace guidelines:
* **App Project Repositories**: FALA, mindscape, bio-orchestrator, rooted-leader-site, ArmchairFuturistLanding, Investment-Engine, and resume-pipeline are managed in separate independent git subdirectories.
* **System OS tuning**: `/home/alex/cachyos-performance-recommendations.md` (which documents AMD CPU and scheduler tweaks) is also excluded as it deals with physical kernel behaviors rather than agent context profiles.
