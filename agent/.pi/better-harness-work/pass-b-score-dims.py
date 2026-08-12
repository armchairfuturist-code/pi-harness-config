#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"
data = json.load(open(os.path.join(run, "evidence-bundle.json")))
sf = data["lead"]["data"]["summaryFacts"]
print("usageEfficiency:")
print(json.dumps(sf.get("usageEfficiency"), indent=2, default=str)[:12000])
print("\nusageActivity models/skills:")
ua = sf.get("usageActivity") or {}
print("keys", ua.keys())
print("models", json.dumps(ua.get("models"), indent=2)[:3000])
print("skills", json.dumps(ua.get("skills"), indent=2, default=str)[:3000])
print("activeLong", ua.get("activeLong") or ua.get("longSessions") or "n/a")
print(json.dumps({k:ua[k] for k in ua if k not in ("dates","sessions")}, indent=2, default=str)[:5000])

# Full pass-b instructions lines 40+
print("\n===== PASS B INSTRUCTIONS LINES =====")
text = open(os.path.join(run, "pass-b-instructions.md")).read()
for i,l in enumerate(text.splitlines(),1):
    print(f"{i:3d}|{l}")

# Find scoring dimension catalogs
root = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness"
# grep for score dimension ids related to session
hits=[]
for dirpath, dirs, files in os.walk(root):
    dirs[:] = [d for d in dirs if d not in ("node_modules",".git")]
    for f in files:
        if not f.endswith((".mjs",".js",".ts",".json")): continue
        fp=os.path.join(dirpath,f)
        try:
            sz=os.path.getsize(fp)
            if sz>2_000_000 or sz<100: continue
            t=open(fp,errors='ignore').read()
        except: continue
        if "execution-friction" in t and ("maxScore" in t or "scoreMax" in t or "weight" in t) and "dimension" in t:
            hits.append(fp)
        if re.search(r'id:\s*[\'"]execution-friction[\'"]', t) or re.search(r'"id"\s*:\s*"execution-friction"', t):
            hits.append(fp)
        if "dimensionsAwaitingJudgment" in t or "scoreDimensions" in t or "SESSION_DIMENSIONS" in t:
            hits.append(fp)
        if "session-evidence" in t and "dimension" in t and ("score" in t or "rubric" in t):
            if "handoff" in t or "pass-b" in t or "agentId" in t:
                hits.append(fp)

print("\nHITS", sorted(set(hits))[:30])
for fp in sorted(set(hits))[:15]:
    t=open(fp,errors='ignore').read()
    print("====", fp, len(t))
    # print relevant chunks
    for pat in ["execution-friction", "session-complexity", "validation-behavior", "source-coverage", "tool-mix", "session-usage-efficiency", "post-edit-validation", "maxScore", "scoreDimensions", "dimensionScores"]:
        if pat in t:
            idx=t.find(pat)
            print(f"  [{pat}] ...{t[max(0,idx-80):idx+120].replace(chr(10),' ')}...")
