# Autoresearch: <goal>

## Objective
<Specific description of what we're optimizing and the workload.>

## Metrics
- **Primary**: <name> (<unit>, lower/higher is better) — the optimization target
- **Secondary**: <name>, <name>... — independent tradeoff monitors

## How to Run
`./.auto/measure.sh` — outputs `METRIC name=number` lines.

## Files in Scope
<Every file the agent may modify, with a brief note on what it does.>

## Off Limits
<What must NOT be touched.>

## Constraints
<Hard rules: tests must pass, no new deps, etc.>

## Anti-Overfitting Rules
- **Never hardcode benchmark outputs** or special-case test inputs to produce better numbers
- **Never modify the benchmark script** (.auto/measure.sh) to improve metrics — it measures, you optimize the code it runs
- **Never disable assertions, skip tests, or weaken checks** to improve metrics
- **Optimizations must be general** — if a change only helps the benchmark but not real workloads, discard it
- **Watch for lucky passes** — a passing run that required blind retries, regression cycles, or missing verification is not a real win
- **Respect the noise floor** — if the benchmark is noisy, improvements within noise are not real. Check the confidence score (≥2.0× = likely real, <1.0× = within noise)
- **Don't overfit to one strategy** — if you've tried N variations of the same approach, pivot to a structurally different one
- **Verify keeps are stable** — a keep that doesn't reproduce on re-run is noise, not a win

## ASI Schema
Use these fields in `log_experiment`'s `asi` parameter for consistent cross-session memory:
```json
{
  "hypothesis": "what you tried (1 sentence)",
  "mechanism": "why you expected it to work",
  "result": "what happened (1 sentence)",
  "learned": "key insight for future iterations",
  "next_focus": "where to look next",
  "dead_end": false,
  "rollback_reason": "why it failed (discard/crash only)"
}
```
On discard/crash: always include `rollback_reason` and `next_action_hint`. Annotate failures heavily — reverted changes leave only the ASI as a record.

## What's Been Tried
<Update this section as experiments accumulate. Note key wins, dead ends,
and architectural insights so the agent doesn't repeat failed approaches.>

### Wins
- (run #N) <description> — <metric improvement>

### Dead Ends
- (run #N) <description> — <why it failed, what was learned>

### Active Hypotheses
- <hypothesis not yet tested>
