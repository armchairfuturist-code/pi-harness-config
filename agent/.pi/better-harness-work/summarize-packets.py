#!/usr/bin/env python3
import json
from pathlib import Path

root = Path("/home/alex/.pi/agent/.pi/better-harness/_run")
for name in ["project", "session", "architecture"]:
    data = json.loads((root / f"packet-{name}.json").read_text())
    d = data.get("data") or {}
    print("====", name, "====")
    print("keys", sorted(d.keys()))
    if name == "project":
        print("recommendedReads count", len(d.get("recommendedReads") or []))
        for r in (d.get("recommendedReads") or [])[:12]:
            print(" READ", r)
        print("reviewMatrix count", len(d.get("reviewMatrix") or []))
        for r in (d.get("reviewMatrix") or [])[:15]:
            if isinstance(r, dict):
                print(" RM", {k: r.get(k) for k in list(r)[:8]})
            else:
                print(" RM", r)
        print("evidence chars", len(d.get("evidence") or ""))
        print("evidence head:\n", (d.get("evidence") or "")[:4000])
    elif name == "session":
        print("candidates", len(d.get("candidates") or []))
        for c in (d.get("candidates") or [])[:20]:
            if isinstance(c, dict):
                print(" CAND", {k: c.get(k) for k in list(c)[:12]})
            else:
                print(" CAND", c)
        print("evidence chars", len(d.get("evidence") or ""))
        print("evidence head:\n", (d.get("evidence") or "")[:4000])
        print("summaryFacts", json.dumps(d.get("summaryFacts"), ensure_ascii=False)[:2000])
    else:
        env = d.get("envelopes") or {}
        print("envelopes", list(env.keys()))
        for k, v in env.items():
            s = json.dumps(v, ensure_ascii=False)
            print(f" ENV {k} chars={len(s)}")
            print(s[:2500])
            print("---")
        print("evidence chars", len(d.get("evidence") or ""))
        print("evidence head:\n", (d.get("evidence") or "")[:4000])

lead = (root / "lead-evidence.md").read_text()
print("==== LEAD EVIDENCE ====")
print(lead[:6000])
print("==== LEAD SUMMARY ====")
print((root / "lead-summary.json").read_text()[:3000])
