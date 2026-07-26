# Ideas — Pi Prompt-Quality Skill

## Anti-overfit / anti-cheat guardrails (active)
- Rule text stays GENERAL: only the meta-process (decompose vague request into
  scope / behavior / edge-cases / done-criteria). No task names, no fixture hints.
- `rule_tokens` budget ~150 tok hard guard — bloat = discard.
- Held-out check at finalize: 2 vague tasks NOT in the measured suite, run once
  with the winning rule, to confirm generalization (not suite-overfit).
- Verifiers are strict + objective; never loosen them to manufacture a win.

## Avenues to try (in rough order)
- [ ] v1 rule: "Before acting on an underspecified request, write a ≤5-line brief
      covering scope / required behavior / edge cases / done-criteria, then do it."
- [ ] Trigger condition: only sharpen if request is vague (avoid waste on sharp
      requests). But headless bench is always vague — test the "always" form first.
- [ ] Done-criteria emphasis: explicitly "state how you'll know it's finished and
      check it before stopping" — targets the reliability gap directly.
- [ ] Edge-cases emphasis: "enumerate boundary/invalid inputs" — maps to validate
      & errors tasks. Keep general (no task specifics).
- [ ] Brevity constraint in the rule itself: "brief must be ≤5 lines" so the
      sharpening doesn't itself bloat the session.
- [ ] Placement variants to ship: (a) AGENTS.md section (per-turn, measured here),
      (b) on-demand SKILL.md that emits the brief once. Measure (b)'s token win.
- [ ] Does sharpening help the max-thinking −7pt gap? Separate lever (context
      sufficiency), but a clearer scope may reduce reasoning length — measure
      total_input_tokens delta at thinking=high.

## Deferred / needs work
- 5th task "write tests" via mutation testing (catch a seeded bug). No pytest/pip
  in env; needs a stdlib test-runner contract the model must follow — risky for
  fairness. Revisit with a tiny custom runner.
- A "vague-prompt" bench variant that is intentionally adversarial (multiple
  plausible interpretations) to stress-test the rule's disambiguation.
- Cross-model check: rerun winner on a non-free model to confirm model-agnostic
  (handoff hard constraint). Out of scope for the free-model loop.
