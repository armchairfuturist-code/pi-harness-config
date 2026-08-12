#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"

print("=== FULL PASS-B INSTRUCTIONS ===")
print(open(os.path.join(run, "pass-b-instructions.md")).read())

print("\n=== LEAD SUMMARY STRUCTURE ===")
ls = json.load(open(os.path.join(run, "lead-summary.json")))

def walk(obj, path="$", depth=0):
    if depth > 6:
        return
    if isinstance(obj, dict):
        keys = list(obj.keys())
        print(f"{path} dict keys={keys[:40]}")
        for k in keys:
            if k in ("leadEvidence", "aiFixPrompt", "summary") and isinstance(obj[k], str) and len(obj[k]) > 200:
                print(f"{path}.{k} str len={len(obj[k])}")
                continue
            walk(obj[k], f"{path}.{k}", depth + 1)
    elif isinstance(obj, list):
        print(f"{path} list n={len(obj)}")
        if obj:
            walk(obj[0], f"{path}[0]", depth + 1)
            if len(obj) > 1:
                walk(obj[1], f"{path}[1]", depth + 1)
    else:
        s = repr(obj)
        print(f"{path} = {s[:200]}")

walk(ls)

print("\n=== DIMENSION-LIKE FROM LEAD SUMMARY ===")
raw = json.dumps(ls, default=str)
for pat in ["dimension", "score", "session-insight", "validate-impact", "usage"]:
    print("---", pat)
    for m in re.finditer(r".{0,60}" + re.escape(pat) + r".{0,100}", raw, re.I):
        print(m.group(0)[:180])

print("\n=== EVIDENCE BUNDLE session lane deep ===")
# evidence-bundle may be huge - parse carefully
path = os.path.join(run, "evidence-bundle.json")
# stream find sessionEvidence section
with open(path) as f:
    data = json.load(f)
se = data.get("lanes", {}).get("sessionEvidence", {})
print("sessionEvidence status", se.get("status"))
d = se.get("data") or {}
print("data keys", list(d.keys()) if isinstance(d, dict) else type(d))
print(json.dumps(d, indent=2, default=str)[:15000])

print("\n=== SCORE REVIEW DIMENSIONS IF ANY ===")
# search whole bundle for dimensions awaiting judgment
rawb = json.dumps(data, default=str)
for m in re.finditer(r'"dimensions?"\s*:\s*\[', rawb):
    start = m.start()
    print(rawb[start:start+1500][:1500])
    print('---')
for m in re.finditer(r'"id"\s*:\s*"(session[^"]+|SE-[^"]+|usage[^"]+|runtime[^"]+|friction[^"]+|validate[^"]+)"', rawb):
    print(m.group(0))
