# 04 — orchflows, super-pi, pi-dynamic-workflows primitives

**Ticket:** 04  
**Date:** 2026-07-27  
**Primaries:** local clones / installed package READMEs.

## super-pi (`@leing2021/super-pi`)

Sources: GitHub README; `docs/token-cost-evaluation.md`.

| Primitive | Detail |
|-----------|--------|
| Five-step loop | brainstorm → plan → work → review → learn (+ next, worktree) |
| Auto skill routing | User describes intent / says continue; stage skills recommended |
| Artifacts | Requirements, plan units, checkpoints, review findings, learned patterns |
| Tools | Stage-specific tools (brainstorm_dialog, plan_diff, review_router, pattern_extractor, …) |
| Token cost | ~**4,130** fixed tokens new conversation (v0.24 eval); skills ~1.7k + tools ~2.4k |
| Progressive loading | Claimed; still pays 17 skill descriptions + 22 tools always-on |

**Steal:** single loop, continue-to-advance, compound/learn stage, published token budget discipline.  
**Avoid:** full 17-skill + 22-tool always-on if we need *thinner* than ~4k; heavy TDD-gated dev assumptions for non-dev operator.

## orchflows (DanMcInerney)

Sources: README; `rules/token-economy.md`, engines/compositions layout.

| Primitive | Detail |
|-----------|--------|
| Engines | frontier, loop, panel, task — reusable runtime verbs |
| Compositions | Named multi-step plays (delivery-loop, evolve, skill-tournament, …) |
| Token economy rules | Delete no-op sentences; progressive refs; mechanize repeated steps; multi-agent premium only for glue |
| Contracts | delegation, verdict, work-item, worklog |
| Platform | Built for Claude/Codex-class agents — **not Pi-native** |

**Steal:** token-economy rules almost verbatim for skill authoring; engine vs composition split; verification/delegation contracts.  
**Avoid:** bulk port; Claude-specific packaging.

## pi-dynamic-workflows (`@quintinshaw/pi-dynamic-workflows`)

Sources: installed package README under npm; pi.dev package page.

| Primitive | Detail |
|-----------|--------|
| One prompt → JS orchestration script | `agent()`, `parallel()`, `pipeline()`, `phase()` |
| Fan-out | Up to 16 concurrent / 1000 total subagents |
| Model tiers | `small` / `medium` / `big` (+ exact model) |
| Resume | Journaled; edit script and replay unchanged agents |
| Trigger | Keyword **workflow(s)** or `/workflows run` — still answers plain Qs without forcing fanout |
| Herd | Native Pi package; real parallel orchestration |

**Steal:** closest to Claude-like “just knows” **on Pi**; automatic subagent fanout; tiered models; resumability.  
**Watch:** always-on schema cost of workflow tools (must probe); keyword false positives (docs claim bounded trigger).

## Comparison → Pi-native analogue

| Mechanism | Donor | Pi analogue / gap |
|-----------|-------|-------------------|
| Single operator loop | super-pi / CE | **Gap:** need one entry; matt is many entries |
| Auto stage routing | super-pi | dynamic-workflows phases **or** one meta-skill |
| Parallel specialists | dyn-workflows / pi-subagents | dyn-workflows or pi-subagents (not in live packages) |
| Side thread UX | herdr-btw | installed live |
| Token economy doctrine | orchflows | authoring rules for our thin skills |
| Contracted AFK exec | glla goal/list/loop | installed live; maybe internalize |
| Minimal one-shot delegate | delegate.ts | live; fails full multi-agent bar alone |
| Compound learnings | CE / super-pi learn | **Gap:** no first-class compound store yet |

## Recommendation sketch (for grilling 08 — not decided)

**Option ranking for research only:**

1. **pi-dynamic-workflows as orchestrator spine** + thin CE-lite phase templates + glla internalized for long contracts + herdr-btw for human side questions — strongest “just knows” on Pi.  
2. **super-pi** if willing to pay ~4k fixed and accept more dev-shaped stages — still thinner than full CE, thicker than ideal.  
3. **Compose glla + pi-subagents + one router skill** — more DIY, more gates risk.  
4. **delegate only** — fails capability bar (no real review fanout / tiers).

**Default research lean:** (1), subject to probe token ceiling and herdr compatibility check in ticket 05/07/08.
