#!/usr/bin/env python3
import json
from pathlib import Path
root = Path("/home/alex/.pi/agent/.pi/better-harness/_run")
proj = json.loads((root/"packet-project.json").read_text())["data"]
print("PROJECT SUMMARY")
print(json.dumps(proj.get("summary"), ensure_ascii=False, indent=2)[:4000])
print("PROJECT PROFILE")
print(json.dumps(proj.get("projectProfile"), ensure_ascii=False, indent=2)[:3000])
print("CORE ANALYSIS keys", sorted((proj.get("coreAnalysis") or {}).keys()))
print(json.dumps(proj.get("coreAnalysis"), ensure_ascii=False, indent=2)[:5000])
print("CHANGE DRIFT")
print(json.dumps(proj.get("changeDrift"), ensure_ascii=False, indent=2)[:3000])
print("HISTORY PROFILE")
print(json.dumps(proj.get("historyProfile"), ensure_ascii=False, indent=2)[:3000])
print("AGENT GUIDANCE")
print(json.dumps(proj.get("agentGuidance"), ensure_ascii=False, indent=2)[:3000])
print("FOLLOW UPS")
print(json.dumps(proj.get("followUpActions"), ensure_ascii=False, indent=2)[:2000])

sess = json.loads((root/"packet-session.json").read_text())["data"]
print("\nSESSION SCOPE")
print(json.dumps(sess.get("scope"), ensure_ascii=False, indent=2)[:2000])
print("OBSERVATION COVERAGE")
print(json.dumps(sess.get("observationCoverage"), ensure_ascii=False, indent=2)[:3000])
print("COST")
print(json.dumps(sess.get("cost"), ensure_ascii=False, indent=2)[:2000])
print("CANDIDATES count", len(sess.get("candidates") or []))
for i,c in enumerate((sess.get("candidates") or [])[:6]):
    print(f"\nCAND {i}", json.dumps(c, ensure_ascii=False)[:2500])

arch = json.loads((root/"packet-architecture.json").read_text())["data"]
print("\nARCH top keys", sorted(arch.keys()))
print(json.dumps({k:arch[k] for k in arch if k!='envelopes'}, ensure_ascii=False, indent=2)[:4000])
envs = arch.get("envelopes") or {}
for k,v in envs.items():
    print(f"\nENV {k}")
    print(json.dumps(v, ensure_ascii=False, indent=2)[:5000])
