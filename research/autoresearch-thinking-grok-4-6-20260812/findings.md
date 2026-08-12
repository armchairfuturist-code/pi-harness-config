# grok-4-6 Phase 1 findings — 2026-08-12

Model: `Venice/grok-4-6`. Auto-reasoning off. Same t1+t3 × 2 canaries as `autoresearch-thinking-20260729`. `--thinking` only; live `model-thinking.json` not edited.

## Results

| Arm | checks | suite_total | out_sum | req_sum | t1 / t3 |
| --- | --- | ---: | ---: | ---: | --- |
| low | pass | 60061 | 2057 | 18 | 28553 / 31508 |
| medium | pass | 42176 | 1907 | 13 | 21709 / 20467 |
| high | pass | 42525 | 1856 | 13 | 21967 / 20558 |

Every canary wrote `files.txt` with `test1.txt` and fixed `multiply` to `a * b` plus a changelog line.

## Decision

Rule 2: medium passes both reps and `suite_total` ≤ high → **inherit `defaultThinkingLevel=medium`. Do not pin `Venice/grok-4-6`.**

- `low` passed quality but lost on cost (+42% suite_total, +5 requests). Do not pin low.
- `high` is a dead heat with medium on cost; no quality edge on this canary.
- This is **not** the kimi-k3 result (`medium` failed `t3-r2`). Do not generalize to the fleet.

## Phase 2

Not required. Both low and medium passed t3. Skip unless you want the auto-reasoning lane-switch tax as a separate question.

## Caveats

- Canary is the same easy multiply bug. It was load-bearing for kimi; grok-4-6 cleared it at low. A harder task could still prefer high.
- Low burned more requests (18 vs 13), so weaker thinking here was *less* efficient, not cheaper.
- Capture path is repo `bench/proxy-oi.mjs` (live `bench-systima` is gone). Usage fields came from `res_body.usage`.
