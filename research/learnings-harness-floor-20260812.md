# Learnings — harness floor after howaboua trio (2026-08-12)

Concise, durable lessons from the 80+ experiment campaign. For a future agent:
avoid re-deriving these, and don't re-trust a broken measurement tool.

## 1. A broken probe silently returns null and the dashboard still says "12x confidence"
`bench/probe.sh` had THREE independent breakages (post howaboua PR):
  - ran `pi -p` (plain text, output just "pong") instead of `pi --mode json` (NDJSON stream)
  - wrote JSON to `bench/out/` while `observe.sh` read from `.scratch/bench-results/`
  - regex looked for `"input_tokens"`; pi actually outputs `"input"`
Result: `probe_total=null` for 24 runs, yet the harness continued showing a
mathematically-certain "improvement 12.4x" — because it normalized against a false baseline.
Rule: if the primary metric is null, distrust every downstream "improvement" reading.
Repair = parse NDJSON `message_end.usage`; write observe-schema JSON to `.scratch/bench-results/`.

## 2. The trio's floor cost is EPOCH-DEPENDENT, not universal
  - kimi-k3 epoch: causal A/B (settings packages[] on/off, n=6) => ~0 token delta (floor-free)
  - syn:small:text epoch: n=5, delta 60 tokens (~1.6%), zero overlap, pooled delta/SD 3.16 => real cost
Conclusion: "trio is free" is only true per-epoch. Re-measure after any model/config change.
The only always-on model-facing tool in the trio is `change_reasoning` (auto-reasoning); the others
are UI/on-demand.

## 3. The baseline-corruption trap: phantom wins from a fake baseline
Session's first log row recorded metric=18232 as "baseline" while the broken probe returned
probe_total=null (it grabbed a workload median). Every later run then showed "-70% / high confidence"
VERUS a fabricated baseline. Fix: re-init the experiment and rebase after any environment change.
Also: external changes (model swapped to syn:small:text + thinking off) move the floor ~30% with
NO code change — never claim external drift as your own optimization (the 28.7x read was this).
Baseline discipline: same-epoch A/B at n>=5; vary ONE variable; restore config after.

## 4. No in-scope, non-locked, one-variable contract reduction exists (13+ levels)
  - 16 always-on packages, 6 extensions, 10 skill files: all source-audited, none register a
    model-facing tool beyond change_reasoning (locked reasoning knob)
  - extension API is EMBEDDED (no tool-description override hook; @mariozechner/@earendil-works dirs empty)
  - settings knobs (defaultThinkingLevel/hideThinkingBlock/steeringMode): all null at adequate n
  - decisive mechanism test: trimming tool-description text does NOT move probe_total
    (floor is the cached system+tools prefix, not description strings)
  - only real lever = node_modules/context-mode descriptions (~extra), out-of-scope + proven nil effect

## 5. Operational: FTS5 knowledge-base corruption (actionable)
lean-ctx status: mcp 4/5; ctx_batch_execute/ctx_search/ctx_index all fail with
`fts5: corruption found reading blob 1511828488193` on BOTH read and write.
Root cause: MCP-hosted search store chunk table is damaged. Not repairable in-context.
Needs an infra-level rebuild of the lean-ctx/MCP search store.
Impact: the multi-command batch tool (ctx_batch_execute) is permanently blocked;
use ctx_shell for measurement.

## Suggested next (distinct) campaign
Apply the model-facing-api-design skill to skills/ce-lite/ (in Files-in-Scope).
NOTE: ce-lite is on-demand, so changes will NOT move probe_total — measure via real-workload
totalInputTokens or the skill's token-lines on the skill files, not this campaign's floor metric.
