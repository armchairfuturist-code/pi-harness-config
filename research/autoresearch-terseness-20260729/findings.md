# Findings — Autoresearch: Output Terseness & Turn Economy (2026-07-29)

## Verdict
**Win, kept.** Two-sentence APPEND_SYSTEM.md addition cut the behavioral suite (T1–T3,
median-of-2, proxied, glm-5.2) from **70,657 → 58,551 tokens (−17.1%)**, output tokens
**−38%** (2,347 → 1,453), round-trips **−21%** (33 → 26), canaries green on both
confirmation runs. Applied to live `~/.pi/agent/APPEND_SYSTEM.md` and repo.

Winner phrasing (appended to the unchanged CE-lite hook):
> Be terse: no preamble, no recap, never restate the task, no markdown headers unless asked, no emoji. Answer in <=60 words unless the task requires more.
> Minimize round-trips: batch independent tool calls; never re-read or re-verify what you just wrote; when the task is done, stop.

Standing cost: ~58 tok/request of prefix — already included in the measured suite numbers.

## Iteration log (8 of 10 budget used)
| iter | idea | suite | out | reqs | checks | decision |
|---|---|---:|---:|---:|---|---|
| 0 | baseline | 70,657 | 2,347 | 33 | pass | keep (reference) |
| 1 | terseness 60w | 72,964 / 66,850 | 1,910 / 1,916 | 34 / 31 | pass | keep (out −18.5% stable) |
| 2 | +turn-economy | 68,753 | 1,798 | 32 | pass | provisional keep |
| 3 | sharp 30w | 57,785 | 1,569 | 27 | **FAIL** | discard (canary) |
| 4 | 30w + exemption | 77,208 | 2,148 | 35 | pass | discard (diluted) |
| 5 | mild-sharp 60w + restate/recap ban + turn-economy | 57,740 / 59,362 | 1,620 / 1,285 | 27 / 25 | pass ×2 | **KEEP — winner** |

## Mechanisms (evidence-backed)
1. **Short directives beat hedged ones.** iter4's longer, carefully-exempted phrasing lost
   most of the effect (out −8% vs −31%). Verbose guardrails dilute instruction-following.
2. **Canaries earn their keep.** iter3 was the best metric result (−18%) AND a quality
   failure (skipped a required task step). Metric-only optimization would have shipped it.
3. **Turn count is partly phrasing-bound after all** — but via *output* phrasing, not
   round-trip instructions: the dedicated turn-economy sentence (iter2) left reqs flat;
   the "no recap / when done, stop" combination landed at −21% reqs in iter5. Attribution
   between the two sentences is not clean — the winning combination is kept as a unit.
4. **T2 (read+summarize) is noise-dominated**: +22% across ALL variants including ones that
   improved everything else. Do not read into per-tier swings; suite medians only.
5. **glm-5.2 sentence-cases first tokens of generated content** ("Test1.txt", "Function add")
   — a model quirk, not config-driven. The T1 canary is case-insensitive because of it.

## Method notes for future campaigns
- Variant dir via `PI_CODING_AGENT_DIR` + pi-lean-ctx #930 doubled-`agent` workaround (build-variant.sh).
- HARD RULE kept: all traffic through the capture proxy; never direct Lilac (cache undercounting).
- measure.sh bugs fixed this run: pkill-under-`set -e` silent death; capture-dir rm ordering;
  proxy port race (wait_free/wait_listen); lean-ctx 120s cap ⇒ background wrapper (run-measure.sh).
- Per-iteration cost: ~6 lanes × ~20s, ≈ 100–140K face tokens (mostly cached).

## Next candidates (not pursued; budget exhausted)
- Negative control (measurement sensitivity validation).
- A non-trivial-task suite that actually loads ce-lite SKILL.md, to target its phrasing.
- Model-dependent terseness response (does the winner transfer to kimi-k2.6/k3?).
