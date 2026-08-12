#!/usr/bin/env python3
import json
from pathlib import Path

root = Path("/home/alex/.pi/agent/.pi/better-harness/_run")

def load(path):
    return json.loads(Path(path).read_text())

# Map discovered handoff paths
sources = {
    "project-harness": root / "pass-a-handoff.json",
    "session-evidence": root / "handoff-session.json",
    "agent-customize": root / "pass-c-handoff.json",
}

for agent_id, path in sources.items():
    data = load(path)
    # Normalize agentId
    data["agentId"] = agent_id
    data.setdefault("schemaVersion", 1)
    data.setdefault("status", "ok")
    data.setdefault("findings", [])
    data.setdefault("dimensionScores", data.get("scores") or [])
    # Normalize dimensionScores from alternate shapes
    if not data.get("dimensionScores") and data.get("dimensions"):
        dims = []
        for d in data["dimensions"]:
            if isinstance(d, dict):
                dims.append({
                    "id": d.get("id") or d.get("dimension") or d.get("name"),
                    "score": d.get("score", 0),
                    "max": d.get("max", 10),
                    "rationale": d.get("rationale") or d.get("reason") or "",
                })
        data["dimensionScores"] = dims
    # Normalize findings ids/fields
    norm_findings = []
    for i, f in enumerate(data.get("findings") or [], 1):
        if not isinstance(f, dict):
            continue
        fid = f.get("id") or f"{agent_id[:2].upper()}-{i:03d}"
        ev = f.get("evidence") or f.get("evidenceRefs") or []
        if isinstance(ev, str):
            ev = [ev]
        norm_findings.append({
            "id": fid,
            "title": f.get("title") or f.get("name") or fid,
            "severity": (f.get("severity") or f.get("priority") or "medium").lower(),
            "dimension": f.get("dimension") or f.get("dimensionId") or "unspecified",
            "summary": f.get("summary") or f.get("description") or f.get("detail") or "",
            "evidence": ev,
            "impact": f.get("impact") or "",
            "fixDirection": f.get("fixDirection") or f.get("recommendation") or f.get("fix") or "",
            "confidence": (f.get("confidence") or "medium").lower(),
            "sourceAgent": agent_id,
        })
    data["findings"] = norm_findings
    data.setdefault("topActions", data.get("actions") or [])
    data.setdefault("evidenceGaps", data.get("gaps") or [])
    data.setdefault("blockedReason", None)
    out = root / f"handoff-{agent_id}.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print("wrote", out, "findings", len(norm_findings), "status", data.get("status"), "dims", len(data.get("dimensionScores") or []))

# print quick inventory of severities
for agent_id in sources:
    data = load(root / f"handoff-{agent_id}.json")
    sev = {}
    for f in data["findings"]:
        sev[f["severity"]] = sev.get(f["severity"], 0) + 1
    print(agent_id, "sev", sev)
    print(" titles:", [f["title"] for f in data["findings"][:12]])
