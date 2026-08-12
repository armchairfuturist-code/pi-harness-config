#!/usr/bin/env python3
import os, json
print("===PACKET===")
print(open("/home/alex/.pi/agent/.pi/better-harness/_run/packet-session.json").read())
print("===INSTRUCTIONS_TAIL===")
text = open("/home/alex/.pi/agent/.pi/better-harness/_run/pass-b-instructions.md").read()
print(text[-3000:])
print("===RUN_DIR===")
for f in sorted(os.listdir("/home/alex/.pi/agent/.pi/better-harness/_run")):
    fp = os.path.join("/home/alex/.pi/agent/.pi/better-harness/_run", f)
    print(f, os.path.getsize(fp) if os.path.isfile(fp) else "DIR")
print("===SESSION_INSPECT_HEAD===")
print(open("/home/alex/.pi/agent/.pi/better-harness/_run/session-inspect.txt").read()[:5000])
print("===DOMAIN_README===")
base = "/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/references/session-evidence"
print(open(os.path.join(base, "README.md")).read()[:4000])
print("===DIAGNOSTICS_HEAD===")
print(open(os.path.join(base, "sessions-diagnostics.md")).read()[:3500])
print("===USAGE_EFFICIENCY_HEAD===")
print(open(os.path.join(base, "session-usage-efficiency.md")).read()[:3500])
print("===INSIGHTS_HEAD===")
print(open(os.path.join(base, "session-insights-report.md")).read()[:3500])
print("===SKILL_REF_HEAD===")
print(open("/home/alex/.pi/agent/npm/node_modules/@qoder-ai/better-harness/skills/better-harness/references/session-evidence.md").read()[:5000])
