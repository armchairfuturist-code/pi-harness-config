#!/usr/bin/env python3
import json, os, re

# Extract dimension scoring from insights and score-related modules
root = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness"
# Find score review dimensions
for dirpath, dirs, files in os.walk(os.path.join(root, "scripts")):
    for f in files:
        if not f.endswith((".mjs",".js")): continue
        fp=os.path.join(dirpath,f)
        t=open(fp,errors='ignore').read()
        if "await AI judgment" in t or "requires-review" in t or "dimensions" in t and "score" in t and "session" in t:
            if "judgment" in t or "scoreReview" in t or "dimensionScore" in t or "maxScore" in t:
                print("FILE", fp)
                # extract objects with id and max
                for m in re.finditer(r'id:\s*[\'"]([a-z0-9:-]+)[\'"].{0,200}max', t, re.S):
                    print(" ", m.group(0).replace("\n"," ")[:220])
                for m in re.finditer(r'.{0,40}judgment.{0,80}', t):
                    print(" J", m.group(0).replace("\n"," ")[:140])

# Look at decision / score in lead-summary more carefully
run = "/home/alex/.pi/agent/.pi/better-harness/_run"
ls = json.load(open(os.path.join(run, "lead-summary.json")))
print("LS top keys", ls.keys())
# dump structure without huge strings
def slim(o, depth=0):
    if depth>5: return "..."
    if isinstance(o, dict):
        out={}
        for k,v in o.items():
            if isinstance(v,str) and len(v)>160:
                out[k]=f"<str:{len(v)}>"
            else:
                out[k]=slim(v, depth+1)
        return out
    if isinstance(o, list):
        return [slim(x, depth+1) for x in o[:12]] + ([f"...+{len(o)-12}"] if len(o)>12 else [])
    return o
print(json.dumps(slim(ls), indent=2)[:15000])

# session-inspect full
print("\n===== SESSION INSPECT =====")
print(open(os.path.join(run,"session-inspect.txt")).read())

# Reconcile my analysis with lead long session failure counts
an = json.load(open(os.path.join(run,"pass-b-analysis.json")))
print("\nPRIMARY sessions detail:")
for s in an["perSessionPrimary"]:
    print(json.dumps({
        "rel": s["rel"],
        "tc": s["toolCalls"],
        "err": s["isErrorTrue"],
        "allow": s["allowlist"],
        "edit": s["editMisses"],
        "read": s["readMisses"],
        "compact": s["compactions"],
        "users": s["userMsgs"],
        "models": s["models"][:3],
        "top": s["topTools"][:5],
        "fail": s["failReasons"][:5],
        "errSamples": s["errorSamples"][:2],
    }, indent=2)[:1200])
    print("---")

print("AGG", json.dumps(an["aggregatePrimary12"], indent=2)[:3000])
