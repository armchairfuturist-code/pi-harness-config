---
name: graph-engineering
description: Agent→agent graph topologies for the pi coding agent. Maps the "graph engineering" discourse (calebwritescode, open-multi-agent, awesome-harness-engineering) onto pi's concrete primitives — agent/parallel/pipeline/workflow + SharedStore + loopUntilDry/gate — and identifies which topologies add value beyond pipeline/parallel. Read when designing multi-agent topologies, deciding whether a fan-out is enough or a real DAG/loop is needed, or mapping a project to an agent graph.
metadata:
  version: "1.0.0"
---

# Graph engineering for pi

## Quick Start

The fastest way to see the three additive primitives in action is the
**review-fix-graph** workflow — a reusable code-review + fix loop that is not
tied to any specific project:

`~/Projects/pi-harness-config/workflows/saved/review-fix-graph.js`

```js
workflow({
  script: require("fs").readFileSync(
    "/home/alex/Projects/pi-harness-config/workflows/saved/review-fix-graph.js",
    "utf8"
  ),
  args: { target: "src/auth/", maxIterations: 3 }
})
```

What it demonstrates (and where in the file):

| Primitive | Where | What it does |
| --- | --- | --- |
| **SharedStore** | Every node uses `store_put`/`store_get` | Reviewer writes `issues:review`, scanner writes `issues:security`, fixer writes `fix:latest`. Non-adjacent nodes (report ↔ reviewer) share state without piping. |
| **Fan-in** | `parallel([reviewer, scanner])` → fixer | The fixer depends on TWO parallel upstreams. The `parallel()` barrier is the fan-in; the fixer reads both issue lists from the store. |
| **Cycle (gate)** | `gate(fixer, reReview, {attempts})` | Fixer → re-review → back to fixer with feedback until `ok=true` or iterations exhausted. The back-edge. |

The topology (annotated in the file header):

```
  ┌───────────────┐        ┌────────────────────┐
  │  reviewer (A) │        │  security-scan (B) │   ← parallel fan-out
  └───────┬───────┘        └─────────┬──────────┘
          │                           │
          ▼                           ▼
     ════════════════ fan-in ════════════════
                     │
                     ▼
            ┌─────────────────┐
      ┌────►│     fixer       │  reads issues:* from store
      │     └────────┬────────┘
      │              ▼
      │     ┌─────────────────┐
      │     │  re-review      │  reads fix:latest + issues:*
      │     │  (verifier)     │
      │     └────────┬────────┘
      │     ok=false │ ok=true
      └──────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │     report      │  reads entire store
            └─────────────────┘
```

**Args:** `target` (file path / glob / description — default: cwd),
`maxIterations` (gate attempts — default: 3, max: 5).

**When to use this pattern:** any "review → fix → re-review until clean" loop
where multiple independent reviewers (code quality, security, performance, …)
fan out in parallel and a fixer must address all of their findings in a cycle.
Swap the two scanner prompts for your own review lenses; the graph stays the same.

## What "graph engineering" actually means

Source signal: @calebwritescode (TikTok, Jul 31 2026) frames it as the new
focus once the *node* (a single coding agent) stops being brittle. With Claude
Code, Codex CLI, Antigravity, and Pi, one agent now reliably completes a unit
of work. The remaining leverage is the **edges**: the topology that connects
agents and the shared-state contract between them.

Concretely, graph engineering = designing, for a given job:

1. **Nodes** — what each agent is responsible for (one agent = one node).
2. **Edges** — the data-flow dependencies between nodes (who reads whose output).
3. **Shared state** — the blackboard nodes read/write in common.
4. **Control flow** — branching, cycles, convergence/termination conditions.
5. **Allocation** — which model tier runs which node, concurrency bounds.

The open-multi-agent tagline — *"describe the goal, not the graph"* — is the
ambition that a planner agent emits the DAG at runtime. In pi the topology is
authored in JavaScript, but a planning agent can emit a plan the script then
executes (see "Runtime-planned DAG" below).

## How pi's primitives map to graph shapes

