# Workflow: mattpocock skills + pi-goal-list-loop-audit + delegate

How to use the three components together. They operate at different layers and compose, not conflict.

## Component roles

| Component | Layer | Role |
| --- | --- | --- |
| **mattpocock skills** | Methodology | HOW to do the work (grill → spec → tickets → implement → review) |
| **pi-goal-list-loop-audit** | Execution | DRIVES the work to completion + verifies with isolated auditor |
| **delegate** | Exploration | Isolated subagent for codebase scanning, research, verification |

## Feature work (the main flow)

```
/grill-with-docs                    ← sharpen idea, build CONTEXT.md
    ↓
/to-spec                            ← turn conversation into spec
    ↓
/to-tickets                         ← split into tracer-bullet tickets
    ↓
/list <paste tickets>               ← import to glla (batch, one confirm)
    ↓
    ┌─ glla drives each item ──────────────────────────────┐
    │  /implement → /tdd internally (red-green slices)     │
    │  delegate("explore module X for dependencies")       │
    │  glla auditor verifies completion (isolated session) │
    └──────────────────────────────────────────────────────┘
    ↓
/code-review                        ← quality check on the full diff
```

**Why this order:** Keep grilling → spec → tickets in one unbroken context window (Matt's rule). glla takes over AFTER tickets exist — it's the execution engine, not the ideation engine. glla persists to disk, so it survives `/handoff` naturally.

## Single goal (smaller work)

```
/goal "implement X. Done when: tests pass"
    ↓
    agent uses /implement → /tdd
    agent uses delegate for any exploration
    glla auditor verifies (read-only, isolated)
```

Skip the spec/tickets flow — go straight to glla with a clear "Done when:" clause.

## Bug fixes

```
/diagnosing-bugs                    ← tight feedback loop (red test first)
    ↓
/goal "fix bug X. Done when: regression test passes"
    ↓
    glla auditor verifies the fix is real
```

## Architecture work

```
/improve-codebase-architecture
    ↓
    agent calls delegate("scan codebase for shallow modules")
    ↓
    HTML report produced, you pick a candidate
    ↓
    /grilling walks the decision tree
    ↓
    /goal "deepen module X. Done when: tests pass, interface shrinks"
    ↓
    glla auditor verifies
```

## Loops (continuous improvement)

```
/loop start "improve test coverage" measure="coverage report | grep -oP '\d+(?=%)'" direction=max
    ↓
    each iteration: delegate explores, agent implements
    metric determines progress (not the agent's self-report)
    ↓
/loop stop
```

## How the three pieces interact

**glla auditor vs /code-review** — different things:

- glla auditor: "Did you actually do what you said?" (goal completion, isolated session)
- /code-review: "Is the code good?" (standards + spec, same session)
- Run /code-review WITHIN the goal, then glla's auditor does the final gate

**delegate vs glla auditor** — different purposes:

- delegate: agent voluntarily calls it for exploration ("go figure this out")
- glla auditor: forced on completion ("prove you did it")
- Both spawn isolated sessions, but delegate is a tool the agent chooses; the auditor is automatic

**delegate vs /handoff** — different directions:

- delegate: spawn a fresh session, get a result back, continue here
- /handoff: compact THIS session, start fresh elsewhere
- Use delegate for parallel exploration; use /handoff when your context is full

## What NOT to do

1. **Don't use glla for ideation** — use mattpocock skills (grill → spec → tickets) first, THEN glla for execution. glla's loop will rush you if you haven't finished thinking.

2. **Don't use delegate for simple reads** — if you just need to read one file, use `ctx_read` directly. delegate has overhead (spawning a new session). Use it for multi-step exploration or research.

3. **Don't skip "Done when:" clauses** — glla's auditor needs a verification contract. Without "Done when: tests pass", the auditor has nothing concrete to check.

4. **Don't use /compact inside a glla loop** — glla persists state to disk, so use `/handoff` (fork) not `/compact` (in-place) if context gets full. The goal survives the handoff.

## Quick reference card

```
IDEATION:     /grill-with-docs → /to-spec → /to-tickets
EXECUTION:    /list <tickets>  OR  /goal "X. Done when: Y"
WITHIN:       /implement → /tdd, delegate for exploration
VERIFY:       glla auditor (automatic) + /code-review (manual)
CROSSING:     /handoff (glla survives)
ARCHITECTURE: /improve-codebase-architecture (uses delegate for scanning)
BUGS:         /diagnosing-bugs → /goal "fix. Done when: regression test"
LOOPS:        /loop start "improve X" measure="cmd" direction=max
```
