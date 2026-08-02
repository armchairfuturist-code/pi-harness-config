---
name: action-context-axes
description: "Diagnose a task against two independent complexity axes — action (tools/decisions/handoffs) and context (info to gather/retain/retrieve) — then pick the harness optimization that matches the binding axis instead of applying every technique uniformly. Source: Hugo Bowne-Anderson, 'Stop Overengineering Your Agent Harness' (Vanishing Gradients, 2026-07-21)."
---

# Action-Complexity vs. Context-Complexity — Two Independent Axes

## The framework (Bowne-Anderson)

Two kinds of complexity move **independently**:

- **Action complexity** — how many tools, decisions, dependencies, and handoffs the agent must coordinate.
- **Context complexity** — how much information the agent must gather, retain, and retrieve to complete the task.

> "A support agent may complete a conversation in one turn while still routing across several tools and safety checks. A deep-research agent may receive only one user request while accumulating a large body of source material."

The mistake the article names: ask "what techniques do I need?" and the average answer becomes a long list (context management, memory, compaction, sub-agents, hooks, orchestration). Few systems need all of it. Map the job first, then add infrastructure **only when a real failure demands it** — and revisit whenever a stronger model arrives ("Kirby effect": yesterday's necessary workaround becomes tomorrow's dead weight).

### Lance Martin's three context-engineering moves (cited in the article)
- **Reduce** — actively shrink the context passed to the model.
- **Offload** — move information and complexity out of the prompt (to files, DB, tool results).
- **Isolate** — use multi-agent architectures to delegate token-heavy sub-tasks.

### The diagnosis question
Before reaching for compaction, memory, handoffs, or sub-agents: *how many actions must the agent coordinate, and how much context must it carry across the task?* If both are low → keep the harness small.

---

## The 2×2 — quadrants and which pi optimization leads

```
                    CONTEXT  low ──────────────── high
ACTION  high   │  Q2  Support/Routing       │  Q4  Deep-research / novel-writing
               │  lead: subagent fan-out,   │  lead: BOTH — isolate subagents w/
               │  bounded tool access,      │  separate context budgets + ctx_index/
               │  skill routing, guardrails │  ctx_search + compaction
               ├────────────────────────────┼────────────────────────────────────
ACTION  low    │  Q1  One-shot / landing     │  Q3  Deep-research (read-only)
               │  lead: direct edit,         │  lead: ctx_index/ctx_search,
               │  minimal harness            │  compaction, proactive handoff
```

### Per-quadrant pi levers

**Q1 — low action / low context** (landing pages, one-shot edits, simple Q&A)
- Direct answer or single edit. No contract loop, no subagents, no ctx_index.
- ce-lite "simple" route. Keep it that way — the danger is over-wrapping these in ceremony.

**Q2 — high action / low context** (support routing, MCP tool orchestration, build/deploy pipelines)
- Subagent fan-out via `workflow` (parallel/pipeline). Bounded tool access per worker.
- Skill routing, guardrails, deterministic pre-checks, explicit handoffs.
- Context management is a non-issue — do NOT spend tokens on compaction here.
- Bowne's Maven Assistant lives here: ~15-20 tools across domain sub-agents, user ID injected (not model-provided), deterministic guardrails, human handoff triggers.

