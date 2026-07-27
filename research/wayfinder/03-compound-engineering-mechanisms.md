# 03 — Compound Engineering mechanisms + upstream radar seeds

**Ticket:** 03  
**Date:** 2026-07-27  
**Primaries:** EveryInc compound-engineering-plugin CONCEPTS + workflow docs; Pi as conversion Target.

## What CE is (mechanisms worth stealing)

Sources:
- https://github.com/EveryInc/compound-engineering-plugin/blob/main/CONCEPTS.md
- https://github.com/EveryInc/compound-engineering-plugin (plugin README / workflow)

### Steal for CE-lite

| Mechanism | Why it fits non-dev AFK |
|-----------|-------------------------|
| **Plan → Work → Review → Compound** loop | Clear stages without user naming each skill |
| **Skills orchestrate; agents execute** | User invokes one Skill; specialists are subagents with skill-local prompts |
| **Specialist prompt assets** (not dozens of user-facing agents) | Keeps operator surface small |
| **Compound = capture reusable knowledge** | Learnings become assets for next unit — matches “get smarter over time” |
| **Plugin as bundle** with install manifest | Clean install/uninstall story if we ever vendor a thin pack |
| **Pi is an explicit Target** in CE conversion vocabulary | Upstream may ship Pi-native outputs — radar-worthy |

### What makes full CE heavy (do not bulk-import)

- Large skill/agent/command/hook surface designed for Claude Code density
- Converter/Writer/marketplace machinery irrelevant to running thin Pi day-to-day
- Many specialist prompts and review agents → description + orchestration tax
- Dev-centric assumptions (PRs, code review culture) unless filtered for non-dev operator

## Non-dev fit

CE’s *user-facing* skill-as-orchestrator model is right. CE’s *volume* of skills/commands is wrong for token budget.  
**CE-lite = one orchestrator skill/workflow + few internal specialist prompts + compound artifact store.**

## Upstream radar seed (for ticket 11 to lock)

Suggested artifact path: `research/ce-upstream-radar.md`

### Watch
| Repo / path | Why |
|-------------|-----|
| `EveryInc/compound-engineering-plugin` root + `plugins/compound-engineering/` | Core loop, skills, agents |
| `CONCEPTS.md`, workflow docs, `skills/ce-compound*` | Compound semantics drift |
| Pi Target / converter paths if present under repo | Native Pi install surface |
| Releases / CHANGELOG | Adopt triggers |

### Adopt / adapt / ignore criteria (draft)
- **Adopt** into CE-lite only if: reduces operator gates, clears multi-agent bar, and probe delta is neutral/negative always-on tokens
- **Adapt** if: mechanism is right but Claude-specific (rewrite to Pi tools/workflows)
- **Ignore** if: marketplace/converter chrome, extra review personas, or skill sprawl without AFK gain

### Cadence (draft for grill)
- Monthly quick diff, or when friction appears in CE-lite stages
- Log: date, upstream ref, decision (adopt/adapt/ignore), one-line reason

## Implications for destination
- Compound stage must write **searchable artifacts** (notes/patterns), not only chat residue
- Do not install full CE plugin as runtime
- Radar is a doc, not a bot (destination already locked)
