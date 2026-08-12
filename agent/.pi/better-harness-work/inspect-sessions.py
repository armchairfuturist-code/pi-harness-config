#!/usr/bin/env python3
import json
from pathlib import Path
from collections import Counter

root = Path("/home/alex/.pi/agent/sessions")
files = sorted(root.rglob("*.jsonl"))
print("total_jsonl", len(files))

# analyze last 25 by mtime
files = sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)[:25]
tool_names = Counter()
types = Counter()
tool_fail = 0
tool_ok = 0
msg_roles = Counter()
total_tools = 0
for f in files:
    tc = 0
    tr = 0
    fails = 0
    models = set()
    cwd = None
    for line in f.read_text(errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            o = json.loads(line)
        except Exception:
            continue
        t = o.get("type")
        types[t] += 1
        if t == "session":
            cwd = o.get("cwd")
        if t == "message":
            m = o.get("message") or {}
            role = m.get("role")
            msg_roles[role] += 1
            content = m.get("content")
            if isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "toolCall":
                        tc += 1
                        total_tools += 1
                        tool_names[c.get("name") or "?"] += 1
            if role == "toolResult":
                tr += 1
                # failure heuristics
                is_err = bool(m.get("isError") or m.get("error"))
                c = m.get("content")
                text = ""
                if isinstance(c, list):
                    text = " ".join(
                        (x.get("text") or "") for x in c if isinstance(x, dict)
                    )
                elif isinstance(c, str):
                    text = c
                low = text.lower()
                if is_err or "error" in low[:200] or "failed" in low[:200] or "blocked" in low[:200]:
                    fails += 1
            if role == "assistant" and isinstance(m.get("model"), str):
                models.add(m.get("model"))
            usage = (m.get("usage") or {})
        if t == "model_change":
            models.add(o.get("modelId"))
    tool_fail += fails
    tool_ok += max(tr - fails, 0)
    print(f"FILE {f.name} cwd={cwd} tools={tc} toolResults={tr} fails~={fails} models={sorted(models)[:4]}")

print("TYPE_COUNTS", types.most_common())
print("MSG_ROLES", msg_roles.most_common())
print("TOOLS", tool_names.most_common(30))
print("TOTAL_TOOLS", total_tools, "approx_fail", tool_fail)

# skills dir count
skills = Path("/home/alex/.pi/agent/skills")
print("skills_dirs", len([p for p in skills.iterdir() if p.is_dir()]))
print("skill_mds", len(list(skills.rglob("SKILL.md"))))
ext = Path("/home/alex/.pi/agent/extensions")
print("extensions", [p.name for p in ext.iterdir()])
agents = Path("/home/alex/.pi/agent/agents")
print("agents", [p.name for p in agents.iterdir()] if agents.exists() else None)
