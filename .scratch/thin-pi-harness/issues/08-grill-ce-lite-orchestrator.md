# 08 — Grill: lock CE-lite single orchestrator

Type: grilling
Status: resolved
Blocked by: 02, 03, 04, 05

## Question

What is the single operator-facing orchestrator? Decide: entrypoint (dynamic workflow / one skill / extension / composition); stage→owner map (simple path vs non-trivial path); how subagents are invoked automatically; how much of goal/list/loop is internal vs visible; no manual gate hopping. Must feel Claude-like "just knows" for a non-dev; matt primitives only as backends.

## Answer

**Resolved AFK under the handoff contract** (user delegated: "claim 08 — lock CE-lite orchestrator"; charting grill pre-locked the destination). Deciding evidence: probe measurements taken 2026-07-27 (`bench/probe.sh` + new `bench/probe-variant.sh`, sandboxed via `PI_CODING_AGENT_DIR`, model Lilac/zai-org/glm-5.2):

| Candidate stack | Always-on probe | Δ vs live 5,789 |
|---|---:|---:|
| Live baseline / sandbox control | 5,789 / 5,791 | — |
| + `@quintinshaw/pi-dynamic-workflows` 3.4.0 | 6,416 | **+627** |
| + `pi-subagents` 0.36.0 | 9,599 | **+3,810** |

pi-subagents alone would consume the entire ≥30% cut budget (target ≤ ~4,052) — **rejected as always-on** despite passing the capability bar. dyn-workflows passes capability AND budget — **locked**.

### Lock: composition with one meta-skill entrypoint

CE-lite = **thin composition**, not a single install:

1. **Entrypoint: one operator-facing meta-skill** (`ce-lite`, the only ceremony skill whose description is always-on). It encodes the routing doctrine: simple → answer directly; non-trivial → grill only blocking questions → plan → execute under glla contract → dyn-workflow fanout → review/audit → compound. Matt skills (implement, tdd, research, diagnosing-bugs…) are **lazy backends the orchestrator reads**, never operator gates. `disable-model-invocation` stays on for the matt pack.
2. **Fanout engine: `@quintinshaw/pi-dynamic-workflows`** — `agent()`/`parallel()`/`pipeline()`/`phase()`, tiers small/medium/big, journaled resume, bounded keyword trigger ("workflow(s)") + explicit `/workflows run`. Adds 2 tools + 2 lazy skills = +627 tok.
3. **Contract + audit:** ~~`pi-goal-list-loop-audit` (glla) internalized~~ **REVISED by ticket 07 measurements (2026-07-27):** glla's 11 always-on tools (≈1,100 tok) are incompatible with the ≥30% budget lock. Contract/audit is re-homed to **ce-lite contract artifacts** (written acceptance criteria) + **dyn-workflows reviewer/verify phase** + journaled resume; loop-shaped campaigns → `pi-autoresearch` (0 always-on tools). glla dropped from the kernel; the audit *pattern* (isolated verification against contract terms) survives as a workflow phase. Operator visibility unchanged: status only, never goal/list/loop commands.
4. **Human side thread: `pi-herdr-btw`** — already live; operator asks side questions without polluting the main transcript.
5. **Kill `extensions/delegate.ts`** as primary path (research 05: fails the capability bar alone; dyn-workflows supersedes it at acceptable cost).

### Stage → owner map

| Stage | Owner | Operator sees |
|---|---|---|
| Simple Q&A | parent model, direct | just the answer |
| Triage / route | ce-lite meta-skill (parent) | nothing |
| Grill-when-needed | parent asks only blocking Qs | one short question at a time |
| Plan | parent (reasoner tier if hard) | brief plan summary |
| Execute | dyn-workflows fanout (worker/leaf tiers) | progress panel |
| Contract tracking | glla goal (internal) | status line only |
| Review / audit | dyn-workflows reviewer agent, glla audit leg | findings summary |
| Compound | write pattern/note artifact (memory store) | one line |
| Side questions | herdr-btw | operator-initiated pane |

### Rejected alternatives

- **pi-subagents as fanout engine** — +3,810 always-on tokens; fails token ceiling (capability bar passes, budget bar fails).
- **super-pi** — ~4.1k fixed + dev-shaped stage assumptions; thicker than the locked budget allows.
- **delegate.ts only** — no tiers, no real parallel API, no journaled resume; fails capability bar.
- **Full CE / orchflows install** — out of scope by destination lock (mechanism donors only).

Probe artifacts: `bench/probe-variant.sh` committed; raw capture diff (live 37 tools/2k system chars vs uncompressed 95/23k) confirmed lean-ctx `replace`+`lean` profile is load-bearing for the baseline.
