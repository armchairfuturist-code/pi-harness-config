#!/usr/bin/env python3
import json, os, re

run = "/home/alex/.pi/agent/.pi/better-harness/_run"

print("=== LEAD EVIDENCE ===")
print(open(os.path.join(run, "lead-evidence.md")).read()[:12000])

print("\n=== LEAD SUMMARY KEYS ===")
ls = json.load(open(os.path.join(run, "lead-summary.json")))
print(json.dumps(ls, indent=2, default=str)[:8000])

print("\n=== PASS A LEAD FULL (dimension-ish) ===")
pa = json.load(open(os.path.join(run, "pass-a-lead-full.json")))
if isinstance(pa, dict):
    print("keys", list(pa.keys())[:40])
    # search dimension
    raw = json.dumps(pa, default=str)
    for m in re.finditer(r".{0,40}dimension.{0,80}", raw, re.I):
        print("HIT", m.group(0)[:120])
        if m.start() > 5000:
            break
    print(json.dumps(pa, indent=2, default=str)[:6000])
else:
    print(type(pa), str(pa)[:2000])

print("\n=== EVIDENCE BUNDLE snippet ===")
eb = open(os.path.join(run, "evidence-bundle.json")).read()
print(eb[:4000])
# find dimension ids
for m in re.finditer(r'"id"\s*:\s*"[^"]+"', eb):
    s = m.group(0)
    if any(k in s.lower() for k in ("session", "friction", "runtime", "tool", "usage", "long", "valid")):
        print(s)

print("\n=== PASS B INSTRUCTIONS FULL ===")
print(open(os.path.join(run, "pass-b-instructions.md")).read())

print("\n=== PASS C HEAD (for schema clues) ===")
print(open(os.path.join(run, "pass-c-instructions.md")).read()[:4000])

print("\n=== KEY FIELDS ===")
print(open(os.path.join(run, "key-fields.txt")).read()[:5000])

print("\n=== ANALYSIS AGG ===")
an = json.load(open(os.path.join(run, "pass-b-analysis.json")))
print(json.dumps(an.get("aggregatePrimary12"), indent=2, default=str)[:5000])
print("CLUSTERS", json.dumps(an.get("clusters"), indent=2, default=str)[:4000])
print("PER SESSION count", len(an.get("perSessionPrimary", [])))
for s in an.get("perSessionPrimary", [])[:6]:
    print(s["rel"], "tc", s["toolCalls"], "err", s["isErrorTrue"], "allow", s["allowlist"], "edit", s["editMisses"], "compact", s["compactions"])

# Find dimension catalogs in package
print("\n=== SEARCH DIMENSION CATALOG ===")
root = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness"
for dirpath, dirs, files in os.walk(root):
    for f in files:
        if f.endswith((".json", ".md", ".mjs", ".js")):
            fp = os.path.join(dirpath, f)
            try:
                if os.path.getsize(fp) > 2_000_000:
                    continue
                txt = open(fp, "r", errors="ignore").read()
            except Exception:
                continue
            if "dimensionScores" in txt or "session-friction" in txt or "SE-01" in txt or "runtime-reliability" in txt:
                print("FILE", fp)
                for m in re.finditer(r".{0,30}(dimensionScores|session-friction|SE-0\d|runtime-reliability|tool-reliability).{0,50}", txt):
                    print(" ", m.group(0).replace("\n", " ")[:120])
