#!/usr/bin/env python3
import json
from pathlib import Path

agent = Path("/home/alex/.pi/agent")
print("AGENTS", (agent/"AGENTS.md").exists())
print("SYSTEM", (agent/"SYSTEM.md").exists())
print("APPEND", (agent/"APPEND_SYSTEM.md").exists(), (agent/"APPEND_SYSTEM.md").stat().st_size if (agent/"APPEND_SYSTEM.md").exists() else 0)
settings = json.loads((agent/"settings.json").read_text())
print("skills_filter", settings.get("skills"))
print("packages", len(settings.get("packages") or []))
print("extensions", settings.get("extensions"))
print("model", settings.get("defaultProvider"), settings.get("defaultModel"))
skills = list((agent/"skills").iterdir()) if (agent/"skills").exists() else []
print("skill_dirs", len([p for p in skills if p.is_dir()]))
l30 = agent/"skills/last30days/SKILL.md"
print("last30days_skill_bytes", l30.stat().st_size if l30.exists() else None)
gi = Path("/home/alex/.pi/.gitignore").read_text()
print("gitignore", gi.strip().splitlines())
inv = agent/"harness-inventory.json"
if inv.exists():
    invd = json.loads(inv.read_text())
    print("inventory_generated", invd.get("generated") or invd.get("generatedAt"))
print("ext_dir", [p.name for p in (agent/"extensions").iterdir()] if (agent/"extensions").exists() else None)
print("agents", [p.name for p in (agent/"agents").iterdir()] if (agent/"agents").exists() else None)
