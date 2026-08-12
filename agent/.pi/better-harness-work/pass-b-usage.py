#!/usr/bin/env python3
import json, os

run = "/home/alex/.pi/agent/.pi/better-harness/_run"
data = json.load(open(os.path.join(run, "evidence-bundle.json")))
sf = data["lead"]["data"]["summaryFacts"]
print(json.dumps(sf.get("usageActivity"), indent=2, default=str))
print("\n==== EFFICIENCY ====")
print(json.dumps(sf.get("usageEfficiency"), indent=2, default=str))
print("\n==== FACETS FULL ====")
print(json.dumps(sf.get("semanticFacets"), indent=2, default=str))
print("\n==== MY AGG ====")
an = json.load(open(os.path.join(run, "pass-b-analysis.json")))
print(json.dumps(an["aggregatePrimary12"], indent=2, default=str)[:5000])
# top error samples across
print("\n==== ERROR SAMPLES ====")
for s in an["perSessionPrimary"]:
    if s["isErrorTrue"] >= 9:
        print(s["rel"], "err", s["isErrorTrue"], "tc", s["toolCalls"], "allow", s["allowlist"], "editMiss", s["editMisses"])
        for e in s["errorSamples"][:4]:
            print(" ", e)
        print(" topTools", s["topTools"][:6])
        print(" fails", s["failReasons"][:8])
        print(" prompts", s["userPromptsSample"][:2])
        print("---")
