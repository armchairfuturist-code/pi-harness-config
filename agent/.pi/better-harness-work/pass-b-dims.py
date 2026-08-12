#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"
data = json.load(open(os.path.join(run, "evidence-bundle.json")))
lead = data.get("lead") or {}
print("lead keys", list(lead.keys()) if isinstance(lead, dict) else type(lead))

# search recursively for objects with id and score-related fields
hits = []

def walk(o, path="$"):
    if isinstance(o, dict):
        keys = set(o.keys())
        if "id" in o and any(k in keys for k in ("score", "maxScore", "awaitingJudgment", "judgment", "dimension", "weight")):
            hits.append((path, {k: o[k] for k in o if k not in ("evidence", "details", "raw")}))
        if "id" in o and "title" in o and ("category" in o or "pillar" in o or "lane" in o):
            if "session" in str(o.get("id","")).lower() or "usage" in str(o.get("id","")).lower() or o.get("lane") == "session":
                hits.append((path, {k: o[k] for k in list(o)[:20]}))
        for k,v in o.items():
            walk(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i,v in enumerate(o[:200]):
            walk(v, f"{path}[{i}]")

walk(data)
print("HITS", len(hits))
for p,h in hits[:80]:
    print(p, json.dumps(h, default=str)[:400])
    print("---")

# also diagnostics
print("\nDIAG", json.dumps(data.get("diagnostics"), indent=2, default=str)[:4000])

# context score review
ctx = data.get("context") or {}
print("\nCONTEXT keys", list(ctx.keys()) if isinstance(ctx, dict) else type(ctx))
raw = json.dumps(ctx, default=str)
# find dimensions array near score
for m in re.finditer(r'"dimensions"\s*:\s*\[', raw):
    print(raw[m.start():m.start()+3000][:3000])
    print("====")

# lead-summary dimensions
ls = json.load(open(os.path.join(run, "lead-summary.json")))
walk_ls_hits = []
def walk2(o, path="$"):
    if isinstance(o, dict):
        if "id" in o and ("score" in o or "max" in o or "weight" in o or "rationale" in o or "pending" in str(o).lower()):
            walk_ls_hits.append((path, o))
        for k,v in o.items():
            walk2(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i,v in enumerate(o[:100]):
            walk2(v, f"{path}[{i}]")
walk2(ls)
print("\nLS HITS", len(walk_ls_hits))
for p,h in walk_ls_hits[:40]:
    print(p, json.dumps(h, default=str)[:500])

# search package for dimension catalog session
root = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness"
patterns = ["session-usage-efficiency", "execution-friction", "validation-behavior", "session-complexity", "tool-mix"]
found_files = set()
for dirpath, dirs, files in os.walk(root):
    # prune heavy
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git")]
    for f in files:
        if not f.endswith((".mjs", ".js", ".json", ".md", ".ts")):
            continue
        fp = os.path.join(dirpath, f)
        try:
            sz = os.path.getsize(fp)
            if sz > 1_500_000 or sz < 50:
                continue
            txt = open(fp, errors="ignore").read()
        except Exception:
            continue
        if "dimensionScores" in txt or ("session-insight:tool-mix" in txt and "score" in txt):
            found_files.add(fp)
        if "await AI judgment" in txt or "awaitingJudgment" in txt:
            found_files.add(fp)
        if re.search(r'session-evidence.*dimension|dimension.*session-evidence', txt, re.I):
            found_files.add(fp)

print("\nFOUND FILES")
for fp in sorted(found_files)[:40]:
    print(fp)
