# 06 — Multi-model routing harness practice

**Ticket:** 06  
**Date:** 2026-07-27  

## Hypothesis under test

| Role | Tier |
|------|------|
| Default execution / coding | Mid–high (top-10 coding) |
| Simple execution + auditing | Cheaper |
| Deep research & hard reasoning | Expensive |

## Primary-ish practice signals

### 1. pi-dynamic-workflows tiers
Source: package README.

- Explicit `small` / `medium` / `big` (or exact model) **per agent()** call.
- Orchestrator script chooses tier by task grain (list files = small; synthesize = big).
- **Supports hypothesis shape**, with audit/review often medium and synthesis big — cheap models for narrow fanout leaves.

### 2. pi-subagents profiles
Source: pi-subagents skill/docs (profiles, `/subagents-models`).

- Per-agent model mapping and profiles are first-class.
- Reviewer/worker/oracle specialization often paired with different models in community usage patterns.

### 3. OpenAI multi-agent guidance (secondary)
Source: OpenAI agents SDK docs (orchestration patterns).

- Use multiple agents when specialists own different parts; choose who owns user-facing answer.
- Cost control via smaller models on bounded subtasks is standard practice — aligns with cheap leaf agents.

### 4. Super Pi stage routing
Source: super-pi token eval / README.

- Hooks can auto-switch model/thinking **per pipeline stage** (0 token hook cost claimed).
- Suggests: brainstorm/plan might use higher reasoning; mechanical work cheaper — **partial revise** of “expensive = research only”: expensive may also be plan/hard debug.

### 5. Live config observation
- Live default: `kimi-k3` @ Venice (not necessarily “top-10 coding” forever — treat as swapable).
- Repo baseline historically used other defaults (e.g. GLM) — model IDs churn; **roles** should be stable names, not pinned IDs in the operator pack.

## Validate / revise hypothesis

| Original | Verdict |
|----------|---------|
| Mid–high default exec | **Keep** as default parent / worker tier |
| Cheap simple + audit | **Keep** for fanout leaves & maybe mechanical audit checklists; **revise:** adversarial review may need mid tier, not cheapest |
| Expensive deep research & hard reasoning | **Keep**, and **extend** to hard planning / ambiguous architecture — not research-only |

### Revised posture (recommendation for ticket 10)

| Role | Tier | Examples |
|------|------|----------|
| `router` / parent orchestrator | mid–high | CE-lite driver, user-facing |
| `worker` | mid–high | Implementation |
| `leaf` | cheap | file lists, greps, narrow extract |
| `reviewer` | mid (not cheapest) | correctness review |
| `auditor` | cheap→mid | contract checklist verify (glla-style) |
| `reasoner` | expensive | deep research, hard tradeoffs, novel design |

**Pin models by role name in config**, not in prose skills. Re-benchmark quarterly.

## Implications
- Choose multi-agent stack that supports **per-child model** (dyn-workflows / pi-subagents) — delegate.ts does not.
- Usability canary should include at least one multi-tier workflow run.
