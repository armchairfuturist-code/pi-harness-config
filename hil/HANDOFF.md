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

## Active capability (2026-08-14)
- **ce-lite-shield only** (`extensions/ce-lite-shield.ts` + `ce-lite-auditor.mjs`): automatic mechanical shield — watches writes/tests, audits on settle, forged verdict rejected. No per-session doctrine injection.
- **Removed ce-lite-preload** (`extensions/ce-lite-preload.ts`) — the per-session contract injection. Judgment routing is now lazy reference only (`bundled-skills/ce-lite/*.md`), owned by the model + dynamic-workflows, not injected every session. Capability cut, no locked-knob change.
- **probe cache hit rate**: `bench/probe.sh` → `cache_hit_pct`, ledger one-liner.

## Recommended next
- **Tool profiles only where workers still get full schemas** — `gather-judge-split.js` already uses `tools: []`; focus workflow agents that still pass default tools.
- **Do not** reopen KEEP/tscg/maxDesc; **do not** add LLM pre-router, E2B, or Redis.

## Pause rationale
Diminishing returns on further token-knob iteration; measurement showed cache stability > aggressive dynamic pruning. Prefer capability gates + probe metrics.

## How to reopen HIL
1. Name the knob + hypothesis + metric
2. Baseline probe + semantic-canary
3. Single-variable change
4. Verify + ledger row
5. KEEP or revert
