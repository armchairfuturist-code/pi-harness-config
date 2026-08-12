# Pi ecosystem: auto-reasoning + auto-routing (2026-08-12)

Question: is there a more advanced pi-compatible skill than patched `pi-auto-reasoning-tool` that auto-raises thinking or auto-routes models/providers?

## Already in this harness

| Mechanism | What it does | Auto? |
| --- | --- | --- |
| `model-thinking.json` + `defaultThinkingLevel` | Per-model / global floor | No (static pin) |
| `@howaboua/pi-auto-reasoning-tool` | Agent tool `change_reasoning` (low/medium/high) | No (agent-called) |
| Harness AR patch | Keyword/length score at `agent_start` → high/xhigh/max; restore on settle | Yes (raise-only) |
| ce-lite `model-tiers.json` | Workflow workers: small/medium/big model IDs | Yes (workflow only) |
| `/model`, `/think` | User slash commands | No |
| harness-doctor `provider_ops.py` | Provider health / key / failover **ops** | No (not per-request) |

HIL already rejected an LLM pre-router. Upstream AR warns that mid-session level switches miss the prompt cache.

## What exists on npm (pi-package)

**Thinking level**
- `@howaboua/pi-auto-reasoning-tool` �� you already have this. Upstream is **not** automatic; your patch is the auto part.
- `pi-model-control` — `/variants` and `/thinking`. User commands, not auto.
- `@feniix/pi-sequential-thinking` — staged “think step N” (also MCP). Does not change thinking level or model.
- `@99percentpeople/pi-thinking-fold` — UI fold for reasoning blocks.
- `pi-loop-police` — **stops** runaway thinking. Opposite of raise.

**Model / provider routing**
- `pi-smart-router` (HyDRA) — only real auto-router. Session-pin + per-request specialist + zero-tier + `streamSimple`. Routes **models** (local/cheap/mid/frontier), not thinking levels. Extra LLM call per turn. Fights ce-lite tiers + thinking pins + AR. Same class HIL already blocked.
- `@oh-my-pi/pi-catalog` — catalog, not a router.
- `pi-background-tasks` — parallel/fusion helpers, not a live router.

No package found that does provider failover mid-request, or that auto-caps thinking by measured canary.

## Verdict

Nothing more advanced is worth installing. The only auto-router (`pi-smart-router`) is an LLM pre-router you already rejected. The only auto-think-raiser is your AR patch, which on this pin table spends more than it saves.

Keep explicit pins + ce-lite tiers. Leave AR off (or cap `PI_AUTO_REASONING_MAX=high` if you insist on a safety net).
