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
- (baseline pending) Empty `rule.md` → measures Pi's raw vague-task reliability.
  Update this as experiments accumulate: note which rule phrasings helped/hurt,
  which tasks are noise-stable, dead ends.

## Verdict (to write at finalize)
- Does a thin general sharpening rule close the vague-prompt gap? By how much?
- Token cost of the winning rule vs the ~20k it replaces.
- Does it touch the max-thinking −7pt gap, or is that a separate "context
  sufficiency" lever? (Initial read: separate — sharpening gives clearer scope,
  not more context budget.)
