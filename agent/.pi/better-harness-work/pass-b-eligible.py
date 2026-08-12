#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"
data = json.load(open(os.path.join(run, "evidence-bundle.json")))

# Find session ids, paths in session evidence deeply
se = data["lanes"]["sessionEvidence"]["data"]
print("keys", se.keys())
for k,v in se.items():
    if k == "candidates":
        continue
    print(f"\n== {k} ==")
    print(json.dumps(v, indent=2, default=str)[:3000])

print("\n== candidates full ==")
print(json.dumps(se.get("candidates"), indent=2, default=str)[:20000])

# usage activity session list
sf = data["lead"]["data"]["summaryFacts"]
ua = sf.get("usageActivity") or {}
print("\n== usageActivity ==")
print(json.dumps(ua, indent=2, default=str)[:15000])

ue = sf.get("usageEfficiency") or {}
print("\n== usageEfficiency ==")
print(json.dumps(ue, indent=2, default=str)[:10000])

# search whole bundle for session paths / analyzedSessions
raw = json.dumps(data, default=str)
# find jsonl paths
paths = sorted(set(re.findall(r'[^"\s]+\\.jsonl', raw)))
print("\njsonl paths in bundle", len(paths))
for p in paths[:40]:
    print(p)

# episode ids
eps = sorted(set(re.findall(r'episode:[a-f0-9]+', raw)))
print("episodes", eps)

# session ids in usage
for m in re.finditer(r'"sessionId"\s*:\s*"[^"]+"', raw):
    print(m.group(0))
for m in re.finditer(r'"analyzedSession[^"]*"\s*:\s*[^,}\[]+', raw):
    print(m.group(0)[:200])
