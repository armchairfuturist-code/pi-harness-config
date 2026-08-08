# Harness Improvement Loop — Design Document

> Synthesized from: ETCLOVG harness engineering survey (8945_Agent_Harness_Engineering.pdf),
> 6 autoresearch finding sets (2026-07-14 → 2026-08-04), 6 wayfinder decision docs,
> 2 Last30Days community research files, and the Matt Pocock skill flow.

## 1. The Core Finding

**Every economy-pressure variant that improved token metrics broke quality canaries.**

This is the single most important pattern across all autoresearch:

| Study | Cheapest variant | Metrics | Quality | Verdict |
|---|---|---|---|---|
| CE-lite suite (iter1) | plan ≤5 bullets | −18% suite | FAIL (skipped discovery) | discard |
| CE-lite suite (D1) | doctrine consolidation | −37% output | FAIL (missing citation) | discard |
| Thinking economics | medium | −40% suite | FAIL t3-r2 | discard |
| Terseness campaign | tersest rule | cheapest | quality failure | discard |
| Prompt-quality rule | injected every-turn | +50% tokens | no improvement | discard |

**Implication:** Harness optimization without a canary gate is actively harmful. The loop's first
requirement is a measurement infrastructure that can detect quality regression, not just token
savings. The harness is a *coupled system* (ETCLOVG §3.3) — local optimizations cause global
regressions. Every change must be tested as a *system change*, not a component change.

## 2. The ETCLOVG Gap Analysis

The PDF's seven-layer taxonomy, mapped to your current harness state:

| Layer | What it governs | Your current state | Gap |
|---|---|---|---|
| **E**xecution | sandbox, tool runtime, process lifecycle | mature (ctx_shell, ctx_execute, workflow) | low |
| **T**ooling | tool schemas, composition, surface cost | measured (config-overhead: 4,016 tok floor, per-component attribution done) | **medium** — context-mode (1,757 tok) + workflows (627) + lean-ctx (616) = 2,997 tok of tool surface; no ablation proving each is load-bearing on real tasks |
| **C**ontext | what enters the window, when, in what order | partially measured (skills are lazy/0 tok, tscg saves 6,467, APPEND_SYSTEM tightened to 84 tok) | **high** — no context-lifecycle policy; no compaction trigger logic; no ordering optimization |
| **L**ifecycle | session birth, compaction, handoff, death | skills exist (/handoff, /compact) but no automated lifecycle policy | **high** — no smart-zone proximity detection; no auto-compaction at phase boundaries; session guardrail is a manual suggestion at 50/100 turns |
| **O**bservability | traces, cost attribution, failure detection | autoresearch instrumentation exists but is ad-hoc per study | **critical** — no persistent trace store; no continuous cost monitoring; every study rebuilds its own capture proxy |
| **V**erification | canary suites, regression tests, quality gates | CE-lite suite exists (suite/out/reqs/checks); config-overhead probe exists | **critical** — suites are not automated; no CI gate; canary contamination known (bench/probe.sh cache issue); no multi-turn simulation layer |
| **G**overnance | decision authority, change policy, drift control | wayfinder decisions documented; model routing practice exists | **medium** — live/repo drift unmeasured (rtk.ts, models.json 7.5KB vs 2.2KB); no change-review policy for harness modifications |

**The two critical gaps — Observability and Verification — are the binding constraint.** You cannot
improve what you cannot measure, and the PDF's central claim is that the observability-evaluation
gap must be closed into a *single feedback loop*. Your autoresearch has been doing this manually,
one study at a time. The loop automates it.

## 3. The Harness Improvement Loop (HIL)

A closed-loop OODA cycle that wraps the existing Matt Pocock skills with ETCLOVG-informed
measurement and verification. Each iteration is one full cycle.

