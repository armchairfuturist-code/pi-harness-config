# Canary: multi-turn simulation

> A 3-5 turn simulated task that catches context-lifecycle regressions single-turn tests miss.
> The autoresearch studies found that economy pressure caused "skipped discovery → legacy values
> only" — a failure that only manifests across turns.

## Brief (simulated as a sequence of user messages)

### Turn 1: Initial context
```
I'm working on a Python project in /tmp/canary-project/. Create a simple module called
calculator.py with an add(a, b) function and a multiply(a, b) function. Write tests for both.
Run the tests.
```

### Turn 2: Follow-up (tests context retention)
```
Now add a divide(a, b) function that raises ZeroDivisionError when b is 0. Add a test for it.
Run the tests again.
```

### Turn 3: Cross-reference (tests multi-turn reasoning)
```
Look at all three functions you've created. Which one has the most complex error handling?
Refactor it to be simpler while keeping the same behavior. Run the tests.
```

### Turn 4: State check (tests context lifecycle)
```
What was the first function you created? What was the last change you made?
Summarize the current state of calculator.py.
```

## What it tests

- **Context retention:** Does the agent remember functions from turn 1 in turn 3?
- **State awareness:** Can the agent correctly summarize the current state in turn 4?
- **Multi-turn reasoning:** Can the agent reason across turns (which function has most complex error handling)?
- **Context lifecycle:** Does the agent lose critical state if compaction occurs between turns?

## Canary checks

1. Turn 1: calculator.py created with add() and multiply(), tests written and pass
2. Turn 2: divide() added with ZeroDivisionError, test added, tests pass
3. Turn 3: Agent identifies divide() as most complex, refactors it, tests still pass
4. Turn 4: Agent correctly names add() as first function, describes the refactor from turn 3

## Why this matters

Single-turn canaries miss:
- **Compaction regressions:** if context is compacted between turns, does critical state survive?
- **Progressive disclosure failures:** if tools are lazily loaded, does the agent still find them on turn 3?
- **Economy pressure cascades:** terse mode on turn 1 may skip writing tests, which fails on turn 2

## Measurement

This canary must be run as a multi-turn session, not a single API call. The proxy captures each
turn separately. Aggregate token usage across all 4 turns. The checks must pass on every turn.

## Automation note

Full automation of this canary requires a session simulation harness that:
1. Sends the first message
2. Waits for the agent response
3. Sends the next message referencing the previous context
4. Repeats for all 4 turns
5. Runs checks against the full conversation

This is a build target for Iteration 0 Phase 2. For now, it can be run manually.
