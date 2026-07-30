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
6. [ ] wayfinder doctrine — plan-phase line: "Produce decisions, not deliverables" (expect s4 req_sum/out down, no canary change)
7. [ ] wayfinder handoff trigger: "The pull to just do the work = edge of the map; hand off" (expect s4/s5 to converge faster)
8. [ ] wayfinder naming discipline: "Refer by name" — artifact names declared once, used verbatim (canary hygiene: fewer wrong-name file writes)
9. [ ] s4 sensitivity variant: same migration ask WITHOUT naming wayfinder-map.md — tests spontaneous routing vs scripted artifact (canary: any *map*/*.md artifact with ≥3 question lines)

## Rules (same as terseness campaign)
- Median-of-2 per suite; marginal <3% → re-run once; checks_failed ⇒ discard.
- Variant dir via PI_CODING_AGENT_DIR; live untouched; proxy-only measurement.
10. [ ] trajectory briefs s6–s8 (briefs-trajectory-20260730.md) — for-loop/edit-fallback/ghost-binary; judge path, not outcome
11. [ ] wire `trajectory_metrics.py` (tool_errors by layer, retry_loops) into aggregate.js after suite runs; record `config_hash.py` per result
