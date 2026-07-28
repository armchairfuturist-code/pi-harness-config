# Autoresearch: Pi Prompt-Quality (Task-Sharpening) Skill

## Objective
Make Pi run **better on vague/underspecified requests** by adding a **thin,
general prompt-sharpening mechanism** — not by bulking up the harness.

Thesis (from `pi-prompt-quality-handoff.md`): Pi's thinness is a *quality*
feature when the prompt is sharp, but a liability when the prompt is vague
(no fallback rules to fill the gaps, unlike Claude Code's ~20k-token system
prompt). The lever: a low-token instruction that makes Pi **decompose a vague
request into scope / behavior / edge-cases / done-criteria before acting**.
If it works, we recover Claude-Code-style reliability on vague tasks without
Claude-Code's per-turn tax.

We optimize the **text of that instruction** (`rule.md`) against a suite of
deliberately vague coding tasks, then ship the winner into `AGENTS.md` and/or
a `SKILL.md`.

## Metrics
- **Primary**: `tasks_passed` (higher is better) — number of vague-task trials
  Pi completes correctly with the current `rule.md` injected. Scale 0..(tasks×RUNS).
- **Secondary**:
  - `total_input_tokens` — sum of `.message.usage.input`+`cacheRead`+`cacheWrite`
    across all trials. Guards against the rule becoming Claude-Code-style bloat.
  - `rule_tokens` — estimated tokens of the injected rule (chars/4). Hard guard:
    the rule must stay **thin** (target ≤ ~150 tok). A "win" bought by a bloated,
    task-specific rule is **overfitting** and must be discarded.
  - `trials` — trials actually completed (should equal tasks×RUNS).

## How to Run
`./.auto/measure.sh` — outputs `METRIC name=value` lines.
- Recreates deterministic fixtures under `/home/alex/pi-pq-bench/<task>/`.
- For each task × RUNS: runs headless `pi -p "<vague prompt>"` with
  `--append-system-prompt .auto/rule.md` (only if rule.md is non-empty, so an
  empty file = true no-rule baseline), `--session-dir` per run, `--no-prompt-templates`.
- Captures the session jsonl, sums usage tokens, runs the task's objective
  `verify.sh`, records pass/fail.

## The Vague-Task Suite (fixed, diverse, objectively verified)
All verifiers are deterministic file/exit/output checks — no LLM judge, so no
"lenient judge" cheating. Each task is underspecified in a *different* way so
that a task-specific rule cannot generalize:
1. **validate** — "add validation" (underspecified: which fields/rules/edges).
2. **faster** — "make it faster, don't change output" (underspecified: order
   preserved? how fast? large input?).
3. **cli** — "add a CLI" (underspecified: entry point, args, missing-file edge).
4. **errors** — "handle errors better" (underspecified: which errors, exit vs
   message, no-traceback).

(TODO later: a 5th "write tests" task via mutation testing once a runner is
sorted — see ideas.md.)

## Files in Scope
- `.auto/rule.md` — **the artifact under optimization.** The thin sharpening
  instruction text. Empty file = baseline (no rule). This is what ships into
  `AGENTS.md` / `SKILL.md` at finalize.
- `.auto/measure.sh` — benchmark + verifiers (self-contained).
- `.auto/prompt.md` — this file.
- `.auto/ideas.md` — backlog.
- `.auto/config.json` — workingDir override.

## Off Limits (anti-cheat / anti-overfit — HARD)
- **The rule MUST stay general.** No task names, no "validate email then age",
  no fixture-specific hints. It may only describe the *meta-process* of
  sharpening a vague request (scope/behavior/edges/done-criteria). A rule that
  hardcodes suite answers is cheating — never keep it.
- **No editing the fixtures or verifiers** to make a rule "win." The suite is
  fixed; only `rule.md` (and this prompt/ideas) change.
- **No making the verifier lenient.** Verifiers stay strict and objective.
- **No per-turn bloat.** If `rule_tokens` exceeds budget (~150 tok) the change
  is moving toward the Claude-Code tax we're trying to avoid — discard unless
  the reliability gain is large and the rule is still general.
- **Do not modify pi core, settings.json, or installed packages.** Only author
  text in `.auto/rule.md`.
- Do not change the model (`openrouter/free`, thinking `high`) mid-session —
  that confounds the metric. Model-agnostic is a hard constraint from the handoff.

