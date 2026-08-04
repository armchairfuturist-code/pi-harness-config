# Autoresearch: Acted-on tool-result clearing

## Objective
Cut **long-session input tokens** by clearing tool results the model has already
acted on — without hurting task success or the always-on probe floor (≤4400).

Grounding (repo research + 2026 harness consensus):
- `research/harness-survey-actions-20260730.md` item 4: toolResult = p50 49% of
  context bytes; **98.7% of big tool outputs reach the model uncleared**.
- `extensions/transcript-pruner.ts` already does DEDUP + STALE (−15.7% billed on
  pruner bench) but leaves spent large outputs intact once the assistant moves on.
- Frontier (cutting-edge gap analysis): continuous light compaction / response
  filtering — implement the **simplest layer** that works end-to-end (AGENTS.md):
  extend the existing pruner, do not add a second parallel system.
- Do **not** pursue two-phase tool loading at 22 tools (gap analysis: marginal).
- Do **not** churn APPEND_SYSTEM / tscg (cache-prefix + measured optimum).

## Metrics
- **Primary**: `totalInputTokens` (lower better) — median of 3 runs of
  `./.auto/measure.sh` (pruner multi-read/edit workload).
- **Secondary**:
  - `checks_pass` (1/0) — fixture files correct after task
  - `probe_total` — `./bench/probe.sh` must stay ≤ 4400
  - `requests` — turn count (watch extra round-trips)

## How to Run
```bash
./.auto/measure.sh          # primary + checks
./bench/probe.sh            # kernel floor
```
Emit `METRIC name=value` lines. After any settings change, discard the first
warm-up invoke (known +~35% artifact).

## Files in Scope
- `extensions/transcript-pruner.ts` — add CLEAR (acted-on) mode; remove env
  opt-in gate once proven (AGENTS: no compatibility layers)
- `install.sh` — only if install path must change
- `settings.json` — only to point extensions at vendored
  `~/.pi/agent/extensions/transcript-pruner.ts` (not absolute Projects path)
- `bench/measure-pruner.sh` / `.auto/measure.sh` — measurement only
- `README.md` / `docs/pi-configuration.md` — after a kept win, document once

## Off Limits
- `tscg.json` (aggressiveMaxDescChars=5 locked)
- `APPEND_SYSTEM.md` / `skills/ce-lite/**` prompt churn
- Adding packages or MCP
- Two-phase/lazy tool schema routers
- Editing `npm/node_modules` package sources
- Backward-compat shims, lingering feature-flag soup after keep

## Constraints
- AGENTS.md: simplest full solution; modular; no stopgaps; remove obsolete paths
- Task success hard gate (`checks_pass=1` or discard)
- Probe total ≤ 4400 or discard
- Prefer extending transcript-pruner over a new extension
- Measure via repo bench when possible (Lilac/GLM probe path)

## Avenues (ordered)
1. **Baseline** — pruner OFF vs ON (current DEDUP+STALE) on measure.sh
2. **CLEAR mode** — after assistant used a tool result, replace older result
   bodies with short pointers; keep last K tool results full (tune K)
3. **Default ON** — drop `PI_TRANSCRIPT_PRUNE` gate; always prune
4. **Shell-output caps** — clear large ctx_shell/bash results after N turns
5. **Dead end** — if CLEAR forces re-reads that exceed savings, discard + document


## What's Been Tried
- Closed prior: `research/autoresearch-token-efficiency-20260714/` (config-only)
- transcript-pruner A/B historically: DEDUP+STALE −15.7% (different model/day)
- **This campaign (2026-08-04, Venice/grok-4-5, 5-run medians):**
  - OFF: total 93855, tpr 7219
  - DEFAULT ON DEDUP+STALE+CLEAR k=4: total 83790 (−10.7%), tpr 6865 (−4.9%), checks 5/5
  - k=2: lower tpr but more turns (net total worse)
  - k=3: noisy; one lucky low-turn run
  - k=6: ≈ dedup+stale only
- **KEEP:** CLEAR keep=4, pruner default ON (`PI_TRANSCRIPT_PRUNE=0` to disable)

## Success
Beat baseline on totalInputTokens with checks_pass=1 and probe_total≤4400.
Ship as single pruner behavior (no permanent flag soup).
