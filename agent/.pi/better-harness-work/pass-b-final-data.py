#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"
print(open(os.path.join(run,"session-inspect.txt")).read())

# extract score dimensions from evidence-brief
fp = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/scripts/harness-analysis/evidence-brief.mjs"
t = open(fp).read()
# find function about dimensions awaiting judgment
idx = t.find("await AI judgment")
print("\n\n===== AROUND JUDGMENT =====")
print(t[max(0,idx-2500):idx+800])

# find dimension definitions in task-loop or score
for name in ["task-loop-report.mjs", "apply-review.mjs", "score-review.mjs", "dimensions.mjs"]:
    for dirpath, dirs, files in os.walk("/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness"):
        if name in files:
            p=os.path.join(dirpath,name)
            print("FOUND", p)

# Search for SCORE_DIMENSIONS or similar
root="/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness"
for dirpath, dirs, files in os.walk(os.path.join(root,"scripts/harness-analysis")):
    for f in files:
        if not f.endswith('.mjs'): continue
        p=os.path.join(dirpath,f)
        txt=open(p).read()
        if "maxScore" in txt or "scoreMax" in txt or "dimensions:" in txt:
            # count dimension-like ids
            ids=re.findall(r'id:\s*[\'"]([a-z0-9:-]+)[\'"]', txt)
            scoreish=[i for i in ids if any(x in i for x in ('session','usage','friction','tool','valid','runtime','complex','source','edit','coverage'))]
            if scoreish or "maxScore" in txt:
                print("FILE", p)
                print(" scoreish ids", scoreish[:40])
                for m in re.finditer(r'.{0,60}maxScore.{0,80}', txt):
                    print(" ", m.group(0).replace("\n"," ")[:160])

# Look at analysis.json per-session for long sessions matching S1-S4
an=json.load(open(os.path.join(run,"pass-b-analysis.json")))
print("\nSORTED BY ERRORS:")
for s in sorted(an["perSessionPrimary"], key=lambda x: -x["isErrorTrue"]):
    print(f"{s['isErrorTrue']:3d} err | {s['toolCalls']:4d} tc | allow {s['allowlist']:2d} | edit {s['editMisses']:2d} | compact {s['compactions']} | {s['rel']}")
    print("   models", s["models"][:4])
    print("   top", s["topTools"][:5])
    print("   fails", s["failReasons"][:6])
    if s["errorSamples"]:
        print("   sample", s["errorSamples"][0])

# verify lead 91 failed-event: maybe isError with specific taxonomy
# Lead may count only certain failure types. My isErrorTrue=153 across 12.
# Lead tool mix ctx_shell 1142 vs my 796 - different counting (maybe tool results + calls or expanded set).
# My primary is workspace sessions only.

print("\nExpanded vs primary:")
print(json.dumps(an["aggregateExpanded"], indent=2)[:2000])
print("inventory", an["inventory"])

# Map candidates from bundle
data=json.load(open(os.path.join(run,"evidence-bundle.json")))
cands=data["lanes"]["sessionEvidence"]["data"]["candidates"]
print("\nCANDIDATE PATHS:")
for c in cands:
    print(json.dumps(c, indent=2, default=str)[:1500])
    print("---")