```
┌─────────────────────────────────────────────────────────────────┐
│                    HARNESS IMPROVEMENT LOOP                      │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ OBSERVE  │───▶│ ORIENT   │───▶│ DECIDE   │───▶│  ACT     │  │
│  │ (O/V)    │    │ (O/V/G)  │    │ (G)      │    │ (skills) │  │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘  │
│       ▲                                               │        │
│       │              ┌──────────┐                     │        │
│       │              │  VERIFY  │◀────────────────────┘        │
│       │              │ (V gate) │                              │
│       │              └────┬─────┘                              │
│       │                   │ pass                               │
│       │              ┌────▼─────┐                              │
│       │              │ COMPOUND │                              │
│       │              │ (artifact)│                             │
│       │              └────┬─────┘                              │
│       └───────────────────┘                                    │
│                         (next iteration)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 1: OBSERVE (Observability + Verification layers)

**Goal:** Collect structured data about the harness's current performance.

**What runs:**
- `/system-health-check` (drift probes) — already exists
- **NEW: `hil/observe.sh`** — a persistent observation harness that:
  1. Runs the CE-lite canary suite (suite tokens, output tokens, requirements met, checks pass)
  2. Runs the config-overhead removal-probe battery (per-component cost attribution)
  3. Captures a trace: which tools were called, in what order, what each returned, how many tokens each consumed
  4. Records the smart-zone proximity: how many turns/tokens into the session, how much headroom remains
  5. Logs all results to `hil/traces/<timestamp>.json` — a persistent, append-only store

**Artifact:** `hil/traces/<timestamp>.json` — structured trace with cost, quality, and context-usage data.

**Key principle from the PDF:** Observability and verification are *one loop*, not two. The
observation phase *is* the baseline measurement; there is no separate "before" step.

### Phase 2: ORIENT (Observability + Verification + Governance)

**Goal:** Identify the highest-leverage improvement target, backed by evidence.

**What runs:**
- `/improve-codebase-architecture` — surfaces deepening opportunities (the existing survey)
- **NEW: `hil/orient.md`** — a structured analysis that cross-references:
  1. The latest trace against the historical trace baseline (is cost drifting up? is a canary newly failing?)
  2. The ETCLOVG gap analysis (which layer has the highest gap × leverage product?)
  3. The compound artifact store (what learnings from previous iterations suggest the next move?)
  4. The meta-monitoring ledger (which previously-applied interventions are still load-bearing? which have become overhead?)

**Artifact:** `hil/orientations/<timestamp>.md` — a ranked list of improvement candidates with evidence.

**Meta-monitoring (PDF §4.4):** This is where you detect *unnecessary overhead*. For each
component in the harness, ask: "If I removed this today, would the canary suite still pass?"
The config-overhead study already proved this works (15 packages probed, 9 are free, 3 are
tool-surface in daily use, 2 save tokens). The orient phase makes this *continuous*, not one-shot.

### Phase 3: DECIDE (Governance layer)

**Goal:** Select one improvement candidate and commit to a hypothesis.

**What runs:**
- `/grill-with-docs` — sharpen the idea against `CONTEXT.md` and ADRs
- **Decision gate (G):** The candidate must declare:
  1. **Hypothesis:** "Changing X will improve Y metric by Z% without breaking canary W"
  2. **Ablation plan:** "To verify, I will remove/toggle X and measure delta on suite/out/reqs/checks"
  3. **Reversal plan:** "If canary fails, revert via `<git command>`"
  4. **Layer mapping:** "This change targets ETCLOVG layer(s) ___ and may coupling-affect layer(s) ___"

**Artifact:** `hil/decisions/<timestamp>.md` — a decision record with hypothesis, ablation plan, and reversal plan.

**Key principle:** The PDF's harness coupling problem (§3.3) means every decision must declare its
*expected coupling effects*. A change to the Context layer (e.g., compacting APPEND_SYSTEM) may
affect the Tooling layer (tool schemas referenced by the prompt) or the Lifecycle layer (when
compaction triggers). The decision record forces this declaration upfront.

### Phase 4: ACT (Execution + Tooling layers)

**Goal:** Implement the change using the existing skill flow.

**What runs (single-session, if small):**
- `/implement` → drives `/tdd` (red-green slices) → `/code-review`

**What runs (multi-session, if large):**
- `/to-spec` → `/to-tickets` (blockers-first) → per ticket: fresh context → `/implement` → `/code-review`

**Key principle:** Each `/implement` starts fresh, working from the ticket. The decision record
from Phase 3 is the ticket's input. The grilling→spec→tickets chain (Phase 3 → Phase 4) stays in
one unbroken context window per the skill flow's context hygiene rule.

**Artifact:** A git diff (the change itself) + a commit referencing the decision record.

### Phase 5: VERIFY (Verification layer — the gate)

**Goal:** Reject changes that break quality, regardless of token savings.

**What runs:**
- **NEW: `hil/verify.sh`** — runs the same canary suite from Phase 1 against the modified harness:
  1. CE-lite suite (suite/out/reqs/checks) — must pass all checks
  2. Config-overhead probe — measure delta (did the change actually save tokens?)
  3. **Multi-turn simulation** (PDF §4.3, layer 3) — a 3-5 turn simulated task to catch coupling
     regressions that single-turn tests miss (e.g., context compaction losing critical state)
  4. **Ablation check** — if the change removed a component, verify the canary still passes without it

**Gate logic:**
```
IF checks FAIL → revert, record negative result in compound store, return to ORIENT
IF checks PASS AND tokens improved → promote to live, record positive result
IF checks PASS AND tokens unchanged → record as "quality-neutral", promote if it simplifies
IF checks PASS AND tokens WORSENED → record as "quality-positive cost", promote if quality gain justifies
```

**This is the gate that prevents the pattern in §1.** Every autoresearch study found that
cheapest-metric variants failed canaries. The verify phase makes this rejection *automatic*.

**Artifact:** `hil/verifications/<timestamp>.json` — structured pass/fail with metrics delta.

### Phase 6: COMPOUND (Governance layer — the memory)

**Goal:** Accumulate learnings across iterations so each cycle starts smarter.

**What runs:**
- **NEW: `hil/ledger.md`** — a structured append-only ledger that records:
  1. **What was tried** (hypothesis, change, ETCLOVG layer)
  2. **What happened** (metrics delta, canary pass/fail, coupling effects observed)
  3. **What was learned** (one-sentence distillation)
  4. **Meta-monitoring entry** (is this intervention still load-bearing? when to re-check?)

**The ledger is the compound artifact.** It replaces the ad-hoc findings.md files scattered across
autoresearch dirs with a single, queryable, structured store. Each new iteration's ORIENT phase
reads the ledger to avoid re-trying discarded experiments and to identify interventions whose
load-bearing status may have changed.

**Artifact:** Updated `hil/ledger.md` + updated `hil/meta-monitoring.md` (intervention status table).

## 4. Per-Layer Sub-Loops

The HIL is the outer loop. Each ETCLOVG layer has its own inner loop with layer-specific canaries.

### 4.1 Execution Layer Loop
- **Observe:** tool call latency, failure rate, timeout frequency
- **Canary:** does a standard task complete within N seconds with zero tool failures?
- **Typical improvement:** sandbox tuning, timeout adjustment, process reuse
- **Current gap:** low — this layer is mature

### 4.2 Tooling Layer Loop
- **Observe:** per-tool surface cost (removal-probe attribution), tool call frequency, tool result size
- **Canary:** does the canary suite pass with tool X removed? with tool X's schema trimmed?
- **Typical improvement:** schema compression, tool merging, lazy tool loading
- **Current evidence:** context-mode (1,757 tok), workflows (627), lean-ctx (616) are the top surface costs. But the config-overhead study noted "checks pass ≠ safe to remove" — the bench workload doesn't exercise ctx tools. **The canary needs a task that actually uses ctx tools.**
- **Key action:** Build a ctx-tool-exercising canary before attempting tool removal.

### 4.3 Context Layer Loop
- **Observe:** what enters the window, in what order, how much of it is read vs skipped
- **Canary:** does the canary suite pass with context component X removed/reordered?
- **Typical improvement:** prompt compression, ordering optimization, progressive disclosure tuning
- **Current evidence:** tscg saves 6,467 tok (most load-bearing component); skills are 0 tok (lazy); APPEND_SYSTEM is 84 tok. The context layer is already lean at the *entry* point.
- **Key gap:** no context *lifecycle* policy — when does context get compacted, what survives compaction, what order is optimal? This is the highest-leverage unexplored surface.

### 4.4 Lifecycle Layer Loop
- **Observe:** session length distribution, compaction frequency, handoff frequency, smart-zone proximity at task completion
- **Canary:** does a multi-turn task (5+ turns) complete without smart-zone degradation?
- **Typical improvement:** auto-compaction triggers, smart-zone proximity detection, phase-boundary detection
- **Current evidence:** session guardrail is manual (suggest /handoff at 50/100 turns). No automated detection of smart-zone proximity (~120k tokens).
- **Key action:** Build a smart-zone proximity monitor that emits a warning at configurable thresholds. This is a pi extension, not a skill.

### 4.5 Observability Layer Loop (meta — it improves itself)
- **Observe:** trace coverage (% of sessions with traces), trace completeness, cost of tracing itself
- **Canary:** does the trace store answer "what changed and why?" for the last N iterations?
- **Typical improvement:** trace compression, selective tracing, trace-to-ledger auto-extraction
- **Current gap:** critical — no persistent trace store exists. Every autoresearch study rebuilt its own capture proxy. **This is the first thing to build.**

### 4.6 Verification Layer Loop (meta — it improves itself)
- **Observe:** canary suite coverage, false-positive rate, canary contamination incidents
- **Canary:** does the canary suite detect a known-injected regression?
- **Typical improvement:** new canary tasks, canary diversification, contamination prevention
- **Current evidence:** bench/probe.sh has a known cache-contamination issue (warm prefix false-greens regressions). The CE-lite suite has 4 canary tasks. No multi-turn simulation layer.
- **Key action:** Fix the contamination issue first. Then add multi-turn simulation canaries.

### 4.7 Governance Layer Loop
- **Observe:** drift between live and repo, decision-to-implementation lag, reversal frequency
- **Canary:** does `git diff` between live and repo show only intended changes?
- **Typical improvement:** drift detection automation, change-review policy, ADR generation
- **Current evidence:** rtk.ts drift (unmeasured), models.json drift (7.5KB live vs 2.2KB repo).
- **Key action:** Automate drift detection as part of `/system-health-check`.

## 5. The Measurement Infrastructure (Build First)

Before the loop can run, three pieces of infrastructure must exist. They are the **fixtures**, not
the deliverables — the loop produces improvements, but it needs these to measure them.

### 5.1 Persistent Trace Store (`hil/traces/`)

```json
{
  "timestamp": "2026-08-07T20:30:00Z",
  "iteration": 0,
  "phase": "observe",
  "canary_suite": {
    "suite_tokens": 135906,
    "output_tokens": 9769,
    "requirements_met": 46,
    "checks_pass": true
  },
  "config_overhead": {
    "total_floor": 4016,
    "per_component": { "context-mode": 1757, "workflows": 627, ... }
  },
  "context_usage": {
    "turn": 12,
    "tokens_used": 45000,
    "smart_zone_proximity": 0.375,
    "headroom_tokens": 75000
  },
  "tool_calls": [
    { "tool": "ctx_search", "tokens_in": 1200, "tokens_out": 800, "latency_ms": 340 },
    ...
  ]
}
```

### 5.2 Canary Suite (`hil/canaries/`)

Four types, per the PDF's layered evaluation (§4.3):

| Level | What it tests | Example |
|---|---|---|
| **Unit-like** | single tool, single call | "ctx_search returns relevant results for query X" |
| **Single-step** | one task, one turn | "read a file and summarize" (the current CE-lite suite) |
| **Full-rollout** | complete task, multiple tools | "implement a feature TDD-style" |
| **Multi-turn** | 3-5 turn simulation | "diagnose a bug across multiple files" — catches context-lifecycle regressions |

The **multi-turn** level is the one you don't have yet, and it's the one that would have caught
the coupling regressions in the autoresearch studies (e.g., economy pressure causing skipped
discovery → legacy values only manifests across turns).

### 5.3 Compound Ledger (`hil/ledger.md`)

```markdown
## Iteration 0 — 2026-08-07 — Baseline
- **Hypothesis:** N/A (baseline measurement)
- **Change:** N/A
- **Metrics:** suite=135,906 out=9,769 reqs=46 checks=pass
- **Learning:** Live ce-lite is the phrasing frontier; economy pressure breaks canaries.
- **Meta-monitoring:** N/A (baseline)