**Q3 — low action / high context** (read-only research, narrative recall, doc synthesis)
- `ctx_index` the source material; `ctx_search` to retrieve only what each step needs (Reduce + Offload).
- Proactive handoff BEFORE context degrades (ce-lite's context-health protocol), compaction as fallback.
- One model call with good retrieval beats a fan-out here — fan-out adds action complexity the task doesn't have.

**Q4 — high action / high context** (deep research with citation, multi-agent novel debate)
- Isolate: subagents each get a separate query + iteration budget + **independent context window**, then findings return to the main agent for synthesis.
- Hooks/traces without bloating the core loop. The article's deep-research build (w/ Ivan Leo) is the template: plan → concurrent search sub-agents → synthesize + cite.
- ctx_index the accumulated evidence; main agent retrieves summaries, not raw sources.

---

## This user's portfolio on the 2×2

| Project | Action | Context | Quadrant | Evidence |
|---|---|---|---|---|
| **Investment-Engine** (Python MCP server) | **High** | **Med** | Q2 (border Q4) | MCP = broad tool surface; investment decisions + data-source dependencies. Context is bounded by portfolio/position state, not unbounded research — unless running scenario analysis, then it slides to Q4. |
| **bio-orchestrator** (Streamlit + MCP) | **Med** | **High** | Q3 (border Q4) | Large biomedical KBs (compound_db, bloodwork, dna_markers); auth + Streamlit UI add some action. The binding constraint is retaining/intersecting domain knowledge, not tool count. |
| **novel-writer-harness** (CLI) | **Med-High** | **High** | **Q4** | `agents/`, `pipeline/`, `interview/`, `multiagentdebate.md`, `reference/` — multi-agent debate + long narrative state (character continuity, plot threads, style). Both axes genuinely high. |
| **FALA** (CLI, audio + conversation) | **Med** | **Med** | Q1/Q2 border | 61 files; conversation + progress + prompts. Conversational state is bounded; audio I/O adds a little action. Mostly keep-small. |
| **ArmchairFuturistLanding** (Next.js) | **Low** | **Low** | **Q1** | Landing site; build + components + audit. Direct edits, minimal harness. |
| **mindscape-site** (Next.js) | **Low-Med** | **Low** | Q1/Q2 | Site + autoresearch harness; slightly more action (audit scripts) but little retained context. |

### Read of the portfolio
The user's work spans **three** quadrants, not one. Two projects (novel-writer, bio-orchestrator) are **context-bound**; one (Investment-Engine) is **action-bound**; the Next.js sites are **low-both**. A single default optimization — which is what the current harness effectively does — is wrong for at least two of the three buckets.

---

## Is ce-lite already axis-aware? — No, it conflates them

ce-lite's four routes are keyed to **task shape**, not to the action/context axes:

| ce-lite route | Axis it *implies* | Problem |
|---|---|---|
| **Simple** | low both | ✅ Correct — no ceremony. |
| **Lookup** | high-context / low-action | ⚠️ Bundles all lookups into the research path regardless of whether context is actually the binding constraint; a high-action lookup (coordinate many sources + handoffs) gets the same treatment as a single-URL fetch. |
| **Non-trivial** | **catch-all** | ❌ The core conflation. High-action, high-context, and both-high all enter the *same* contract loop whose default execution lever is **workflow fan-out** — an *action-complexity* optimization. A context-bound task (novel-writer continuity, bio-orchestrator KB intersection) gets subagents when what it needs is `ctx_index`/compaction/proactive handoff. |
| **Loop-shaped** | action (iterate) | ⚠️ pi-autoresearch (measure/keep/discard) optimizes the *iteration*, not the *context carried per iteration* — a context-bound loop still degrades without handoff. |

The **context-health** section *does* address the context axis — but **reactively** (trips at ~60% usage, re-reading files, losing a thread). It is a safety net, not a diagnosis. By the time it fires, the wrong lever (fan-out) has often already been applied.

**Net:** ce-lite optimizes action well and context reactively. It does not *diagnose which axis a task fails on* before choosing the lever — which is exactly what Bowne's framework prescribes.

---

## Concrete recommendations

### A. Add an axis-diagnosis step to the contract loop (one cheap addition)

Insert **after** "Grill" and **before** "Execute", a single classification:

> *Is the binding constraint on this task **action** (many tools/decisions/handoffs) or **context** (much to gather/retain/retrieve)?*

Then route the Execute lever:
- **Context-bound** → lead with `ctx_index` + `ctx_search` + proactive handoff; use fan-out **only** to isolate token-heavy sub-tasks (Isolate), not to parallelize actions.
- **Action-bound** → lead with `workflow` fan-out (parallel/pipeline) + bounded tool access per worker; skip compaction entirely.
- **Both** → deep-research pattern: isolated subagents with separate context budgets, evidence to ctx_index, main agent synthesizes from summaries.
- **Neither** → direct, no loop (already handled by "simple").

This is a ~4-line addition to SKILL.md, not new infrastructure — and it directly implements Bowne's "map the job on two axes before reaching for techniques."

### B. Per-project lead lever

| Project | Lead with | Don't waste tokens on |
|---|---|---|
| **Investment-Engine** | Subagent fan-out for tool coordination; bounded tool access per MCP domain; guardrails on trade-decision tools. For scenario analysis, switch to Q4 isolation. | Heavy compaction — portfolio state is bounded; ctx_index the decision log, not the market data stream. |
| **bio-orchestrator** | `ctx_index` the KBs (compound_db, bloodwork, dna_markers); `ctx_search` per query; proactive handoff. Fan-out only to *isolate* a heavy retrieval, not to parallelize actions. | Wide tool fan-out — the constraint is intersecting domain knowledge, not calling many tools. |
| **novel-writer-harness** | Q4: isolated debate subagents each with their own context window; `ctx_index` character/plot/style state; main agent synthesizes, retrieving *summaries* not raw chapters. | Single-threaded reasoning over full narrative — that's the context-rot failure mode. |
| **FALA** | Keep small: direct conversation loop, progress in a file. | Subagents, compaction. |
| **Next.js sites** | Direct edits; audit via a single `workflow` run, not a standing harness. | ctx_index, memory, handoff. |

### C. Revisit on model swap
Bowne's Kirby effect applies directly: the user swaps models often (per ce-lite's handoff protocol). Each swap is a chance to delete a workaround. Add to the model-note in handoffs: *"which harness levers this model made redundant this session"* — so dead weight gets pruned, not just accumulated.

---

## Source
Hugo Bowne-Anderson, "Stop Overengineering Your Agent Harness," *Vanishing Gradients* (Substack), 2026-07-21.
URL: https://hugobowne.substack.com/p/stop-overengineering-your-agent-harness
Key cited work: Lance Martin (3 context-engineering patterns: Reduce/Offload/Isolate); Ivan Leo deep-research build (Manus → Google DeepMind); William Horton / Maven Clinic Maven Assistant (low-context/high-action case).