| pi primitive | Graph shape | What it is / is not |
| --- | --- | --- |
| `agent()` | a single node | One unit of work. The atom. |
| `pipeline(items…, stages)` | a **path graph** (linear chain) | Fixed order; stage N+1 sees only stage N's output. No branching, no cycles, no shared state between non-adjacent stages. |
| `parallel(thunks)` | a **fork-join / star** | Independent leaves, barrier at collection. Leaves cannot depend on each other — except indirectly via the SharedStore. |
| `subagent` tool | 1:1 delegation (one node → one child session) | Spawns a background pi session. Not itself a topology; the child can host its own graph. |
| `workflow(savedName)` | a **nested subgraph** that *inherits the parent SharedStore* | This is the hierarchical-delegation primitive. Parent and nested-run agents share state. |
| `verify` / `judgePanel` | a **review subgraph** (do → panel → verdict) | Convergence via voting. |
| `gate(thunk, validator)` | a **cycle with a convergence condition** | Re-runs the thunk, feeding validator feedback back in, until `ok` or attempts exhausted. *This is a back-edge.* |
| `loopUntilDry` | a **drain loop** (self-edge until empty) | Keeps producing until a round yields nothing new. |
| `retry` | an edge-retry on one node | Hides transient node failure. |
| SharedStore (`store_put`/`store_get`) | the **shared blackboard** | MCP tools injected into *every* agent in the run. Key-value, last-write-wins per key, delta-journaled so resume replays parallel writes correctly. Scoped to one run; nested runs inherit it. |

### The key realization

`pipeline` and `parallel` are **two restricted graph shapes** (a path and a
star). The moment you need any of these, you are doing graph engineering and
they are not enough:

- a node that depends on *two* upstream nodes (fan-in, not just fan-out),
- a node that reads state from a non-adjacent node (skip-connection edge),
- a cycle (revise-until-good),
- shared mutable state all nodes can read and write,
- a topology decided at runtime from the goal.

pi already has every primitive to express these — they are just not `pipeline`
or `parallel` alone. You compose `agent()` + `parallel()` + the SharedStore +
`gate`/`loopUntilDry` + nested `workflow()` in plain JavaScript, and the script
*is* the graph.

## Topologies in the discourse, and how to get each in pi

### 1. DAG with shared state (the workhorse)
The dominant shape (open-multi-agent, tutti, agent-orchestrator). Nodes have
dependencies forming a directed acyclic graph; non-adjacent nodes share a
blackboard.

In pi: author the DAG in JS. Use `parallel()` for nodes with no dependency on
each other; sequence `await` calls for dependencies; use `store_put`/`store_get`
so a node can read a non-adjacent node's output without piping it through every
intermediate stage. Fan-in is just `await Promise.all([...])` over the upstream
nodes before calling the downstream `agent()`.

### 2. Branching review loop (do → critique → revise → converge)
The adversarial-review / Ralph / toryo pattern. A DAG with one back-edge from
review back to draft.

In pi: `agent(draft) → verify(result) or agent(review)` then `gate(draft,
validator)` looping until the review passes. `adversarial-review` built-in
already encodes a version of this. For "improve until metric stops moving" use
`loopUntilDry`.

### 3. Hierarchical delegation (orchestrator → sub-orchestrators → workers)
The fractal / ralph-orchestrator pattern: recursive delegation bounded by depth
and cost.

In pi: nested `workflow()` calls. A parent orchestrator agent calls
`workflow(savedName, childArgs)` to spawn a sub-graph; the child run **inherits
the parent's SharedStore**, so workers and their grandparent share the
blackboard. Bound depth by limiting nesting levels; bound cost via `tokenBudget`
and `maxAgents`. A subagent (the tool) is the degenerate 1-level case.

### 4. Autonomous loop (keep running until verified)
bernstein / ralph / LoopTroop: one goal driven through retry-until-verified,
often with fresh context per attempt.

In pi: `loopUntilDry` or a `while`/`gate` over a task list, with `retry` on
flaky leaves. pi-autoresearch is exactly this shape — it **is** a cyclic graph
(a self-edge) whose convergence condition is the keep/discard metric. So: yes,
pi-autoresearch is already a graph; it is a single-node self-loop with a
convergence gate.

### 5. Agent mesh / peer network
shire (inter-agent mailboxes), scion (dynamic coordination). Nodes
communicate peer-to-peer asynchronously rather than through a coordinator.

In pi: **partially** expressible. The SharedStore is a blackboard, not a
mailbox: there is no per-agent inbox or selective routing. You can simulate a
mailbox with keyed store entries (`store_put("inbox:nodeB", msg)`) and poll, but
you author the routing — there is no native mesh primitive. This is the one
topology that is genuinely awkward; if you need it, treat the store as a
tuple-space and keep routing logic in the script.

### 6. Runtime-planned DAG ("describe the goal, not the graph")
open-multi-agent's pitch: a coordinator plans the task DAG at runtime.

In pi: **not a single primitive** — and the one topology that adds something
beyond composing the others. The pattern: a planning `agent()` emits a JSON
task plan (nodes + dependencies); the script then interprets that plan,
dispatching `agent()`/`parallel()` per the declared edges and using the
SharedStore for inter-task state. The script is the runtime graph executor; the
planner only supplies the instance. This is how you get goal→graph without a
fixed topology.

## Zo Computer — not a graph tool

