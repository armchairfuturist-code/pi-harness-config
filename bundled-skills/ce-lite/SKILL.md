---
name: ce-lite
description: "Non-trivial work router: grill, contract, plan, execute, verify, compound. Trivial requests answered directly."
---

# CE-lite

## Route selection

1. **Lookup** — answer from memory or existing artifacts without new work.
2. **Simple** — single-step, unambiguous, low-consequence: answer directly; skip the contract loop.
3. **Contract** — multi-step, ambiguous, deliverable-shaped, externally consequential, or profile-required: run the contract loop.

Overlays: Engineering profile (add TDD, code review, preflight); research profile (add deep search); audit profile (add adversarial review). Profile requirements take precedence over Simple.

Completion: every request has one base route plus every applicable overlay.

## Contract loop

1. **Grill** — resolve blockers one at a time; state a reasonable default and proceed when one exists.
   *Done*: objective, constraints, in/out boundaries, and irreversible choices each stated; no unanswered question prevents a checkable contract.

2. **Contract** — assign every acceptance term a short ID and observable pass condition. Keep small contracts in chat; use the profile's work-state artifact when required.
   *Done*: each requested outcome and material constraint maps to exactly one term with a yes/no test.

3. **Plan** — shortest execution path; discovery before mutation; name the evidence source for each term.
   *Done*: every term ID maps to an execution step or existing evidence source.

4. **Diagnose axes** — classify action and context complexity:

   | Context high | Action high | Topology |
   |---|---|---|
   | yes | — | index/search, selective reading, proactive handoff |
   | — | yes | workflow fan-out |
   | yes | yes | isolated workers with separate context budgets + indexing/compaction |
   | — | — | direct execution |

   Invoke a workflow when: two or more independent workstreams can run concurrently; a fresh-context reviewer/judge is required; or work crosses a handoff boundary. Otherwise execute directly.

5. **Execute** — route mechanical leaves to `small`, workers/reviewers to `medium`, hard synthesis to `big`. Use custom `agent()`/`parallel()`/`phase()` graphs only after reading `workflow-authoring`. Keep intermediate material in workflow variables.
   *Done*: every worker returns the six-field result contract (see `reference.md`); changed paths remain in scope.

6. **Verify** — maintain one evidence matrix: term ID, current evidence, pass/fail. Give the complete matrix and deliverable to a reviewer. Fix failed terms and repeat affected checks.
   For judgment over gathered evidence, run gather-judge (see `gather-judge.md`).
   *Done*: every term row says pass and cites current evidence; unresolved risks named and reported as incomplete or qualified.

7. **Deliver and compound** — report outcome against terms, artifact paths, verification status, surviving risks. Save reusable patterns, gotchas, preferences, and durable decisions to the knowledge store or project record.
   *Done*: operator can locate every deliverable, see whether all terms passed, identify each residual risk; omit categories with no content.

## Operating rules

- Effort proportional to consequence and uncertainty.
- Show answers, blocker questions, terms, short plan, progress, findings, evidence. Keep routing vocabulary and worker transcripts internal.
- Batch independent tool calls. Resume journaled work instead of repeating completed calls.
- Route side questions to the side thread so the active contract remains intact.
- Before non-trivial decisions in a familiar area, search session summaries and the knowledge store, then read relevant ADRs/context docs, wayfinder decisions, and open tickets. State and record reversals.
- Give work one home: tracker tickets for session-spanning tasks; workflow journals for within-session fan-out.
- Load specialist references only when their branch applies: implementation, TDD, research, debugging, code review, domain modeling, specification, handoff, workflow authoring, workflow patterns.

## Context health

Hand off while context is healthy when: a journaled workflow completes three phases with more remaining; context reaches ~28% with rot score >=70 or 40% hard ceiling; the model changes; reasoning drifts; or two tool errors occur within five turns.

Write `.scratch/HANDOFF.md` per `context-health.md`. Consolidate memory first after memory-heavy work. Resume from the handoff and `resumeFromRunId`.

*Done*: handoff names one immediate next action and references enough current evidence for a fresh context to continue without rediscovery.
