# Findings: Pi Prompt-Quality (Task-Sharpening) Skill

> Autoresearch branch `autoresearch/prompt-quality-20260726`.
> Method: headless `pi -p` on a fixed vague-task suite, rule injected via
> `--append-system-prompt`, scored by strict spec-based verifiers (no LLM judge).
> Thinking held constant at `low`; model `openrouter/free`. n=12 per arm.

## TL;DR
A thin, general, **injected-every-turn** sharpening rule does **not** improve
Pi's vague-task reliability and costs **~50% more tokens**. The vague-prompt
gap that does exist is **domain ambiguity** (needs task knowledge), which a
meta-process rule cannot close without overfitting. **Do not ship a per-turn
rule.** An opt-in on-demand `/sharpen` skill is the only prudent artifact.

## The experiment (what was actually measured)
The handoff thesis: Pi's thinness is a quality feature *when the prompt is
sharp*, a liability when vague; build a low-token sharpening skill instead of
per-turn bloat. Tested the natural realization: a ≤6-line general rule
(scope / behavior / edge-cases / done-criteria, plan-then-re-verify) injected
every turn via `--append-system-prompt`.

Three suite hardness levels, n=12 each:

| Suite | Baseline | Rule v2 (injected, 93 tok) |
|---|---|---|
| simple (v2) | 11/12 (92%) | 11/12 (92%) |
| harder, unfair contracts (v3) | 4/12 (33%) | 3/12 (25%) |
| fair scoping-focused (v4) | **7/12 (58%), 814k tok** | **7/12 (58%), 1,221k tok (+50%)** |

The rule **never beat baseline** on correctness. On the fair suite it tied
while raising token cost 50% (the plan + re-check loop adds turns that are pure
overhead on tasks the model would solve anyway).

## Why it fails (structural, not a tuning miss)
The remaining v4 failures are **not** "the model forgot to plan":
- **parse** (0/3): model can't infer `=` appears inside values + inline
  `#` comments. That's task knowledge, not a missing plan.
- **validate** (1/3): model misses fields. A rule that named the fields would
  be **overfitting** — exactly what we forbade.

A general meta-process rule cannot supply the domain knowledge these gaps
need. The one thing that *could* fix them (naming task specifics) is cheating.
So the negative is structural: the injected-rule form of the thesis does not
hold for a strong-reasoning model.

## Confirmation of two handoff hypotheses
- **The simple-regime gap is already closed by the model.** At `thinking=high`
  baseline was 8/8 on the simple suite — no headroom. Even at `thinking=low`
  the simple suite was 92%. The reliability gap is a *hard-task / cost-conscious*
  phenomenon, not a peak-reasoning one.
- **The max-thinking −7pt gap is separate.** Sharpening gives clearer scope,
  not more context budget; it cannot address under-provisioning when reasoning
  is long. Leave it for a context-sufficiency experiment.

## Anti-cheat / anti-overfit measures taken (integrity of the result)
- Rule text stayed **general** throughout (no task names, no fixture hints).
  Verifiers are **spec-based hidden input→output** (no implementation-shape
  checks), so a rule could not game them by naming things.
- Verifiers were made **contract-fair** (accept raise *or* falsy-ok) after a
  diagnostic showed an unfair pin was manufacturing failures. Re-measured both
  arms under the fair contract.
- Did **not** loosen verifiers or tune the rule to the suite to manufacture a
  "win." The honest negative is the result.
- Thinking level and model held constant across all arms; only `rule.md` varied.

## Recommended changes
1. **Do NOT add a per-turn sharpening rule to AGENTS.md.** Measured: no
   reliability gain, +50% tokens. It would erode Pi's core thinness advantage
   for nothing. *(This negative is the most valuable output — it blocks a
   plausible, intuitive, but counterproductive change.)*
2. **Optional: ship an on-demand `/sharpen` SKILL** (opt-in, fires once on
   invocation, NOT injected per turn). Zero per-turn cost. It emits a
   scope/behavior/edges/done-criteria brief the user edits and re-submits —
   putting sharpness in the *input* (where the thesis says it belongs) at ~0
   amortized cost. Reliability benefit unmeasured; value = philosophical
   alignment + provably-zero per-turn tax. See `skills/prompt-sharpen/SKILL.md`.
3. **Do NOT chase the −7pt max-thinking gap with sharpening** — separate lever.
4. **Keep the existing Session Guardrail** (targets real O(turns²) cost);
   orthogonal, leave as-is.

## Raw artifacts
- `.auto/measure.sh` — v4 bench + verifiers (reproducible).
- `.auto/prompt.md` — full session log incl. all tried rule variants.
- `.auto/rule.md` — the general rule text (empty = baseline arm).
- Branch `autoresearch/prompt-quality-20260726` in `pi-harness-config`.
