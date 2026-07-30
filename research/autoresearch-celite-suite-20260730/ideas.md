# Ideas backlog — ce-lite suite campaign

Mutation surface: `candidates/SKILL.md` (7,059 bytes baseline = live ce-lite with all 6 audit fixes).
Suite: s1 research+synthesis, s2 multi-file refactor, s3 exploratory debugging — ×2 reps,
Venice/kimi-k3:xhigh. Premise check: `skill_loaded` metric must be ≥1 lane or the suite
isn't exercising SKILL.md (briefs need strengthening before any phrasing conclusion).

1. [ ] baseline — live SKILL.md verbatim
2. [ ] plan-economy line in contract loop: "Plans: <=5 bullets, no prose paragraphs; state terms, steps, done."
3. [ ] verify-step brevity: "Verify = run canaries and report pass/fail only; no re-derivation."
4. [ ] winners combined
5. [ ] negative control: remove the decomposition-routing section (expect req_sum up — validates the section is load-bearing)

## Rules (same as terseness campaign)
- Median-of-2 per suite; marginal <3% → re-run once; checks_failed ⇒ discard.
- Variant dir via PI_CODING_AGENT_DIR; live untouched; proxy-only measurement.
