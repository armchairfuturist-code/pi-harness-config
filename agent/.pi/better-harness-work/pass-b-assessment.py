#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"
data = json.load(open(os.path.join(run, "evidence-bundle.json")))

# Find assessmentDecisions anywhere
hits=[]
def walk(o, path="$"):
    if isinstance(o, dict):
        if "assessmentDecisions" in o or (o.get("kind") in ("score-review","session-insights","repository-review")):
            hits.append((path, o if o.get("kind") else {k:o[k] for k in list(o)[:20]}))
        for k,v in o.items():
            walk(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i,v in enumerate(o[:100]):
            walk(v, f"{path}[{i}]")
walk(data)
print("HITS", len(hits))
for p,h in hits:
    print("PATH", p)
    print(json.dumps(h, indent=2, default=str)[:5000])
    print("====")

# lead-evidence full
print("\nLEAD EVIDENCE FULL")
print(open(os.path.join(run,"lead-evidence.md")).read())

# fluency dimensions
fp="/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/scripts/harness-analysis/fluency-dimensions.mjs"
print("\nFLUENCY DIMS HEAD")
print(open(fp).read()[:5000])

# apply-review for schema of dimensionScores
fp="/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/scripts/harness-analysis/report-source/apply-review.mjs"
t=open(fp).read()
print("\nAPPLY REVIEW - dimension related")
for m in re.finditer(r'.{0,40}dimensionScore.{0,100}', t):
    print(m.group(0).replace('\n',' ')[:180])
for m in re.finditer(r'function\s+\w*[Dd]imension\w*\([^)]*\)\s*\{[^}]{0,500}', t):
    print(m.group(0)[:400])

# Find score dimensions list in package
root="/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness"
for dirpath, dirs, files in os.walk(root):
    dirs[:] = [d for d in dirs if d not in ("node_modules",".git")]
    for f in files:
        if "dimension" in f.lower() or "score" in f.lower() or "rubric" in f.lower():
            print("NAME", os.path.join(dirpath,f))

# task-loop-report dimensionScores schema
fp="/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/scripts/harness-analysis/task-loop-report.mjs"
t=open(fp).read()
idx=t.find("dimensionScores")
print("\ndimensionScores idx", idx)
if idx>=0:
    print(t[idx-500:idx+2000])
idx=t.find("scoreReason")
print("scoreReason context")
if idx>=0:
    print(t[idx-300:idx+1500])
