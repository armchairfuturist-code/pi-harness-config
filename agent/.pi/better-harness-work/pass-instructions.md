# better-harness evidence agents (re-audit after P0 fixes)

Work root: path in `/home/alex/.pi/agent/.pi/better-harness-work/LATEST`
Target: `/home/alex/.pi/agent`
Platform: pi | Locale: en | Depth: normal | Window: 2026-07-06..2026-08-05

## Already fixed (do NOT re-file as open P0 unless regression)
- skills denylist `!**` removed → now `["!**/last30days/**"]`
- HARNESS.md + AGENTS.md present; APPEND_SYSTEM tool policy tightened
- remote pi-harness-config master merged skills unlock
- gitignore/versioning improved on remote + local commits

## Goal
Find **remaining / new** harness improvements. Verify P0s held. Score dimensions honestly.

## Shared inputs (read only your packet + lead + domain refs)
- `packet-{project|session|architecture}.json`
- `lead-evidence.md`, `lead-summary.json`, `bundle-snapshot.json`
- Domain refs under better-harness package as listed per pass

## Output schema (write EXACTLY your handoff path)
```json
{
  "schemaVersion": 1,
  "agentId": "project-harness|session-evidence|agent-customize",
  "status": "ok|partial|blocked",
  "findings": [{
    "id": "XX-001",
    "title": "...",
    "severity": "critical|high|medium|low|info",
    "dimension": "...",
    "summary": "...",
    "evidence": ["..."],
    "impact": "...",
    "fixDirection": "...",
    "confidence": "high|medium|low",
    "regressionCheck": "fixed|still-open|new|n/a"
  }],
  "dimensionScores": [{"id":"...","score":0,"max":10,"rationale":"..."}],
  "topActions": [{"title":"...","priority":"P0|P1|P2","effort":"S|M|L","expectedEffect":"..."}],
  "evidenceGaps": ["..."],
  "blockedReason": null,
  "notes": ""
}
```
No report.md/html. Stop when handoff written.

---

### Pass A — project-harness
- Packet: `packet-project.json`
- Refs: skills/better-harness/references/project-harness.md + references/project-harness/
- Handoff: `$WORK/handoff-project-harness.json`
- Focus: docs/guidance quality now that AGENTS/HARNESS exist; gitignore/change-control residual; validation loops; drift vs remote layout (agent/ nest vs flat install root)

### Pass B — session-evidence
- Packet: `packet-session.json`
- Refs: skills/better-harness/references/session-evidence.md + references/session-evidence/
- Handoff: `$WORK/handoff-session-evidence.json`
- Sessions: `~/.pi/agent/sessions/` JSONL. **Verify** packet toolCall zeros with independent parse if needed.
- Focus: allowlist friction residual after policy docs; edit misses; long-session outcome review still open; post-fix sessions if any after 2026-08-05 06:56Z

### Pass C — agent-customize
- Packet: `packet-architecture.json`
- Refs: skills/better-harness/references/agent-customize.md + references/agent-customize/ + platforms/pi.md
- Handoff: `$WORK/handoff-agent-customize.json`
- Focus: skills enablement now (count loadable vs denied last30days); inventory still thin?; last30days size; package/extension dual paths; HARNESS vs AGENTS vs APPEND overlap; agents surface
