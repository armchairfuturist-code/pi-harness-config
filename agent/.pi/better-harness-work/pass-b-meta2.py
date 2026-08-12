#!/usr/bin/env python3
import os
text = open("/home/alex/.pi/agent/.pi/better-harness/_run/pass-b-instructions.md").read()
print(text)
print("\n\n==== DOMAIN README ====")
base = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/references/session-evidence"
print(open(os.path.join(base, "README.md")).read())
print("\n\n==== DIAGNOSTICS ====")
print(open(os.path.join(base, "sessions-diagnostics.md")).read()[:8000])
print("\n\n==== EFFICIENCY ====")
print(open(os.path.join(base, "session-usage-efficiency.md")).read()[:6000])
print("\n\n==== INSIGHTS ====")
print(open(os.path.join(base, "session-insights-report.md")).read()[:6000])
print("\n\n==== SKILL REF ====")
print(open("/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/skills/better-harness/references/session-evidence.md").read())
