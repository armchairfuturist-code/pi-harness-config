# 04 — Research: orchflows, super-pi, pi-dynamic-workflows primitives

Type: research
Status: resolved
Blocked by:

## Question

Which **primitives** from orchflows, super-pi, and `@quintinshaw/pi-dynamic-workflows` should inform a single Pi CE-lite orchestrator — without bulk-installing those stacks?

Cover:

1. **super-pi**: how it extracts methods/phases without installing every referenced package; token-cost notes if present
2. **orchflows**: engines, compositions, token-economy rules, delegation/verification — what is portable to Pi vs Claude/Codex-specific
3. **pi-dynamic-workflows**: native Pi workflow model; how "just knows" routing can work; always-on cost
4. Comparison table: mechanism → Pi-native analogue (existing or gap)
5. Recommendation sketch: compose vs single workflow pack vs thin extension (decision deferred to grilling; research only frames options)

Primary sources: GitHub repos + package docs/source.

Output: `research/wayfinder/04-orchestration-primitives-comparison.md`

## Answer

Research complete. Artifact: [`research/wayfinder/04-orchestration-primitives-comparison.md`](../../../research/wayfinder/04-orchestration-primitives-comparison.md)

**Gist:** Best Pi-native “just knows” candidate = pi-dynamic-workflows; super-pi ~4.1k fixed; orchflows donates token-economy rules. Compose options framed for ticket 08.