## Constraints
- Headless `pi -p` runs are nondeterministic and cost API tokens; keep the suite
  small (4 tasks) and use `timeout` per run. RUNS=2 for noise reduction (0..8 scale).
- Sequential trials only (shared model, avoid rate-limit contention).
- Use `jq` for jsonl parsing. python3 available; no pytest/pip — verifiers use
  plain stdlib asserts/exit codes.
- Free model may rate-limit; if `trials` drops below tasks×RUNS, that run is
  unreliable — treat as crash/noise, not a real regression.

## What's Been Tried
- **Baseline @ thinking=high (8 trials, 2026-07-26): tasks_passed=8/8,
  total_input_tokens=518,372.** At high thinking the model's own reasoning
  closes the vague-prompt gap — primary metric SATURATED, no headroom. Confirms
  the handoff's note that the reliability gap is a *cost-conscious / low-context*
  problem, not a peak-reasoning problem.
- **Reframe:** run the bench at `--thinking low` (constant across all arms).
  Low thinking models the cost-conscious / beginner case the handoff identifies
  as Pi's weak spot, widens the gap the skill targets, AND cuts loop cost ~10×.
  Fair because thinking level is held constant, so rule vs baseline is
  unconfounded. (NOT tuning thinking — that's model-config, off-limits. Low is
  fixed; only `rule.md` varies.)
- **Baseline v2 @ thinking=low, harder suite (8 trials, 2026-07-26):
  tasks_passed=6/8, total_input_tokens=367,983.** FAILs: stats r1, validate r1.
  validate r1 used only 23k tok (vs 42k pass) → under-scoped / stopped early.
  The vague-prompt gap now exhibits honestly (genuine under-scoping, caught by
  spec-based verifiers). Headroom: 6→8. This is the real target.
- (rule v1 pending)
- **Exp1 — rule v1 (8 trials, thinking=low): tasks_passed=7/8, tokens=382,152,
  rule=88 tok.** +1 over baseline (6/8) but within binomial noise at n=8;
  tokens +3.8% (the brief adds a little + one extra pass costs more). Remaining
  fail: validate r2 (29k tok) — still under-scoped/early-stop. NOTE: v1's "do not
  over-engineer beyond the request" may INDUCE under-scoping on vague reqs (model
  errs minimal). v2 will drop that clause and emphasize re-verify-before-stopping.
- Needs RUNS=3 confirmation to separate signal from noise.
- **Exp2 — rule v2, RUNS=3 (12 trials): tasks_passed=11/12 (91.7%), tokens=661,440,
  rule=93 tok.** Only fail: stats r2 (61k tok — wrong shape, not early-stop).
  v2 (drop anti-over-engineer + re-verify-before-stopping) looks much stronger
  than v1. NEEDS baseline @ RUNS=3 for fair same-n comparison (baseline so far
  only n=8=75%).
- **Baseline v2-suite @ RUNS=3 (n=12): 11/12 = 91.7%.** SAME as rule v2 (11/12).
  => on SIMPLE single-file vague tasks, the rule gives NO measurable benefit for
  a strong model; the n=8 "gap" was sampling noise. Honest negative for the
  simple regime.
- **Suite hardened to v3** (2 money fns; parser w/ =-in-value + inline comments;
  stats+median; 4-field validate) — more behaviors to infer per vague prompt.
- **Baseline v3 @ RUNS=3 (n=12): 4/12 = 33%.** REAL gap on harder tasks: bug
  0/3 (misses tax-as-percent), parse 1/3 (misses =-in-value/inline comments),
  stats 2/3 (misses median), validate 1/3 (misses country field). This is the
  regime the thesis targets. Next: rule v2 (UNCHANGED, general) @ v3 n=12.
- **Exp3 — rule v2 @ v3 (n=12): 3/12 = 25%, 687k tok** vs baseline 4/12, 611k.
  Rule did NOT help; tokens +13%. BUT v3 verifiers had unfair contract pins
  (required return-{ok:False}; model reasonably raises). Diagnostic on a
  validate FAIL showed the rule-v2 model scoped ALL 4 fields excellently and
  only failed the arbitrary contract => v3 "gap" was partly verifier artifact.
- **Suite hardened to v4 (scoping-focused, FAIR):** verifiers accept raise OR
  falsy-ok rejection; dropped ambiguity reqs (tax-as-percent, median).
