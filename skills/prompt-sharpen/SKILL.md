---
name: prompt-sharpen
description: On demand, turn a vague request into a sharp task brief (scope / behavior / edge cases / done-criteria) you can edit and re-submit. Opt-in — fires only when invoked, adds zero per-turn cost. Use when a request feels underspecified and you want to pin it down before Pi runs.
---

# prompt-sharpen

An **opt-in** skill. It is NOT injected every turn — it costs tokens only when
you explicitly invoke it. This is deliberate: autoresearch (see
`.auto/findings.md`) measured that an *injected* sharpening rule gives no
reliability gain and costs ~50% more tokens. The vague-prompt gap that actually
fails needs **task knowledge in the input**, not a per-turn meta-process. So
this skill puts the sharpness where it belongs: in the request you re-submit.

## When to use
- The request is vague ("fix it", "make it robust", "add validation", "improve
  the summary") and you're not yet sure of the full scope.
- You want to avoid Pi under-scoping (missing a function, a field, an edge case).

## What it does
Given your raw request, emit a **brief, editable task spec** — nothing else:

```
Scope:      <files/functions to touch>
Behavior:   <each required behavior, as a list>
Edge cases: <invalid / empty / missing / boundary inputs to handle>
Done:       <how we know it's finished — concrete, checkable>
Open questions: <anything genuinely ambiguous that needs your call>
```

Keep it ≤8 lines. Do NOT solve the task here — just sharpen it. Then **stop**
and let the user edit/confirm before running.

## Why this shape
Those four fields are the ones a well-specified Pi task needs (per the
Databricks/Pi guidance). The `Open questions` line is the honest escape hatch
for genuine ambiguity that no rule can resolve — it surfaces the choice to the
user instead of the model guessing.

## Not a per-turn rule
Do not internalize this as always-on behavior. It is a tool the user opts into
for vague requests. Sharp requests should run directly — that is Pi's advantage.
