# HIL HANDOFF

**Status:** PAUSED for compaction/KEEP/tscg knob churn (2026-08-10)  
**Allowed without reopen:** capability extensions, measurement/bench, docs, skill copy that does not touch locked knobs.

## Locked knobs
| Knob | Value | Notes |
|------|-------|-------|
| KEEP | 4 | |
| reserveTokens | 24000 | |
| keepRecentTokens | 20000 | |
| tscg strip | on | |
| maxDescChars | 20 | KEEP — do not reopen without canary + A/B |

## Active capability (2026-08-10)
- **ce-lite-preload** (`extensions/ce-lite-preload.ts`): deterministic turn-1 contract inject via custom message (not systemPrompt — H4-safe). Heuristics mirror APPEND_SYSTEM non-trivial triggers. Env: `CE_LITE_PRELOAD=0|1|force`.
- **probe cache hit rate**: `bench/probe.sh` → `cache_hit_pct`, ledger one-liner.
- **semantic-canary**: preload H4/heuristic unit tests + optional `CE_SESSION_JSONL` efficiency soft signal.

## Recommended next
- **A/B ce-lite-preload** with suite / live sessions: skill_loaded turn index should drop toward 1 on multi-step prompts; s6 trivial skip must stay 0 preload (or harmless). Compare cache_hit_pct pre/post via probe (system prefix unchanged → no H4 regression expected).
- **Tool profiles only where workers still get full schemas** — `gather-judge-split.js` already uses `tools: []`; focus ce-lite/workflow agents that still pass default tools.
- **Do not** reopen KEEP/tscg/maxDesc; **do not** add LLM pre-router, E2B, or Redis.

## Pause rationale
Diminishing returns on further token-knob iteration; measurement showed cache stability > aggressive dynamic pruning. Prefer capability gates + probe metrics.

## How to reopen HIL
1. Name the knob + hypothesis + metric
2. Baseline probe + semantic-canary
3. Single-variable change
4. Verify + ledger row
5. KEEP or revert
