# grok-4-6 thinking pin — one-model test

Question: can `Venice/grok-4-6` sit at `low` (or `medium`) without failing the hard canary that already sank `kimi-k3` at `medium`?

Answer this before any fleet or `model-thinking.json` change. Hold `defaultThinkingLevel=medium`. Do not pin grok-4-6 in live settings during the run — pass `--thinking` only.

## Why this model

- This session's model. Not in live `model-thinking.json`, so it already inherits `defaultThinkingLevel=medium`.
- Prior suite (`research/autoresearch-thinking-20260729`) was `kimi-k3` only. `high` beat `xhigh` on cost; `medium` failed `t3-r2`. That result does not transfer until grok-4-6 is measured.
- Auto-reasoning is a separate escalate/restore hook. It is not ce-lite. This campaign measures the pin first, then optionally the hook.

## Hold constant

- Model: `Venice/grok-4-6` only
- Global default: `medium` (do not edit `settings.json`)
- Other model pins: untouched
- Canaries: same as 20260729 (`think-checks.sh`)
- `xhigh` / `max`: out of scope (user-only; already lost to `high` on kimi)

## Phase 1 — pin (required)

`PI_AUTO_REASONING_DISABLE=1` so the scorer cannot mask a weak floor.

| Arm | `--thinking` | Expect |
| --- | --- | --- |
| A | `low` | t1 cheap; t3 likely fail |
| B | `medium` | t1 pass; t3 is the cliff |
| C | `high` | both pass (control) |

Each arm: t1 + t3 × 2 reps. Same prompts as 20260729:

- t1: list cwd files into `files.txt`
- t3: fix `multiply` in `calc.js` (returns 5 for 2×3), append one changelog line

Pass: `think-checks.sh` for that level (`files.txt` ≥3 lines and contains `test1.txt`; `calc.js` has `a * b`; changelog ≥2 lines).

Cost: `think-aggregate.js` `suite_total` / `out_sum` / `req_sum`. Winner among **passing** arms is lowest `suite_total`. A cheaper fail is not a win.

## Phase 2 — auto-reasoning (only if Phase 1 needs it)

Run only if A or B fails t3, or if A/B pass but you still want the lane-switch tax.

| Arm | Floor | Auto-reasoning |
| --- | --- | --- |
| D | `low` | on (unset `PI_AUTO_REASONING_DISABLE`) |
| E | `medium` | on |

Same canaries × 2 reps. Compare to the matching Phase 1 arm:

- Quality: did D/E flip a t3 fail to pass?
- Cost: `suite_total` vs pinned `high`
- Tax: extra requests / output vs the same floor with AR off (cache-lane switch)

If D passes t3 but costs ≥ C, keep the `high` pin. If D fails t3, low+AR is not a substitute for a high floor.

## Decision rule (write into `findings.md`)

1. If C fails t3 → stop. Do not lower. Open a quality bug, not a pin change.
2. If B passes both reps and `suite_total` ≤ C → recommend inherit `medium` (no grok-4-6 pin).
3. If only C passes → recommend pin `Venice/grok-4-6: high` in `model-thinking.json` (HIL measure row, then apply).
4. If A passes both reps and is cheapest → only then consider `low`. Unlikely; do not generalize to the fleet.
5. Phase 2 never writes a pin. It only says whether AR can rescue a low/medium floor.

## How to run

From this directory:

```
# Phase 1
PI_AUTO_REASONING_DISABLE=1 THINK=low    bash run-measure.sh
PI_AUTO_REASONING_DISABLE=1 THINK=medium bash run-measure.sh
PI_AUTO_REASONING_DISABLE=1 THINK=high   bash run-measure.sh

# Phase 2 (optional)
unset PI_AUTO_REASONING_DISABLE
THINK=low    bash run-measure.sh
THINK=medium bash run-measure.sh
```

`run-measure.sh` starts the capture proxy, runs the four pi turns, prints `METRIC` lines, then `think-checks.sh`. Needs `bench-systima` proxy + Venice creds already used by the 20260729 suite. ~2–3 min per level.

Do not edit live `~/.pi/agent/model-thinking.json` for this. `--thinking` is the only override.

## Out of scope

- Fleet-wide low
- ce-lite `small`/`medium`/`big` routing
- KEEP / compaction / tscg
- Changing `defaultThinkingLevel`
