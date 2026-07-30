# Findings — Autoresearch: Thinking-Level Economics (2026-07-30)

## Verdict
**Win, shipped.** kimi-k3 at `thinking=high` beats `xhigh` on the T1+T3 suite by
**−34% total tokens (51,119 → 33,664 two-run mean)**, −40% output (2,622 → 1,570),
−28% round-trips (18 → 13), canaries green on both high runs. `medium` ties `high`
on suite (30,592) and is 24% cheaper on output but **fails the t3 canary** — the
quality cliff for kimi-k3 is at medium.

Promoted: `defaultThinkingLevel: xhigh → high` (live + repo settings.json) and
`model-tiers.json` reasoner `kimi-k3:xhigh → :high`.

## Log
| think | suite | out | reqs | checks | decision |
|---|---:|---:|---:|---|---|
| xhigh | 51,119 | 2,622 | 18 | pass | baseline |
| high | 30,995 / 36,333 | 1,695 / 1,444 | 12 / 14 | pass ×2 | **KEEP** |
| medium | 30,592 | 1,294 | 12 | **FAIL t3-r2** | discard |

Same pattern as the terseness campaign: cheapest-metric candidate is the quality
failure; canaries load-bearing.

## Mechanisms
- xhigh doesn't just cost reasoning tokens — it causes *more* round trips (18 vs 12–14),
  likely over-deliberation/re-verify loops. The savings compound: fewer turns × less
  thinking per turn.
- N=1 caveat: medium's cliff is one failing run on the hardest task; if t3-critical
  work ever needs medium, re-test with a bigger N.
- **Rig fix (load-bearing for all Venice measurements)**: rebuilt `proxy-oi.mjs` must
  pin `accept-encoding: identity` upstream — gzip-forwarded bodies break client
  tool-call parsing (silent "no tools used, retry loop" failure mode, seen in the
  first baseline attempt) and capture bodies. Also: usage keys differ per provider
  (`prompt_tokens` vs `input_tokens`) — aggregates normalize both.
- kimi-k3 xhigh reasoning_tokens reported small (11–70/req) yet suite cost was 1.65×
  high — the cost is not reasoning-token billing alone; the turn-multiplication
  dominates. Output terseness finding holds: behavior > tokens budgeted.

## Follow-ups
- ce-lite suite campaign runs at `high` (updated in its measure.sh).
- `Venice/kimi-k3:high` as reasoner-tier default is now consistent across settings
  and model-tiers; per-tier thinking for leaf (mercury-2:minimal) untouched.
