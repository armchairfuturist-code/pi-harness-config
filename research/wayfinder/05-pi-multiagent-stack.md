# 05 — Pi multi-agent stack vs capability bar

**Ticket:** 05  
**Date:** 2026-07-27  

## Capability bar (locked)

1. Parent can fan out isolated work  
2. Review/audit as separate agent  
3. herdr-compatible **or** equivalent automatic subagent path for CE-lite  
4. Always-on schema cost compatible with ≥30% always-on win vs live baseline  

## Options assessed

### A. `delegate.ts` (live extension)

Source: `~/.pi/agent/extensions/delegate.ts` / repo copy.

| | |
|--|--|
| Tools | single `delegate` |
| Child tools | read/bash/grep/find/ls only |
| Schema cost | ~200 tok (file claim) vs ~3808 pi-subagents |
| Fan-out | manual parallel tool calls only; no first-class parallel API |
| Review agent | possible but crude |
| Herdr | no |
| Auto CE-lite | no |
| **Bar** | **FAIL** alone (3 weak, 1–2 weak) |

### B. `pi-herdr-btw` (live package)

Source: package README — Herdr side thread `/btw` style.

| | |
|--|--|
| Role | Human-launched side pane; doesn’t pollute parent transcript |
| Multi-agent orchestration | Not a full orchestrator |
| Herdr | **Yes** (primary value) |
| **Bar** | Partial — satisfies herdr UX; not automatic stage fanout |

### C. `pi-subagents` (in node_modules, **not** in live packages)

Source: package.json/README skill docs.

| | |
|--|--|
| Tools | rich `subagent` + slash fleet |
| Fan-out | parallel, chains, async, reviewers, workers |
| Schema cost | high (~3.8k claimed in delegate.ts comment) — **threat to token ceiling** |
| Herdr | separate concern |
| **Bar** | Capability **PASS**; token ceiling **RISK** |

### D. `@quintinshaw/pi-dynamic-workflows` (installed in npm, **not** live packages)

Source: README.

| | |
|--|--|
| Fan-out | first-class parallel agents + phases |
| Model tiers | small/medium/big |
| Auto path | keyword workflow / natural language |
| Resume | journaled |
| Herdr | not the same as herdr-btw; complementary |
| Schema cost | **unknown — must probe** |
| **Bar** | Capability likely **PASS**; token TBD |

### E. glla isolated auditor (`pi-goal-list-loop-audit`)

Source: live package; Explore agent managed by glla.

| | |
|--|--|
| Role | Contract verification in isolated session; goal/list/loop runtime |
| Fan-out | not general multi-agent |
| **Bar** | Strong for **audit** leg; not full orchestrator |

### F. `@ogulcancelik/pi-model-agents` (live)

Likely model/agent role helpers (pair with herdr ecosystem). Details thin in this pass — treat as supporting, not primary orchestrator.

## Shortlist for grilling (ranked)

| Rank | Stack | Why |
|-----:|-------|-----|
| 1 | **dynamic-workflows (+ optional herdr-btw)** | Best automatic “just knows” + tiers + fanout on Pi; keep herdr for human side Qs |
| 2 | **pi-subagents (+ herdr-btw)** | Proven delegation vocabulary; watch schema cost hard |
| 3 | **glla + thin subagent + herdr** | Good AFK contracts; weaker single-entrypoint UX |
| 4 | delegate only | Reject as primary |

**Kill/replace candidate:** standalone `delegate.ts` once a fuller stack is chosen — keep only if dyn-workflows/subagents fail probe budget.

## Measurement required before lock
- Probe always-on tokens: live baseline vs +dynamic-workflows vs +pi-subagents vs both  
- Confirm herdr-btw coexists with chosen orchestrator without double-paying huge schemas  
