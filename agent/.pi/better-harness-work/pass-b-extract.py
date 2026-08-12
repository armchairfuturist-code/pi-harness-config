#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"
text = open(os.path.join(run, "pass-b-instructions.md")).read()
# print with line numbers
for i, line in enumerate(text.splitlines(), 1):
    print(f"{i:3d}|{line}")

print("\n\n===== LEAD SUMMARY FACTS =====")
ls = json.load(open(os.path.join(run, "lead-summary.json")))
sf = ls.get("summaryFacts") or ls
# find usageEfficiency etc
print(json.dumps(ls.get("summaryFacts") if "summaryFacts" in ls else {k: ls[k] for k in list(ls)[:20]}, indent=2, default=str)[:12000])

print("\n\n===== CANDIDATES FROM BUNDLE =====")
data = json.load(open(os.path.join(run, "evidence-bundle.json")))
se = data["lanes"]["sessionEvidence"]["data"]
print("scope", json.dumps(se.get("scope"), indent=2))
print("candidateSelection", json.dumps(se.get("candidateSelection"), indent=2))
print("admission", json.dumps(se.get("admission"), indent=2))
print("populationCoverage", json.dumps(se.get("populationCoverage"), indent=2))
print("omitted", json.dumps(se.get("omitted"), indent=2, default=str)[:2000])
print("diagnosticFlags", se.get("diagnosticFlags"))
print("excludes", se.get("excludes"))
print("\nCANDIDATES:")
for c in se.get("candidates") or []:
    print(json.dumps(c, indent=2, default=str)[:2500])
    print("---")

# score dimensions from bundle top-level
print("\n===== BUNDLE TOP KEYS =====")
print(list(data.keys()))
for k in data:
    if "score" in k.lower() or "dimension" in k.lower() or "review" in k.lower():
        print(k, type(data[k]), str(data[k])[:500])

# walk for awaiting AI judgment dimensions
raw = json.dumps(data, default=str)
idx = raw.find("await")
print("await idx", idx)
if idx >= 0:
    print(raw[idx-200:idx+800])
idx = raw.find("Score review")
print("Score review", raw[idx:idx+500] if idx>=0 else None)
# dimensions array
for m in re.finditer(r'"dimensions"\s*:\s*\[(.*?)\]', raw[:200000]):
    print("DIMS", m.group(0)[:500])
