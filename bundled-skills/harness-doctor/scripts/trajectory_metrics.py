#!/usr/bin/env python3
"""Trajectory metrics (survey §8.5.2): judge the path, not just outcome.

Mineral session jsonl for tool errors classified by harness layer + retry loops.
Usage: trajectory_metrics.py [--days N] [--session FILE] [--json]
Output: counts by layer (env_path / tool_interface / mcp_bridge / policy / orchestration)
plus retry-loop count (identical consecutive tool calls).
Baseline 2026-07-30: 898 errors/30d (env_path 173+, tool_interface 105+, mcp_bridge 38).
Baseline 2026-08-16 (post-SIGS fix): mcp_bridge now catches 'lean-ctx internal error'
variant — previously missed, undercounted by ~4x (114 → 495 when fixed).
"""
import argparse, glob, json, re, time
from collections import Counter

SIGS = [
    (r'command not found|ENOENT|No such file or directory', "env_path"),
    (r'Could not find|Validation failed for tool|target.*is required', "tool_interface"),
    # Match both "MCP bridge not connected" (transport failure) and
    # "lean-ctx internal error" (daemon-alive but tool-call failure).
    # The latter was the dominant variant: 136/495 errors (Jul-Aug 2026).
    (r'MCP bridge not connected|lean-ctx internal error|MCP server is still running', "mcp_bridge"),
    (r'BLOCKED — DO NOT RETRY|allowlist', "policy"),
]
BASE = "/home/alex/.pi/agent/sessions"


def scan(files):
    err = Counter()
    sig_c = Counter()
    retries = 0
    for fp in files:
        try:
            lines = open(fp, errors="ignore").readlines()
        except Exception:
            continue
        last = None
        for line in lines:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get("type") != "message":
                continue
            msg = d.get("message", {})
            role = msg.get("role")
            if role == "assistant":
                for c in msg.get("content", []):
                    if isinstance(c, dict) and c.get("type") == "toolCall":
                        sig = (c.get("name"), json.dumps(c.get("input") or c.get("args") or {})[:120])
                        if sig == last:
                            retries += 1
                        last = sig
            elif role == "toolResult":
                s = json.dumps(msg.get("content") or "")[:400]
                raw_lower = s[:200].lower()
                is_error = (msg.get("isError")
                            or '"error"' in raw_lower
                            or 'error:' in raw_lower
                            or 'lean-ctx internal error' in raw_lower
                            or 'mcp bridge not connected' in raw_lower
                            or 'enoent' in raw_lower
                            or 'command not found' in raw_lower
                            or 'blocked' in raw_lower
                            or 'validation failed' in raw_lower)
                if is_error:
                    layer = "other"
                    for pat, l in SIGS:
                        if re.search(pat, s, re.I):
                            layer = l
                            break
                    err[layer] += 1
                    m = re.search(r'command not found|Could not find|MCP bridge|lean-ctx internal error|BLOCKED|Validation failed|ENOENT', s, re.I)
                    sig_c[m.group(0).lower() if m else s[:50]] += 1
    return err, retries, sig_c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--session")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if args.session:
        files = [args.session]
    else:
        cutoff = time.time() - args.days * 86400
        files = [f for f in glob.glob(f"{BASE}/*/*.jsonl") if
                 __import__("os").path.getmtime(f) >= cutoff]

    err, retries, sig_c = scan(files)
    total = sum(err.values())
    out = {"sessions": len(files), "days": args.days,
           "tool_errors": total, "retry_loops": retries,
           "by_layer": dict(err), "top_signatures": dict(sig_c.most_common(8))}
    if args.json:
        print(json.dumps(out, indent=2))
    else:
        print(f"sessions={len(files)} tool_errors={total} retry_loops={retries}")
        for l, c in err.most_common():
            print(f"  {l}: {c}")
        print("top signatures:")
        for s, c in sig_c.most_common(8):
            print(f"  {c}x {s}")


if __name__ == "__main__":
    main()
