#!/usr/bin/env python3
import json, os
p = "/home/alex/.pi/agent/.pi/better-harness/_run/handoff-session.json"
d = json.load(open(p))
req = [
    "agentId",
    "ok",
    "errors",
    "coverage",
    "runtimeMetrics",
    "findings",
    "signals",
    "dimensionScores",
    "nextActions",
    "confidence",
    "assumptions",
    "openQuestions",
    "limitations",
    "evidenceRefs",
]
missing = [k for k in req if k not in d]
print("missing", missing)
print("agentId", d["agentId"])
print("ok", d["ok"])
print("findings", len(d["findings"]))
print("signals", len(d["signals"]))
print("dims", [(x["id"], x["score"], x.get("evidenceLevel")) for x in d["dimensionScores"]])
print("next", len(d["nextActions"]))
print("bytes", os.path.getsize(p))
assert d["agentId"] == "session-evidence"
assert d["ok"] is True
assert len(d["dimensionScores"]) == 5
assert d["coverage"]["selectedSessions"] == 12
assert not missing
print("OK")
