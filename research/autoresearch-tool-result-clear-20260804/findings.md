# Closed: Acted-on tool-result CLEAR (2026-08-04)

**Status:** CLOSED and shipped to `master` (`8aae137` pruner + docs).  
**Live:** `~/.pi/agent/extensions/transcript-pruner.ts` (default ON).

## Objective
Cut long-session input cost from **uncleared spent tool outputs** without
hurting task success or the always-on probe floor. Extend existing
`transcript-pruner.ts` only (no new package).

## Grounding
- Harness survey item 4: toolResult ≈ p50 49% of context bytes; 98.7% of large
  tool outputs reached the model uncleared.
- Prior pruner A/B: DEDUP + STALE only (−15.7% billed on an earlier bench/day).
- Gap analysis: two-phase tool loading **not** justified at ~22 tools.

## Method
- Bench: `bench/measure-pruner.sh` (dup reads + read-then-edit + write).
- Primary: median `totalInputTokens` (3–5 runs).
- Secondary: `tokens_per_request` (added during campaign — more stable than total
  when turn count varies), `checks_pass`.
- Model: live Venice / grok-4-5 (directional; model-agnostic harness change).

## Results (5-run medians, fair OFF vs default)

| Condition | totalInputTokens | tokens/request | checks |
|-----------|------------------|----------------|--------|
| OFF (`PI_TRANSCRIPT_PRUNE=0`) | 93,855 | 7,219 | 5/5 |
| **Default ON** (DEDUP+STALE+CLEAR k=4) | **83,790 (−10.7%)** | **6,865 (−4.9%)** | 5/5 |

### k screen (tokens/request; total noisy via turn count)

| keep K | tpr (approx) | note |
|--------|--------------|------|
| 2 | lower tpr | **more turns** → worse net total |
| 3 | noisy | one lucky low-turn run |
| **4** | best tradeoff | **KEEP** |
| 6 | ≈ dedup+stale only | CLEAR barely fires |

## Shipped behavior
1. **CLEAR** — keep last `PI_PRUNE_KEEP` (default **4**) full-sized tool results;
   older large results → short `[cleared: …]` pointer.
2. **Default ON** — pruner runs unless `PI_TRANSCRIPT_PRUNE=0`.
3. DEDUP + STALE unchanged (still default on when pruner enabled).
4. Live settings extension path: `~/.pi/agent/extensions/transcript-pruner.ts`
   (not a git checkout path).
5. `bench/measure-pruner.sh` emits `tokens_per_request`.

## Rejected
- LLM summarization of tool results (cost + nondeterminism).
- New package / two-phase schemas.
- Leaving opt-in `PI_TRANSCRIPT_PRUNE=1` forever (compat flag soup).

## Do not re-run
Kernel token levers (tscg=5, slim, no MCP, no always-on web, CLEAR k=4) are
converged for current tool count. Next autoresearch only if tool surface grows
substantially or long-session pain reappears in production traces.

## Artifacts
- Code: `extensions/transcript-pruner.ts`
- Session copies: this directory (`prompt.md`, `log.jsonl`, `ideas.md`, …)
- Parent closed run (wrong git root): `research/autoresearch-token-efficiency-20260714/`
