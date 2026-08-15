---
name: router
description: "Route a task to the right skill. Before multi-step work: apply the ponytail ladder, clarify scope (grill), load the matching skill (registry), fan out if lanes are independent (workflow)."
---

# Router

Run before multi-step work. Quick questions: answer directly (or `/btw`), skip this.

0. **Ponytail check.** Before any skill: does this need a skill at all? One-liner, stdlib, or native feature first. If a skill isn't clearly needed, don't load one.

1. **Classify.** Quick → answer. Single-lane → step 2. Multi-lane → step 2, then `workflow()`. Too big for one session → `wayfinder`.

2. **Grill.** Resolve the design tree before building. Work in rounds: ask the whole frontier at once (numbered questions + your recommended answer), wait, repeat. Find facts yourself (dispatch a sub-agent); never ask the user for what you can look up. Reference: `grilling`.

3. **Route.** Match the resolved task to `registry.md`. Load only the matched skill's body. Unsure which fits → `ask-matt`.

4. **Run.** Execute with exactly one skill in context. Independent lanes → `workflow()` fans out; each sub-agent re-runs this router for its lane.

Never load more than one skill body. Read only the registry's one-line entry, then the matched SKILL.md — never eager-load all bodies.
