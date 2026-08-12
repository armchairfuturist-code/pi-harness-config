#!/usr/bin/env python3
import json
from pathlib import Path

p = Path("/home/alex/.pi/agent/.pi/better-harness/_run/handoff-session-evidence.json")
raw = p.read_text()
print("bytes", len(raw))
d = json.loads(raw)
print("keys", sorted(d.keys()))
print("status", d.get("status"), "agentId", d.get("agentId"))
print("findings", len(d.get("findings") or []))
print("dimensionScores", d.get("dimensionScores"))
print("topActions", d.get("topActions"))
print("evidenceGaps", d.get("evidenceGaps"))
print("runtimeMetrics", d.get("runtimeMetrics") or d.get("metrics"))
for f in d.get("findings") or []:
    print("---")
    print(json.dumps(f, ensure_ascii=False, indent=2)[:2000])

# also dump compact for report
out = {
    "schemaVersion": d.get("schemaVersion", 1),
    "agentId": "session-evidence",
    "status": d.get("status", "ok"),
    "findings": d.get("findings") or [],
    "dimensionScores": d.get("dimensionScores") or d.get("scores") or [],
    "topActions": d.get("topActions") or d.get("actions") or [],
    "evidenceGaps": d.get("evidenceGaps") or [],
    "runtimeMetrics": d.get("runtimeMetrics") or d.get("metrics") or d.get("runtime") or {},
    "notes": d.get("notes") or d.get("summary") or "",
}
Path("/home/alex/.pi/agent/.pi/better-harness/_run/handoff-session-compact.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2)
)
print("wrote compact", len(json.dumps(out)))