## Iteration 1 — [date] — [hypothesis]
- **Hypothesis:** [what we expect]
- **Change:** [what we did, ETCLOVG layer]
- **Metrics:** [before → after delta]
- **Canary:** [pass/fail]
- **Learning:** [one sentence]
- **Meta-monitoring:** [is this still load-bearing? re-check date]
- **Coupling effects:** [observed cross-layer impacts]
```

## 6. Cross-Session Orchestration

The loop is designed to run over weeks/months. Each iteration may span 1-3 sessions.

### Session boundaries

| Phase | Sessions | Context strategy |
|---|---|---|
| OBSERVE + ORIENT | 1 session | fresh context, reads ledger + traces |
| DECIDE (grill) | 1 session | `/grill-with-docs` — stateful, writes to CONTEXT.md |
| DECIDE → ACT (if small) | same session as grill | keep unbroken |
| DECIDE → ACT (if large) | `/handoff` after `/to-tickets`, then `/implement` per ticket in fresh contexts | |
| VERIFY | 1 session | fresh context, runs `hil/verify.sh` |
| COMPOUND | 0.5 session | updates ledger, can be merged with VERIFY |

### Smart-zone management

- OBSERVE + ORIENT should be a *fresh* session (it reads structured data, doesn't need conversation history)
- DECIDE (grill) is the stateful phase — keep it unbroken until `/to-tickets`
- Each `/implement` is fresh per the skill flow
- If any session approaches ~100k tokens, `/handoff` immediately

### Frequency

- **Fast loop** (Tooling/Context layers): 1 iteration per session, daily or as time permits
- **Slow loop** (Lifecycle/Governance layers): 1 iteration per week — these are structural changes
- **Meta loop** (Observability/Verification): continuous — every iteration improves the measurement itself

## 7. The Meta-Monitoring Sub-Loop

The PDF's most novel contribution (§4.4): a layer that *tracks which interventions are still
load-bearing* and flags those that have become unnecessary overhead.

This runs as a periodic sub-loop within the HIL:

```
For each entry in hil/meta-monitoring.md:
  1. Check: has the model been upgraded since this intervention was applied?
     → If yes, the intervention may no longer be needed (model may handle it natively)
  2. Run ablation: remove the intervention temporarily, run canary suite
  3. If canary still passes → intervention is now overhead → candidate for removal
  4. If canary fails → intervention still load-bearing → update re-check date