`zo-computer.cello.so` is **not** a graph-engineering platform. cello.so is a
SaaS **user-led-growth / referral** platform; the `*.cello.so` URL is a
user-published landing page (Caleb's brand page) hosted on it. The direct fetch
404s and cello.so's own copy confirms it is a referral platform (Copilot/Claude
integrations for referral flows).

Relevance to pi: none as a tool. The actual graph-engineering tooling in
Caleb's orbit is the CLI coding agents themselves (Claude Code, Codex, Pi,
Antigravity) plus orchestrators like those catalogued in
`awesome-harness-engineering` and `awesome-agent-orchestrators`. Treat "Zo
Computer" as a content/brand surface, not a dependency.

## What is NOT expressible with pipeline/parallel/subagent alone

| Need | Not in pipeline/parallel | How to get it in pi |
| --- | --- | --- |
| Shared mutable state across non-adjacent nodes | ✗ | `store_put`/`store_get` (per-run) or `ctx_index`/`ctx_search` (durable, cross-run) |
| Fan-in (one node depends on two+ upstreams) | ✗ (parallel is fan-out only) | `await Promise.all([...upstream])` then `agent()` |
| Cycles / revise-until-good | ✗ (pipeline is acyclic) | `gate()` / `loopUntilDry()` / `retry({until})` |
| Hierarchical sub-graphs with shared state | partial (subagent shares no store) | nested `workflow()` (inherits parent SharedStore) |
| Topology chosen at runtime | ✗ | planner agent emits JSON plan; script executes it |
| Per-agent inboxes / selective routing (mesh) | ✗ | keyed SharedStore entries as mailboxes (you author routing) |
| Durable state across runs | ✗ (store is per-run) | `ctx_index` knowledge store as a persistent blackboard |

## Mapping to this user's projects

### Generic service orchestration
Treat an external service as a node or a tool called by one node. Use `parallel-analysis → builder → constraint-review` with a gate back to the builder on failure, then report from SharedStore state.

### Generic branching-review example

A textbook branching review loop (DAG + back-edge):
`research → outline → draft → review → (revise back to draft until gate passes)
→ polish`. `research` fans out in parallel; `draft↔review` is a `gate` cycle;
`outline` and `polish` are linear stages. SharedStore holds the evolving
chapter state so review sees draft + outline together.

### bio-orchestrator (Streamlit) / FALA / Next.js sites
Same vocabulary: parallel for independent research/section agents, gate for
quality loops, nested workflow() when a section deserves its own sub-graph.
The Streamlit/Next.js UI layer is a consumer of the graph's output, not a node.

## When pipeline/parallel is enough — and when it is not

Reach for `pipeline`/`parallel` (or the built-in patterns) when:
- the shape is genuinely linear or a one-level fan-out,
- nodes communicate only with their immediate neighbor / the collector,
- there is no convergence loop.

Reach for an authored graph (this skill) when:
- a node needs two+ upstreams (fan-in),
- a node needs state from a non-adjacent node (skip connection),
- you need a revise-until-good cycle,
- you want a planner to pick the topology at runtime,
- you want durable cross-run shared state (ctx blackboard).

Authoring a graph is more code than calling `parallel()`. Prefer the built-in
patterns (`deep-research`, `adversarial-review`, `multi-perspective`,
`codebase-audit`) when they fit — `adversarial-review` already *is* a
branching review loop. Only hand-author when the topology is genuinely custom.

## Authoring rules (from workflow-authoring, condensed)

- Start with `export const meta = { name, description }`; declare phases and
  enter each with `phase(title)`.
- Call `agent()` at least once; give every call a short unique `label`.
- Pair ordered results with stable work IDs before filtering; when a downstream
  node consumes an upstream result, pass both the stable ID and the actual data
  in the prompt.
- Bound fan-out, loops, retries, agents, and concurrency to the task.
- Use `log()` (not `console`); plain JS, no imports, no fs modules.
- Pass nondeterminism through `args` (`Date.now`/`Math.random` are unavailable).
- Intermediate state lives in workflow variables or the SharedStore — not chat.

## References

- `~/.pi/agent/skills/ce-lite/SKILL.md` — the orchestrator that routes to graphs.
- `…/pi-dynamic-workflows/skills/workflow-authoring/SKILL.md` — authoring reference.
- `…/pi-dynamic-workflows/dist/shared-store.js` — SharedStore (the blackboard) internals + delta-journaling.
- `…/pi-dynamic-workflows/skills/workflow-patterns/SKILL.md` — the 5 built-in graph patterns.
- Discourse: github.com/open-multi-agent/open-multi-agent, ai-boost/awesome-harness-engineering, andyrewlee/awesome-agent-orchestrators, bradAGI/awesome-cli-coding-agents.
