# 02 — Research: minimal harness & context engineering

Type: research
Status: resolved
Blocked by:

## Question

What do primary sources and a **brief** review of latest research say are best practices for **minimal** agent harnesses (Pi-class: thin system prompt, essential tools, tool/skill search, progressive disclosure, overlays)?

Cover:

1. Progressive disclosure / tool-context co-location with tool definitions
2. Always-on vs runtime-discoverable tools/skills
3. Prompt caching implications for stable vs churning always-on prefixes (align with this repo's existing progressive-disclosure findings)
4. Brief academic/industry notes on minimal harnesses / agent scaffolding efficiency (prefer 2024–2026; cite primaries; no endless lit review)
5. Concrete design implications for a non-dev CE-lite Pi harness with ≥30% always-on cut target

Output: `research/wayfinder/02-minimal-harness-context-engineering.md` with claims → source links and a short "implications for our destination" section.

## Answer

Research complete. Artifact: [`research/wayfinder/02-minimal-harness-context-engineering.md`](../../../research/wayfinder/02-minimal-harness-context-engineering.md)

**Gist:** Anthropic progressive disclosure + MCP tool-bloat primaries; local PD findings say keep stable cached prefix and cut schema/skill counts. ≥30% win should come from cull, not prompt churn.