```

**The meta-monitoring ledger:**

```markdown
| Intervention | Applied | Layer | Last checked | Status | Re-check after |
|---|---|---|---|---|---|
| tscg compression | 2026-07-14 | C | 2026-07-28 | load-bearing (saves 6,467) | next model upgrade |
| pi-slim | 2026-07-14 | C | 2026-07-28 | load-bearing (saves 323) | next model upgrade |
| APPEND_SYSTEM tightening | 2026-07-28 | C | 2026-07-28 | load-bearing (saves 9) | 2026-09-01 |
| context-mode tools | pre-2026 | T | 2026-07-28 | untested on ctx-using canary | after ctx canary built |
| thinking=high | 2026-07-30 | E | 2026-07-30 | load-bearing (medium fails t3-r2) | next model upgrade |
| CE-lite overlay doctrine | pre-2026 | C | 2026-07-30 | load-bearing (economy pressure breaks canaries) | next model upgrade |
```

**When to trigger meta-monitoring:**
1. After every model upgrade (the model may now handle something the harness was compensating for)
2. Monthly as a routine sweep
3. When the config-overhead probe shows drift from the last baseline

## 8. Integration with Existing Skills

The HIL doesn't replace the Matt Pocock skills — it *wraps* them with measurement and verification.

| HIL Phase | Matt Pocock Skill | What HIL adds |
|---|---|---|
| OBSERVE | `/system-health-check` | persistent trace store, canary suite automation |
| ORIENT | `/improve-codebase-architecture` | ETCLOVG gap analysis, meta-monitoring ledger, historical trace comparison |
| DECIDE | `/grill-with-docs` | hypothesis/ablation/reversal/coupling declaration in the decision record |
| ACT | `/to-spec` → `/to-tickets` → `/implement` → `/tdd` → `/code-review` | nothing — this phase is pure skill flow |
| VERIFY | (new) | automated canary gate with pass/fail/revert logic |
| COMPOUND | (new) | structured ledger replacing ad-hoc findings.md files |

**The skills are the ACT phase.** The HIL's value is in the phases *around* the skills: measuring
before (OBSERVE), choosing wisely (ORIENT), declaring hypotheses (DECIDE), gating quality
(VERIFY), and accumulating knowledge (COMPOUND).

## 9. Concrete First Iterations

Based on the gap analysis, the first three iterations in priority order:

### Iteration 0: Build the measurement infrastructure (no change to harness)
- Build `hil/observe.sh` (canary suite runner + trace capture)
- Build `hil/verify.sh` (canary gate)
- Build `hil/canaries/` (port the CE-lite suite + add a ctx-tool-exercising canary + add a multi-turn canary)
- Initialize `hil/ledger.md` with baseline measurements
- Initialize `hil/meta-monitoring.md` with all known interventions
- **Gate:** can the infrastructure reproduce the existing autoresearch baselines?

### Iteration 1: Fix known verification gaps (Verification layer)
- Fix bench/probe.sh cache contamination (route through capture proxy or gate cold-only)
- Sync models.json drift (live 7.5KB → repo 2.2KB)
- Resolve rtk.ts drift (adopt into repo or drop from live)
- **Gate:** does `hil/verify.sh` now produce deterministic, reproducible results?

### Iteration 2: Build the ctx-tool canary + first ablation (Tooling layer)
- Build a canary task that actually exercises ctx_search, ctx_read, ctx_index, ctx_grep
- Run removal probes for context-mode (1,757 tok), workflows (627), lean-ctx (616) against the ctx-using canary
- **Decision:** are any of these removable on real tasks? (The config-overhead study couldn't answer this because the bench didn't use ctx tools.)
- **Gate:** does the canary suite pass with the candidate removal?

### Iteration 3+: Context lifecycle policy (Context/Lifecycle layers)
- The highest-leverage unexplored surface: when to compact, what survives, what order
- Build a multi-turn canary that specifically tests compaction behavior
- Experiment with compaction triggers (turn count, token count, phase boundary detection)
- **Gate:** does the multi-turn canary pass with the new compaction policy?

## 10. Summary: Why This Loop Works

1. **It closes the observability-evaluation gap** (PDF's central claim) — observe and verify are
   one loop, not separate concerns.

2. **It prevents the economy-pressure trap** (autoresearch's consistent finding) — the verify gate
   rejects any change that breaks canaries, regardless of token savings.

3. **It manages the harness coupling problem** (PDF §3.3) — every decision declares expected
   coupling effects, and the multi-turn canary catches cross-layer regressions.

4. **It compounds knowledge** (wayfinder's compound engineering principle) — the ledger replaces
   scattered findings.md files with a single queryable store that each iteration reads.

5. **It self-simplifies** (PDF §4.4 meta-monitoring) — the meta-monitoring sub-loop detects when
   interventions become unnecessary overhead, especially after model upgrades.

6. **It uses existing skills** — the ACT phase is pure Matt Pocock flow; the HIL only adds the
   measurement and governance phases around it.

7. **It's cross-session safe** — each phase has a clear context strategy (fresh vs. stateful), and
   the structured artifacts (traces, ledger, decision records) carry context across session
   boundaries without compacting conversation history.

The loop's cadence: **observe → orient → decide → act → verify → compound → observe**. Each cycle
leaves the harness measured, the ledger updated, and the next target identified.
