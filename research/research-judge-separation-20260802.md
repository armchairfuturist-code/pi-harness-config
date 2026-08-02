# Research/Judge Separation as a Harness Design Primitive

**Date:** 2026-08-02  
**Surface:** r/ClaudeAI Jul 28 ("Claude got more useful when I stopped asking it to research and judge in one pass") + r/ClaudeAI Jul 16 token-efficiency post (Architect+orchestrators+worker pattern)  
**External corroboration:** pilotfish (568★, "frontier model plans, cheaper models execute, verification guards quality"), awesome-harness-engineering (Birgitta Böckeler's feedforward+feedback model)

---

## 1. Why combining research + judgment in one pass degrades both

Three failure mechanisms, each sufficient on its own:

### Context pollution (the dominant mechanism)
When a model gathers evidence and then judges it in the same context window, the gathered material becomes the model's "prior." The model has already committed to framings, hypotheses, and narrative arcs during gathering. When it switches to "judge" mode, it cannot be skeptical of its own scaffolding — the scaffolding IS the context. This is not a prompt-engineering problem; it's structural. You cannot ask the same context to be both the advocate and the magistrate.

Concretely: if the model found 8 sources, 6 of which support hypothesis A, the context is now weighted toward A. A judge in a fresh context, given only the 8 source summaries + the hypothesis, can weigh them independently. The in-context judge has already "lived through" the discovery and unconsciously treats its own search path as evidence.

### Token budget split
Research consumes tokens on breadth (many sources, quotes, raw data). Judgment needs tokens on depth of reasoning (weighing, counterfactuals, risk assessment). In a single pass, both get shortchanged — the model runs out of budget before it can do deep evaluation, and the evaluation it does do is compressed into whatever's left after gathering. The token-efficiency post's insight: a cheap model can gather 10x more material than a single-pass expensive model, and a strong model judging pre-gathered evidence spends its entire budget on reasoning rather than retrieval.

### Role contamination
"Research" mode is expansive — cast a wide net, tolerate ambiguity, hold multiple hypotheses. "Judge" mode is reductive — eliminate, rank, decide. Asking one agent to do both in sequence means it never fully commits to either mode. The research phase is prematurely narrowed because the model anticipates the judging role, and the judging phase is insufficiently skeptical because the researcher-self has advocacy inertia.

---

## 2. Where the user's current setup ALREADY does this split

### ce-lite routing layer — partial split
The ce-lite SKILL.md separates routing from execution:
- **Lookup** → research path (workflow deep-research or direct fetch). This is pure gather — no judgment.
- **Non-trivial** → contract loop, which has explicit **Execute** (workers gather/build) and **Verify** (reviewer pass checks against contract terms). This IS a judge-separate-from-author split.

**What's separated:** Author (Execute phase workers) vs. Judge (Verify phase reviewer). The reviewer consumes worker `evidence` fields and checks against contract terms — a separate context evaluating the work.

**What's NOT separated:** Within the Execute phase, a single worker agent does both research and judgment in one context. If a worker's task is "research market conditions and assess risk," it gathers and judges in the same pass. The worker result contract (outcome/evidence/decisions/failures_risks) separates fields but not context.

### Workflow built-in patterns — strong split in two of five

| Pattern | Gather separated from Judge? | Mechanism |
|---|---|---|
| `deep-research` | **Yes** | Multiple agents gather from different `angles` (default 4), each a separate context. Cross-checking requires `minSupport` (default 2 distinct sources). Synthesis happens after gathering, but in the orchestrator's context — not a fully separate judge. |
| `adversarial-review` | **Yes — strongest split** | First agent investigates the task/claim. Then `reviewers` (default N) independently cross-check each finding skeptically. The reviewer is a separate agent with a separate context whose job is to challenge, not to have gathered. This is the cleanest research/judge separation in the built-in set. |
| `code-review` | **Yes** | Multi-angle review (correctness, reuse, simplification, efficiency, altitude) — the reviewers didn't write the diff. Author and judge are different agents by construction. |
| `multi-perspective` | **Partial** | Parallel perspectives analyze independently (good — separate contexts), but synthesis happens in one context that must also judge. The synthesizer is also the judge. |
| `codebase-audit` | **Partial** | Parallel checks run independently, then cross-validate. The cross-validation is a judge step but may share context with the checks. |

### last30days SKILL — the principle is already encoded
The last30days skill has an explicit two-layer separation:
- **`<!-- EVIDENCE FOR SYNTHESIS -->`** block: raw evidence clusters, ranked, with uncertainty markers. LAW 6 says: "They are raw evidence for YOU to read, not output to emit." This is the gather layer.
- **`What I learned:`** synthesis: the model transforms evidence into judgment. This is the judge layer.

The skill enforces this structurally — it is a violation to dump evidence clusters as output. The evidence is gathered by the Python engine (deterministic), and the LLM's job is purely to judge/synthesize. This is architecturally the same principle: **deterministic gather → separate-context judge**.

### Worker result contract — field-level separation
The `outcome/evidence/changes/decisions/failures_risks/new_tasks` schema separates evidence (what was found) from decisions (what was concluded) at the field level. But it's still one agent in one context producing both.

---

## 3. Where it DOESN'T do the split — the gaps

### Gap 1: Worker agents do gather+judge in one context
The ce-lite contract loop's Execute phase fans out workers, but each worker is a single agent that both gathers and decides. For low-stakes work this is fine. For Investment-Engine (financial decisions), it's a structural risk: the worker that gathers market data is the same context that decides what the data means.

### Gap 2: deep-research synthesizes in the orchestrator context
The deep-research pattern gathers across angles (separate contexts) but the synthesis — which IS judgment — happens in the orchestrator's context, which has seen all the gathered material. It's better than single-pass (the gatherers were independent) but the judge isn't context-free.

### Gap 3: No model-tier separation for gather vs. judge
Model tiers are: small=mercury-2, medium=gemini-3-5-flash, big=kimi-k3. These tiers route by task complexity, not by gather-vs-judge role. A "medium" worker does both gathering and judgment at gemini-3-5-flash level. The Architect pattern from the token-efficiency post suggests: cheap model gathers, strong model judges. The tier system supports this but doesn't enforce it.

### Gap 4: last30days EVIDENCE→synthesis is skill-enforced but not harness-enforced
The separation in last30days depends on the LLM following LAW 6. The skill has extensive anti-violation scaffolding (the 0/8 regression horror stories), but it's prompt-level enforcement, not architectural. A workflow that consumed last30days output could re-pollute by feeding the raw evidence + synthesis into a single judge context.

---

## 4. The Architect+Orchestrators+Worker pattern — mapped to pi

From the token-efficiency post: Architect (small/cheap) creates brief → Orchestrators split into subtasks → Workers (cheap) gather → Judge (strong) evaluates.

### Pi implementation using model tiers + workflow script

| Role | Model tier | Context | Job |
|---|---|---|---|
| **Architect** | `small` (mercury-2) | Fresh, context-light | Read the question, output a research brief: sub-questions, sources to check, what evidence would confirm/deny |
| **Orchestrator** | (workflow script itself — no LLM needed) | N/A | Split brief into worker tasks, fan out via `parallel()` |
| **Workers** | `small` (mercury-2) | Each fresh | Gather raw evidence for one sub-question. Return evidence only — no conclusions |
| **Judge** | `big` (kimi-k3) | Fresh — receives only evidence packets, never the gatherers' contexts | Weigh evidence, identify conflicts, reach conclusion, flag uncertainty |

The key insight: the Judge's context contains ONLY structured evidence packets from workers — never the workers' full contexts, search paths, or intermediate reasoning. The judge is context-clean.

### Why this is token-efficient
- mercury-2 gathering is cheap — you can run 8 workers for the cost of 1 kimi-k3 pass
- kimi-k3's entire budget goes to reasoning over pre-gathered evidence, not retrieval
- The Architect (mercury-2) creates the brief for nearly nothing — it's just structuring the question

---

## 5. Investment-Engine: enforcing separation for financial decisions

Investment-Engine doesn't exist as a directory yet (conceptual/planned). This is the highest-stakes project: financial decisions need independent verification by construction, not by convention.

### The enforcement principle
**No agent that gathers market data may also decide portfolio action. No agent that decides portfolio action may also gather market data.** This must be architectural (workflow structure), not behavioral (prompt instructions).

### Concrete enforcement in a pi workflow

```
Phase 1: BRIEF (small model, fresh context)
  → Architect reads the investment question
  → Outputs: what data to gather, from where, what would support/oppose each possible action

Phase 2: GATHER (small model, parallel, each fresh context)  
  → Workers fetch market data per brief sub-task
  → Workers return EVIDENCE ONLY: prices, fundamentals, sentiment, signals
  → Workers are explicitly forbidden from returning recommendations
  → Worker result contract: outcome=what was gathered, evidence=raw data, decisions=[],
    failures_risks=data quality issues, payload_json=structured evidence

Phase 3: JUDGE (big model, fresh context — receives only Phase 2 evidence packets)
  → kimi-k3 receives structured evidence from all workers
  → Never sees worker contexts, search paths, or intermediate reasoning
  → Must: identify conflicting signals, weigh evidence, state confidence level
  → Must: produce a recommendation with explicit risk flags
  → Must: cite which evidence packets support/oppose the recommendation

Phase 4: VERIFY (medium or big model, fresh context — receives Judge's recommendation + original evidence)
  → Adversarial reviewer: "What would make this recommendation wrong?"
  → Checks: Did the judge ignore any evidence packet? Is confidence calibrated? Are risk flags adequate?
  → Pass/fail against contract terms
```

### What makes this enforced vs. convention
- **Workers literally cannot return decisions** — the workflow script can validate the `decisions` field is empty and reject/redo if not
- **Judge never sees worker contexts** — the script passes only `payload_json` (evidence packets), not full worker results
- **Verify is a separate agent** — not the judge re-checking itself
- **Each phase is a fresh `agent()` call** — no context carryover between phases

---

## 6. last30days hardening

The last30days skill already has the gather/judge split at the skill level (EVIDENCE FOR SYNTHESIS → What I learned). Hardening options:

### Current state (already good)
- Deterministic Python engine gathers evidence (not the LLM) — the LLM can't pollute the gather
- LAW 6 forbids emitting evidence clusters — the LLM must transform, not relay
- The `<!-- EVIDENCE FOR SYNTHESIS -->` / `<!-- END EVIDENCE FOR SYNTHESIS -->` boundaries are explicit

### Hardening for the harness layer
When last30days output is consumed by a workflow:
1. **Parse the EVIDENCE block separately** — extract evidence clusters as structured data, pass to a judge agent in a fresh context
2. **Don't pass the last30days synthesis to the judge** — the judge should form its own judgment from the raw evidence, then compare against the last30days synthesis as a secondary check
3. **This makes last30days a gather-only tool** in the workflow context — its built-in synthesis becomes a "first draft judgment" that the workflow's judge agent can accept, reject, or refine

The principle: last30days already separates gather from synthesize internally. When consumed by a workflow, treat its evidence output as gather and add a separate judge pass on top.

---

## 7. Concrete workflow script

Saved at: `/home/alex/Projects/pi-harness-config/workflows/saved/investment-gather-judge.json`

See the accompanying file. The script:
- Phase 1 (BRIEF): small model creates research brief from the investment question
- Phase 2 (GATHER): parallel small-model workers gather evidence per brief sub-task, evidence only
- Phase 3 (JUDGE): big model weighs evidence in fresh context, produces recommendation
- Phase 4 (VERIFY): medium model adversarially reviews the recommendation against evidence

Key enforcement: workers' `decisions` field must be empty (script validates). Judge receives only `payload_json` evidence packets, never worker contexts. Verify agent is separate from Judge.

---

## Summary: the split map

| Component | Gather separated? | Judge separated? | Gap |
|---|---|---|---|
| ce-lite routing (lookup vs contract) | ✅ Yes — lookup is pure gather | ✅ Yes — Verify is separate from Execute | Workers within Execute do gather+judge in one context |
| deep-research pattern | ✅ Yes — multiple angle agents | ⚠️ Partial — synthesis in orchestrator context | Judge isn't context-free |
| adversarial-review pattern | ✅ Yes — investigator gathers | ✅ Yes — reviewers are separate agents | Cleanest built-in split |
| last30days skill | ✅ Yes — deterministic engine gathers | ✅ Yes — LAW 6 enforces transform-not-relay | Skill-level enforcement, not architectural |
| Worker result contract | ⚠️ Field-level only | ⚠️ Same agent, same context | Fields separated, context isn't |
| Model tiers | ❌ Not role-based | ❌ Not role-based | Tiers route by complexity, not by gather/judge role |

**The one change with highest leverage:** add a workflow script (like the Investment-Engine one below) that makes gather and judge structurally separate agents in separate contexts, with the script enforcing that workers return evidence-only and the judge receives only evidence packets. For financial decisions, this isn't optimization — it's safety.
