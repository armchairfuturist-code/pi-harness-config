# 10 — Grill: validate or revise model-role posture

Type: grilling
Status: resolved
Blocked by: 06, 08

## Question

Lock model roles for default exec, simple exec, audit, deep research — confirming or revising the cheap/mid/expensive hypothesis against research and the chosen orchestrator/subagent stack.

## Answer

**Resolved AFK under handoff contract.** Hypothesis **confirmed with research-06 revisions** (reviewer ≠ cheapest; expensive tier extends beyond research to hard planning/ambiguous design). Locked against the dyn-workflows stack, which resolves tiers from `~/.pi/workflows/model-tiers.json` (auto-derives from the live registry when absent).

### Locked role table

| Role | Tier | dyn-workflows slot | Used for |
|------|------|--------------------|----------|
| `router` / parent (ce-lite) | mid–high | — (parent = pi default model) | Triage, grilling, synthesis, operator voice |
| `worker` | mid–high | `medium` | Implementation, drafting, multi-step exec |
| `leaf` | cheap | `small` | File lists, greps, narrow extraction, per-source fetch/summarize in fanout |
| `reviewer` | mid — **not cheapest** | `medium` | Correctness review, adversarial-review pattern |
| `auditor` / verify | cheap→mid | `small`→`medium` | Contract-term checklist verification phase |
| `reasoner` | expensive | `big` | Deep research synthesis, hard planning, novel architecture, gnarly debug |

### Pinning rules (operator pack)

1. **Roles pin in exactly one file:** `~/.pi/workflows/model-tiers.json` (`small`/`medium`/`big` → one model spec each). Parent role = `defaultModel` in `settings.json`. No model IDs in skills, prose, or workflows — tiers only.
2. **Never pin fragile IDs in the pack.** Model catalogs churn (live default is already Venice/kimi-k3 vs repo's Lilac/glm-5.2). On apply: let dyn-workflows auto-derive tiers from the live registry, observe one week, then pin the file explicitly.
3. **Re-benchmark quarterly** or on provider notice; swap IDs in the one file, never in prose.
4. Cheap tier must still clear the capability floor for its job (leaf tasks are mechanical); if a leaf pattern mis-routes, bump that pattern's tier in the workflow, not the global file.

Hypothesis deltas vs original: default exec mid–high **kept**; cheap simple+audit **kept with revision** (adversarial review is `medium`, mechanical audit checklists may be `small`); expensive research **kept and extended** to hard planning/design.
