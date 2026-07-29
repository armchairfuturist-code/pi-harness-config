# Autoresearch: Pi Harness — Output Terseness & Turn Economy (2026-07-29)

## Objective
Reduce **median total tokens (input+output) across the behavioral suite T1–T3** by
iterating on the phrasing of `APPEND_SYSTEM.md` (the only always-on overlay).
Born from history mining (2026-07-29): at 90–98% prefix-cache hit rates the 4,007-tok
floor is nearly free in steady state; fresh tokens ≈ conversation growth per turn, and
assistant outputs pay twice (output now, fresh input next turn). Turn count and output
verbosity are the remaining levers.

## Metrics
- **Primary**: `suite_total` = Σ over tiers of median(totalIn+totalOut, 2 reps). Lower is better.
- **Monitors**: `out_sum` (output tokens across suite), `req_sum` (round-trips; 6 = perfect), per-tier detail.
- **Canaries**: `checks.sh` — T1 files.txt correct, T2 summary.md ≥200 chars, T3 bug fixed + changelog appended. Failure ⇒ discard.

## How to run
- `./measure.sh` — builds variant (`/tmp/pi-terseness-variant`), runs 6 lanes through the
  capture proxy (port 4599), prints `METRIC` lines. ~2-3 min.
- `./checks.sh` — after measure.sh; must print `checks_pass=1`.
- Measurement goes through the proxy, never direct Lilac (provider caching undercounts).
- Model fixed: `Lilac/zai-org/glm-5.2`. Comparability depends on it.

## Rules
- Edit ONLY `candidates/APPEND_SYSTEM.md`. Live `~/.pi/**` is never touched.
- ≤10 measured iterations total (incl. baseline). Marginal (<3%): re-run once.
- Log every iteration to `log.jsonl`: `{iter, idea, suite_total, out_sum, req_sum, checks, decision, note}`.
- Negative result ("terseness can't be phrased in without quality loss") is a valid outcome.
