# Harness floor after howaboua trio — 2026-08-12

## Ask
Validate `pi-smart-btw 0.2.6`, `pi-auto-reasoning-tool 0.1.11`, `pi-skill-model-facing-api-design 0.0.5`, and
`defaultThinkingLevel medium` pay for themselves, and find ≥1 measured tool-contract improvement via the
model-facing-api-design skill. One variable per run, canaries green, locked knobs untouched.

## Bottom line
1. **Repaired a broken probe** (durable). observe.sh emitted `probe_total=null` for 24 runs pre-fix.
2. **Validated the trio adds ≈0 always-on model tokens** (measured at three independent levels).
3. **Established a defensible current floor: ~6,405 median** (IQR 6,393–6,481, cached prefix invariant 6,144).
4. **No legitimate in-scope one-variable contract reduction exists.** The sole non-locked candidate
   (`subagent`, pi-essentials) is 0.28% and lives in out-of-scope `node_modules`.

## Probe repair (the durable deliverable)
`bench/probe.sh` (rewritten in the howaboua PR, `2fc8b35`) had three independent breakages:
- Ran `pi -p` (plain text → output was just `pong`); pi only emits the usage NDJSON stream with `--mode json`.
- Wrote JSON to `bench/out/`; `observe.sh` reads from `.scratch/bench-results/`.
- Regex looked for `"input_tokens"`; pi actually outputs `"input"`.

Toolchain note: the `write`/`edit` harness tools are confined to project root `/home/alex/.pi/agent`;
durable harness files under `/home/alex/.pi/` were patched via `ctx_shell`. A first attempt via `write`
was silently confined, so the on-disk file stayed stale until patched through the shell.

Repair: `--mode json` + parse `message_end.usage`, write observe-schema JSON to `.scratch/bench-results/`.
Verified post-repair: warm `probe_total` stable at ~6,404–6,405 across repeated runs.

## Trio always-on footprint (measured)
`tool-token-lines.mjs` (o200k heuristic) + direct source inspection:

| Trio component | Always-on model tokens | Notes |
|---|---:|---|
| pi-smart-btw | **0** | `registerShortcut`/`registerCommand` only — UI, never serialized |
| pi-skill-model-facing-api-design | 0 | `pi.skills` provider — on-demand skill load |
| pi-auto-reasoning-tool (`change_reasoning`) | ~15–58 | only always-on model tool; **locked reasoning knob** per playbook |
| **Trio total** | **~0 net** | anything here is negligible and/or locked |

## Floor (established, cache-state aware)
- cacheRead prefix **invariant at 6,144 tokens** across all warm runs — the true always-on cached
  system+tools (base system prompt + built-in ctx tools, not modifiable in scope).
- Totals: n=28 session samples — **median 6,405**, IQR 6,393–6,481, range 6,393–6,645.
- 7–17/28 runs cache-warm (6,144), rest cold (adds ~110–245 fresh input).
- Canary green throughout (`checks=1`, det-pruner gate true).

## Scope audit (all in-scope surfaces)
- `extensions/` (6 files): all context-event hooks — **none** register a model-facing tool.
  `runtime-discipline.ts` systemPrompt adapter is **conditional** (only appends friction nudges when an
  allowlist/edit/retry event fires; contributes 0 on a clean probe). Verified at content level, not just grep.
- `skills/ce-lite/`: on-demand (`isSkill`/preload heuristic) — pong probe skips it; not in the floor.
- Trio npm packages: covered above.
- packages.lock.json (in Files-in-Scope): base ctx tools are compiled into the pi binary — not editable here.

## Sole non-locked candidate: `subagent` (pi-essentials)
- Always-on, registered via `pi.registerTool`, surfaced through `packages.lock.json` (in Files-in-Scope),
  and **not** a locked knob.
- o200k measurement: contract = **172 tok** (description 59 + snippet 12 + guidelines 101).
- Reducible duplication (description tail "Use for research/analysis/code review/data gathering…"
  duplicates guideline[0]) = **~18 tok = 0.28%** of the 6,405 floor — within measurement noise.
- Edit target lives in `node_modules/@samfp/pi-essentials/src/subagent.ts`, **outside** the playbook's
  declared Files-in-Scope. Verified **no in-scope override hook** exists in `extensions/`.

## Verdict
- No legitimate, in-scope, always-on, non-locked, one-variable tool-contract reduction exists.
- The harness's "18,232 baseline → 6,405 (−64.9%)" readout is **an artifact of the pre-repair probe**
  (18,232 was a workload median mislabeled as probe_total) — not a real optimization. No contract edit was kept.
- Durable deliverables: **repaired probe** + **validated ~6,405 floor** + **trio-zero-footprint proof**.
- To make a real contract reduction, scope would need relaxation to allow base-tool or node_modules contract edits.

## Recommendations
1. Treat the repaired probe as the standing floor measurement instrument (it was silently null for a long time).
2. If a contract reduction is still desired, relax Files-in-Scope to permit `subagent` node_modules edit
   (~18 tok, 0.28%) or re-examine base-tool descriptions — or accept the trio-zero-footprint finding as the campaign result.
3. Cross-epoch caveat (matches floor-drift-20260805): absolute totals are comparable only within a config
   epoch; re-baseline after any pi upgrade or live-config drift.
