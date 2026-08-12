#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"
data = json.load(open(os.path.join(run, "evidence-bundle.json")))
ctx = data["context"]
print(json.dumps(ctx, indent=2, default=str)[:12000])

print("\n===== lead.data keys =====")
ld = data["lead"]["data"]
print(list(ld.keys()) if isinstance(ld, dict) else type(ld))
print(json.dumps(ld, indent=2, default=str)[:8000])

# evidence-brief
fp = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/scripts/harness-analysis/evidence-brief.mjs"
txt = open(fp).read()
print("\n===== evidence-brief len", len(txt))
for m in re.finditer(r'.{0,40}dimension.{0,80}', txt, re.I):
    print(m.group(0).replace('\n',' ')[:160])

# search for scoring dimensions list
root = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness"
for dirpath, dirs, files in os.walk(root):
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git")]
    for f in files:
        if not f.endswith((".mjs",".js",".ts",".json",".md")): continue
        fp = os.path.join(dirpath,f)
        try:
            sz=os.path.getsize(fp)
            if sz>2_000_000 or sz<20: continue
            t=open(fp,errors='ignore').read()
        except: continue
        if re.search(r'(execution-friction|session-complexity|validation-behavior|source-coverage|tool-mix).{0,40}(score|dimension)', t) or \
           re.search(r'dimension.{0,40}(execution-friction|session-complexity)', t) or \
           'session-usage-efficiency' in t and 'maxScore' in t:
            print("MATCH", fp)
            for m in re.finditer(r'.{0,50}(execution-friction|session-complexity|validation-behavior|source-coverage|tool-mix|session-usage-efficiency).{0,80}', t):
                print(" ", m.group(0).replace('\n',' ')[:180])

# key-fields
print("\n===== KEY FIELDS =====")
print(open(os.path.join(run,"key-fields.txt")).read())

# pass-a handoff if any for schema example
for f in os.listdir(run):
    if f.startswith("handoff") or f.startswith("pass-a"):
        print("FILE", f, os.path.getsize(os.path.join(run,f)))
