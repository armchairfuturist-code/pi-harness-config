# Harness Survey → pi Action List

Source: `~/Desktop/8945_Agent_Harness_Engineering.pdf` — "Agent Harness Engineering: A Survey"
(TMLR submission, May 2026, 64pp). Sections mined: §5 (Context Management), §8 (Verification/Eval).
Caveat: under-review preprint; treat headline gains (10× harness-only, +13.7pp Terminal-Bench) as directional.
Distilled against live pi config 2026-07-30. Ordered by leverage.

## §5 Context Management

### 1. Prefix-stability audit (§5.3 KV-cache rules)
Paper: stable prefix, append-only context, deterministic serialization, never mutate tool list
mid-session (Manus: KV-cache hit rate = "single most important metric"; $0.30 vs $3.00/MTok).
Status: `enableMcp:false` already satisfies static tool surface (22 tools, ~4,007-tok floor — validated).
TODO: audit per-turn injections for prefix variance (timestamps, random ordering, non-deterministic
JSON keys in extension-injected blocks) via cache-optimizer stats, per extension. Keep
APPEND_SYSTEM.md edits at session boundaries only (already standing rule).

### 2. Critical-directive placement (§5.1 U-shaped attention)
Paper: accuracy drops >30% when relevant info sits mid-context; placement matters as much as presence.
TODO: move highest-stakes rules to start or end of APPEND_SYSTEM.md, never middle. Free, no measurement.

### 3. Compaction-quality probe (§5.6)
Paper: calibrate compaction by maximizing recall FIRST, then precision. Summary must preserve
architectural decisions, unresolved bugs, implementation details.
TODO: post-compaction canary — after compaction fires, probe recall of 5 critical facts.
Side benefit: whichever component's output survives the probe identifies the unknown
`~/.pi/agent/.cache/smart-compact/` writer (open question in consolidated.md).

### 4. Tool-result clearing (§5.6)
Paper: lightest continuous compaction — replace acted-on tool outputs with compact path references.
TODO: measure how much of long-session fresh-token growth is uncleared tool outputs vs conversation.
context-mode readcache does this partially — quantify the gap. This is the precise attack on the
#1 cost driver (fresh tokens concentrate in long sessions — cache-optimizer stats).

### 5. Workflow sub-agent return caps (§5.6 sub-agent isolation)
Paper: orchestrator should receive 1–2K-token condensed summaries; full-context sharing produces
larger prefills and kills KV-cache reuse. Make isolation-vs-sharing choice explicit per task type.
TODO: audit pi-dynamic-workflows agent return sizes; cap; measure prefill delta.

## §8 Verification / Evaluation

### 6. Pre-flight readiness check (§8.3)
Paper: validate environment, tools, context state, permissions, budgets, graders BEFORE execution,
so setup failures aren't misattributed to the model.
TODO: add `--preflight` mode to harness-doctor inventory script (in progress): providers alive,
binaries on PATH (catches hypa-class failures — 522/30d), canaries green before suite spends tokens.

### 7. Trajectory metrics as first-class canaries (§8.5.2)
Paper: judge the path, not just outcome — redundant calls, retry loops, permission violations.
Failure → layer-specific repair (wrong tool → tool interface; forgotten constraint → context layer;
looping → orchestration).
TODO: add tool-error count + retry-loop count to autoresearch T1–T3 canaries, classified by harness
layer (env/PATH vs tool-interface vs orchestration). Baseline from 2026-07-30 mining:
898 errors/30d (command-not-found 173, edit-mismatch 105, MCP-bridge 38); turn multiplication
is the known cost driver.

### 8. Harness-change regression gate (§8.6.1 + §8.1)
Paper: regression eval triggered by harness changes (tool descriptions, compaction policy,
permission rules, judge prompts), not just model changes. Scores are properties of the
model–harness pair — lock one variable per run.
TODO: standing rule — any harness config change triggers the canary suite. Record harness-config
hash in every benchmark result. (Terseness + thinking campaigns did this ad hoc; formalize.)

### 9. Production traces → canary cases (§8.6.2)
Paper: production failures become regression tests; evaluation failures become observability signals.
TODO: convert 2026-07-30 findings into permanent suite cases:
- compound `for`-loop through ctx_shell (context-mode NODE_OPTIONS prefix bug — patched in
  build/server.js + cli/server bundles; re-apply after context-mode upgrade)
- edit-tool exact-match on whitespace-varied files (sed/python fallback rule)
- missing-binary invocation (hypa — now documented as not-installed in harnesses.md)

## Status (2026-07-30 evening)
- Item 1 DONE — `prefix_audit.py`; all celite lanes STABLE (1 prefix hash/lane, 0 timestamped)
- Item 2 DONE — verified APPEND_SYSTEM already U-optimal (routing first, guardrails last); no churn per cache-prefix-stability rule
- Item 3 DONE (probe built; writer resolved) — s9 compaction-recall canary added; smart-compact writer = **OMP by elimination** (exhaustive string search: pi core, agent npm, extensions, skills, bins, context-mode, lean-ctx all clean; writes ceased with OMP removal — recurrance ⇒ pi-core obfuscated, reopen)
- Item 4 DONE (measured) — `context_growth.py`: toolResult = p50 49% of context bytes; 98.7% of big tool outputs reach model UNCLEARED; but top fresh-token sessions are conversation-dominated (share 0.24–0.54) → attack = compaction/turn management for the head, tool-clearing for the 88-session mid-tail (6.1M, 13%)
- Item 5 DONE (audited) — workflow/herdr_agent returns: p50 0.2KB, p95 8.6KB, max 11.1KB (~2.8K tok); script-variable isolation works; within paper guidance at p50, no cap needed (watch p95 tail)
- Item 6 DONE — `preflight.py` (23 checks incl. broken-shim exec-target scan); caught 4 broken shims on first run; 23/23 green
- Item 7 DONE — `trajectory_metrics.py` (layer-classified errors + retry loops; baseline 903 errors/30d); suite wiring = ideas.md #11
- Item 8 DONE — `config_hash.py` (baseline `bcb8dff8f834`) + README standing rule
- Item 9 DONE — `briefs-trajectory-20260730.md` (s6-s9) added to suite dir

## Execution note
Items 1, 2, 6 are near-free and compound with the harness-doctor build (inventory/provider-ops/
error-fixes) started 2026-07-30. Suggested order: 2 (trivial) → 6 (extends active build) →
1 (measurement) → 7 (canary extension) → 3+4 (compaction work, needs measurement first).

<!-- tool-result-clear-20260804 -->
## Update 2026-08-04 — Item 4 fix shipped
Acted-on tool-result **CLEAR** (keep=4) added to `extensions/transcript-pruner.ts`,
default ON. Campaign: `research/autoresearch-tool-result-clear-20260804/findings.md`.
5-run: total −10.7%, tpr −4.9% vs pruner OFF; checks 5/5. No further loop planned.
