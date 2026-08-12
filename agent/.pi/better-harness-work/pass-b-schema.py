#!/usr/bin/env python3
"""Inspect Pi session JSONL schema for tool events."""
import json, os
from collections import Counter

paths = [
    os.path.expanduser(
        "~/.pi/agent/sessions/--home-alex-.pi-agent--/2026-07-29T06-48-50-329Z_019faca2-1199-7318-8b8a-96b950021024.jsonl"
    ),
    os.path.expanduser(
        "~/.pi/agent/sessions/--home-alex-.pi-agent--/2026-08-03T05-19-41-001Z_019fc610-3dc9-75cf-8f0d-e2ecdc9e5b8f.jsonl"
    ),
    os.path.expanduser(
        "~/.pi/agent/sessions/--home-alex-.pi-agent--/2026-08-04T12-02-09-776Z_019fcca7-14f0-705e-b5f0-bc36773ad4ac.jsonl"
    ),
]

for path in paths:
    print("====", os.path.basename(path), os.path.getsize(path))
    type_c = Counter()
    role_c = Counter()
    msgtype_c = Counter()
    top_keys = Counter()
    samples = []
    toolish = []
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for i, line in enumerate(fh):
            if i > 2000:
                break
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            top_keys.update(obj.keys())
            t = obj.get("type")
            type_c[str(t)] += 1
            if "role" in obj:
                role_c[str(obj.get("role"))] += 1
            msg = obj.get("message")
            if isinstance(msg, dict):
                msgtype_c[str(msg.get("role") or msg.get("type"))] += 1
            # capture interesting
            blob = json.dumps(obj)[:500]
            if any(
                k in blob.lower()
                for k in (
                    "toolcall",
                    "tool_call",
                    "tooluse",
                    "tool_use",
                    "toolresult",
                    "functioncall",
                    "ctx_shell",
                    "name\":\"bash",
                    "name\":\"read",
                )
            ):
                if len(toolish) < 6:
                    toolish.append(obj)
            if i < 5 and len(samples) < 5:
                samples.append({k: (type(v).__name__ if not isinstance(v, (str, int, float, bool, type(None))) else v) for k, v in obj.items()})
    print("types:", type_c.most_common(20))
    print("roles:", role_c.most_common(10))
    print("msgtypes:", msgtype_c.most_common(10))
    print("top_keys:", top_keys.most_common(20))
    print("sample0 keys detailed:")
    # print first message and first tool-like fully structure
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for i, line in enumerate(fh):
            if i >= 3:
                break
            obj = json.loads(line)
            print("LINE", i, "TYPE", obj.get("type"), "KEYS", list(obj.keys()))
            # shallow dump
            def shallow(o, depth=0):
                if depth > 3:
                    return "..."
                if isinstance(o, dict):
                    return {k: shallow(v, depth + 1) for k, v in list(o.items())[:20]}
                if isinstance(o, list):
                    return [shallow(x, depth + 1) for x in o[:4]] + (["..."] if len(o) > 4 else [])
                if isinstance(o, str) and len(o) > 120:
                    return o[:120] + "..."
                return o
            print(json.dumps(shallow(obj), indent=2)[:1500])
    print("TOOLISH count samples", len(toolish))
    for j, obj in enumerate(toolish[:3]):
        def shallow(o, depth=0):
            if depth > 4:
                return "..."
            if isinstance(o, dict):
                return {k: shallow(v, depth + 1) for k, v in list(o.items())[:30]}
            if isinstance(o, list):
                return [shallow(x, depth + 1) for x in o[:6]] + (["..."] if len(o) > 6 else [])
            if isinstance(o, str) and len(o) > 200:
                return o[:200] + "..."
            return o
        print(f"---toolish {j} type={obj.get('type')}")
        print(json.dumps(shallow(obj), indent=2)[:2500])
    print()
