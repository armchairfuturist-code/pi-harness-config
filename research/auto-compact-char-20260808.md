# Auto-compaction characterization — 2026-08-08 (Iter 13)

**Observe only.** No HIL unlock of `reserveTokens` / `keepRecentTokens` / KEEP.

## Formula (pi-coding-agent `compaction.js`)

```
shouldCompact(contextTokens, contextWindow, settings) =
  settings.enabled && contextTokens > contextWindow - settings.reserveTokens
```

`keepRecentTokens` is **not** in the trigger. It only sizes the retained tail via `findCutPoint` when a compact actually runs.

## Locked vs upstream default

| | reserveTokens | keepRecentTokens |
|--|---------------|------------------|
| Locked (`~/.pi/agent/settings.json`) | **24000** | **20000** |
| Upstream `DEFAULT_COMPACTION_SETTINGS` | 16384 | **20000** (same) |

## Primary model — Lilac `zai-org/glm-5.2`

| | value |
|--|-------|
| contextWindow | **524288** |
| Trigger (locked) | tokens **> 500288** (95.4% of window) |
| Trigger (upstream default reserve) | tokens **> 507904** |
| Shift from locking reserve 16k→24k | fires **7616 tokens earlier** (~1.5% of window) |

Venice `e2ee-glm-5-2-p` same 524288 window. Venice `zai-org-glm-5-2` reports **1_000_000** → trigger > 976000.

## Live grow (bash-only RPC)

`node bench/auto-compact-char.mjs --live --chunks 6 --chunk-bytes 12000`

- context tokens after grow: **~18k**
- tokens until trigger: **~482k**
- compaction events: **0**
- wouldFire: **false**

Matches expectation: normal sessions never approach 500k.

## Verdict

- **Do not unlock** reserve or keepRecent without a smaller-window model or measured OOM/truncation.
- Day-to-day pressure levers remain: KEEP=4 pruner, TSCG strip/maxDesc, system prompt size.
- Artifact: `.scratch/bench-results/iter13-auto-compact-char.json`
- Harness: `bench/auto-compact-char.mjs` (offline always; `--live` optional)

## Self-check

`shouldCompact(500288, 524288, {reserve:24000}) === false`  
`shouldCompact(500289, 524288, {reserve:24000}) === true` → **PASS**