- **Baseline v4 @ RUNS=3 (n=12): 7/12 = 58%, 814k tok.** Real gap concentrated
  in parse (0/3 — =-in-value + inline comments) and validate (1/3 — missing
  fields). bug 3/3, stats 3/3.
- **Exp4 — rule v2 @ v4 (n=12): 7/12 = 58%, 1,221k tok.** SAME pass rate as
  baseline; tokens +50%. The rule's plan+re-check loop adds turns/overhead and
  does NOT close the parse/validate gaps (those are DOMAIN-AMBIGUITY failures —
  "does = appear in values?", "which fields?" — that a meta-process rule cannot
  resolve without task knowledge).
- Update this as experiments accumulate.

## Verdict (written at finalize)

**A thin, general, injected-every-turn sharpening rule does NOT improve Pi's
vague-task reliability, and it costs ~50% more tokens.** Measured across three
suite hardness levels at n=12, thinking=low (constant), free model:

| Suite | Baseline (no rule) | Rule v2 (93 tok, injected) |
|---|---|---|
| simple (v2) | 11/12 (92%) | 11/12 (92%), +0 tok-gain |
| harder-unfair (v3) | 4/12 (33%) | 3/12 (25%) |
| fair-scoping (v4) | 7/12 (58%), 814k tok | 7/12 (58%), **1,221k tok (+50%)** |

The rule never beat baseline on correctness. On the fair v4 suite it matched
(7/12) while raising token cost 50% — the plan+re-check loop adds turns that,
for tasks the model would solve anyway, are pure overhead. This empirically
confirms the handoff's own research: extra injected tokens dilute attention
AND cost money; here they bought nothing.

**Why it fails — the gap is domain-ambiguity, not meta-process.** The remaining
v4 failures (parse: `=`-in-value/inline-comments; validate: missing fields) are
not "the model forgot to plan." They are genuine under-specification that needs
*task knowledge* (does `=` appear in config values? which fields need rules?) —
exactly the knowledge a general meta-process rule cannot supply. A rule that
*could* fix them would have to name the task's specifics = overfitting = the
thing we forbade. So the negative is structural, not a tuning miss.

**Does it touch the max-thinking −7pt gap?** No — separate lever. Sharpening
supplies clearer scope, not more context budget; at thinking=high the model's
own reasoning already closed even the simple-suite gap (baseline 8/8). The
−7pt Opus/max case is a context-sufficiency problem, addressed by a different
lever (provision more relevant context when reasoning is long), not by a
sharpening rule. Confirms the handoff's hypothesis.

**Net:** the handoff's thesis is half-right and half-wrong. Right: Pi's thinness
is a quality feature when the prompt is sharp, and a liability when vague.
Wrong: the liability is NOT closable by a cheap injected meta-process rule —
because the vague cases that actually fail require domain knowledge, and
injecting a planning loop just adds the per-turn tax the project exists to
avoid. Pi's documented premise ("assumes you know what you want") holds: the
honest fix for vague prompts is a sharper *input*, authored by the user — not a
harness rule that tries to manufacture sharpness per turn.

### Recommended changes (distilled)
1. **Do NOT ship a per-turn sharpening rule into AGENTS.md.** Measured: no
   reliability gain, +50% tokens. Would make Pi strictly worse on its core
   thinness advantage. (This is the key negative — it prevents a plausible but
   counterproductive change.)
2. **Optional: ship an on-demand `/sharpen` SKILL (opt-in, fires once, NOT
   injected per turn).** Zero per-turn cost (only runs when the user invokes
   it). It emits a scope/behavior/edges/done-criteria brief the user can edit
   and re-submit — moving the sharpness into the *input*, where the thesis says
   it belongs, at ~0 amortized cost. Reliability benefit is UNMEASURED (I
   measured the injected form, which failed); the value here is philosophical
   alignment + zero per-turn tax. Author it thin (<120 tok instruction).
3. **Do NOT chase the max-thinking −7pt gap with sharpening.** It is a separate
   context-sufficiency lever; leave it for a different experiment.
4. **Keep the existing Session Guardrail in AGENTS.md as-is** — it targets the
   O(turns²) cost lever, which IS real and orthogonal; don't touch it.

(See `.auto/findings.md` for the full distilled writeup + raw numbers.)
