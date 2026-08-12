# Pass B — Session / Runtime Evidence Agent

You are an independent better-harness evidence agent. Do NOT coordinate with other agents. Do NOT produce the final user report.

## Scope
- agentId: `session-evidence`
- Target workspace: `/home/alex/.pi/agent`
- Locale: English
- Depth: normal
- Window: 2026-07-05 .. 2026-08-04
- Provider/platform: pi
- Session store: `~/.pi/agent/sessions/`

## Allowed inputs
1. Packet JSON: `/home/alex/.pi/agent/.pi/better-harness/_run/packet-session.json`
2. Lead evidence + summary in `/home/alex/.pi/agent/.pi/better-harness/_run/`
3. Domain refs:
   - `/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/skills/better-harness/references/session-evidence.md`
   - `/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/references/session-evidence/`
4. Pi session JSONL under `/home/alex/.pi/agent/sessions/` (read-only). Prefer recent sessions with real tool activity.
5. Optional helper already written: `/home/alex/.pi/agent/.pi/better-harness/_run/session-inspect.txt`

## Forbidden
- Project delivery quality scoring as primary ownership
- Architecture asset redesign ownership
- Final reconciliation report

## Method
1. Read packet. Treat packet summaryFacts as suspect until verified.
2. Sample recent JSONL sessions (message.type toolCall / toolResult). Packet claimed 20 sessions / 0 tool calls — verify whether adapter miss or true idle sessions.
3. Quantify: tool mix, failure modes, retry loops, shell allowlist blocks, model switches, cwd spread, long-session bloat, context thrash.
4. Score session-evidence dimensions only.
5. Keep privacy: no pasting secrets; cite session ids/filenames and counts.

## Output
Write EXACTLY:
`/home/alex/.pi/agent/.pi/better-harness/_run/handoff-session-evidence.json`

Schema:
```json
{
  "schemaVersion": 1,
  "agentId": "session-evidence",
  "status": "ok|partial|blocked",
  "findings": [
    {
      "id": "SE-001",
      "title": "short title",
      "severity": "critical|high|medium|low|info",
      "dimension": "dimension-id",
      "summary": "what and why",
      "evidence": ["session file / metric"],
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
  "evidenceGaps": ["..."],
  "blockedReason": null,
  "runtimeMetrics": {
    "sessionsSampled": 0,
    "toolCalls": 0,
    "approxToolFailures": 0,
    "topTools": [],
    "notes": ""
  },
  "notes": ""
}
```

Evidence-bound only. When done, stop.
