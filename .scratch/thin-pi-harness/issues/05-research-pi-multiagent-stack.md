# 05 — Research: Pi multi-agent stack vs capability bar

Type: research
Status: resolved
Blocked by:

## Question

What multi-agent options exist for Pi today, and which clear our **capability bar + token ceiling**?

**Bar:**

1. Parent can fan out isolated work
2. Review/audit as separate agent
3. herdr-compatible **or** equivalent automatic subagent path for CE-lite stages
4. Always-on schema cost must remain compatible with ≥30% always-on win vs live baseline

Assess at least: `delegate.ts` (this repo), `pi-subagents`, `pi-herdr-btw` / herdr, goal-loop-audit isolated auditor, any other Pi packages in live settings or npm ecosystem that matter.

For each: tools exposed, always-on token/schema cost if known, herdr compatibility, AFK fitness, failure modes.

Output: `research/wayfinder/05-pi-multiagent-stack.md` with a short ranked shortlist for later grilling (no final pick required).

## Answer

Research complete. Artifact: [`research/wayfinder/05-pi-multiagent-stack.md`](../../../research/wayfinder/05-pi-multiagent-stack.md)

**Gist:** delegate alone fails bar. Shortlist: (1) dynamic-workflows + herdr-btw, (2) pi-subagents + herdr-btw. Must probe schema tokens before lock.
