#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"
data = json.load(open(os.path.join(run, "evidence-bundle.json")))
sf = data["lead"]["data"]["summaryFacts"]
print("summaryFacts keys", list(sf.keys()))
print("semanticFacets:")
print(json.dumps(sf.get("semanticFacets"), indent=2, default=str)[:20000])

print("\n===== score-related in summaryFacts =====")
for k,v in sf.items():
    if "score" in k.lower() or "dimension" in k.lower() or "review" in k.lower() or "usage" in k.lower() or "session" in k.lower():
        print("KEY", k, type(v))
        print(json.dumps(v, indent=2, default=str)[:4000])
        print("---")

# pass-a handoff schema example
print("\n===== PASS A INSTRUCTIONS =====")
print(open(os.path.join(run, "pass-a-instructions.md")).read())

# search scoring dimensions in package
root = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness"
for dirpath, dirs, files in os.walk(os.path.join(root, "scripts")):
    for f in files:
        if not f.endswith((".mjs",".js",".ts",".json")): continue
        fp=os.path.join(dirpath,f)
        t=open(fp,errors='ignore').read()
        if "await AI judgment" in t or "awaitingJudgment" in t or "dimensionsAwaiting" in t or "session-insight:tool-mix" in t:
            print("FILE", fp)
            # extract nearby
            for m in re.finditer(r'.{0,100}(await AI judgment|session-insight:[a-z0-9-]+|maxScore|dimensionId).{0,120}', t):
                print(" ", m.group(0).replace("\n"," ")[:220])

# also in dist or src
for sub in ["dist", "src", "skills", "references"]:
    p = os.path.join(root, sub)
    if not os.path.isdir(p):
        continue
    for dirpath, dirs, files in os.walk(p):
        dirs[:] = [d for d in dirs if d not in ("node_modules",)]
        for f in files:
            if not f.endswith((".mjs",".js",".ts",".json",".md")): continue
            fp=os.path.join(dirpath,f)
            try:
                if os.path.getsize(fp) > 1_000_000: continue
                t=open(fp,errors='ignore').read()
            except: continue
            if "5 dimension" in t or "dimensions await" in t or ("session-insight:tool-mix" in t and "score" in t):
                print("HIT", fp)
                for m in re.finditer(r'.{0,80}(session-insight:[a-z0-9-]+|dimensions await|maxScore\s*[:=]).{0,100}', t):
                    print(" ", m.group(0).replace("\n"," ")[:200])
