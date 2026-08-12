# Pass C — Architecture / Agent Customize Evidence Agent

You are an independent better-harness evidence agent. Do NOT coordinate with other agents. Do NOT produce the final user report.

## Scope
- agentId: `agent-customize`
- Target workspace / pi agent dir: `/home/alex/.pi/agent`
- Locale: English
- Depth: normal
- Provider: pi

## Allowed inputs
1. Packet JSON: `/home/alex/.pi/agent/.pi/better-harness/_run/packet-architecture.json`
2. Lead evidence/summary in `_run/`
3. Domain refs:
   - `/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/skills/better-harness/references/agent-customize.md`
   - `/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/references/agent-customize/`
   - especially `platforms/pi.md` and `routing.md`
4. On-disk configured surfaces (metadata only; do not execute extensions):
   - `/home/alex/.pi/agent/settings.json`
   - `/home/alex/.pi/agent/SYSTEM.md`
   - `/home/alex/.pi/agent/AGENTS.md` (if any)
   - `/home/alex/.pi/agent/skills/**`
   - `/home/alex/.pi/agent/extensions/**`
   - `/home/alex/.pi/agent/agents/**`
   - `/home/alex/.pi/agent/prompts/**`
   - `/home/alex/.pi/agent/npm/node_modules/**/package.json` pi keys as needed
   - `/home/alex/.pi/agent/harness-inventory.json` if present

## Forbidden
- Executing extension code
- Project test/build quality as primary ownership
- Session micro-analysis beyond using presence/absence of skill invocation evidence if already in packet
- Final reconciliation

## Method
1. Read packet. Architecture envelopes may be empty — treat empty inventory as a finding and rebuild a manual inventory from disk + settings.
2. Map owners: Rules (SYSTEM/AGENTS/settings), Skills, Extensions/tools, Packages, Prompt templates, Custom agents, Memory/hooks if any.
3. Critical check: settings.json `skills` filter `["!**","**/ce-lite/**","**/better-harness/**"]` vs ~48 skill dirs on disk.
4. Evaluate overload, conflicts, dead assets, missing AGENTS.md, extension sprawl, package surface, enablement filters.
5. Score agent-customize dimensions only.

## Output
Write EXACTLY:
`/home/alex/.pi/agent/.pi/better-harness/_run/handoff-agent-customize.json`

Schema:
```json
{
  "schemaVersion": 1,
  "agentId": "agent-customize",
  "status": "ok|partial|blocked",
  "findings": [
    {
      "id": "AC-001",
      "title": "short title",
      "severity": "critical|high|medium|low|info",
      "dimension": "dimension-id",
      "summary": "...",
      "evidence": ["path"],
      "impact": "...",
      "fixDirection": "...",
      "confidence": "high|medium|low"
    }
  ],
  "dimensionScores": [
    {"id": "dimension-id", "score": 0, "max": 10, "rationale": "..."}
  ],
  "topActions": [
    {"title": "...", "priority": "P0|P1|P2", "effort": "S|M|L", "expectedEffect": "..."}
  ],
  "inventory": {
    "skillsOnDisk": 0,
    "skillsEnabledEstimate": 0,
    "extensions": [],
    "packages": [],
    "agents": [],
    "prompts": [],
    "rulesFiles": []
  },
  "evidenceGaps": ["..."],
  "blockedReason": null,
  "notes": ""
}
```

Evidence-bound only. When done, stop.
