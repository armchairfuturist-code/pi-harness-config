#!/usr/bin/env python3
"""Trajectory metrics (survey §8.5.2): judge the path, not just outcome.

Mines session jsonl for tool errors classified by harness layer + retry loops.
Usage: trajectory_metrics.py [--days N] [--session FILE] [--json]
Output: counts by layer (env_path / tool_interface / mcp_bridge / policy / orchestration)
plus retry-loop count (identical consecutive tool calls).

Uses shared error detection from _session_utils.py (single source of truth).
Baseline 2026-08-16 (post-merge): mcp_bridge catches 'lean-ctx internal error'
variant — previously missed, undercounted by ~2.2x (114 → 254 when fixed).
"""
import argparse, glob, json, re, time, os
from collections import Counter

sys_dir = os.path.dirname(os.path.abspath(__file__))
import sys; sys.path.insert(0, sys_dir)
import _session_utils as su

BASE = os.path.expanduser("~/.pi/agent/sessions")


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
                # Use shared error detection (catches lean-ctx internal errors)
                is_error = (msg.get("isError")
                            or '"error"' in raw_lower
                            or su.is_error_result(s))
                if is_error:
                    layer = su.classify_error_layer(s)
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
        files = [f for f in glob.glob(f"{BASE}/*/*.jsonl") if os.path.getmtime(f) >= cutoff]

    err, retries, sig_c = scan(files)
    total = sum(err.values())
    out = {"sessions": len(files), "days": args.days,
           "tool_errors": total, "retry_loops": retries,
           "by_layer": dict(err), "top_signatures": dict(sig_c.most_common(8))}
    if args.json:
        print(json.dumps(out, indent=2))
    else:
        print(f"sessions={out['sessions']} tool_errors={total} retry_loops={retries}")
        for layer, count in sorted(err.items(), key=lambda x: -x[1]):
            print(f"  {layer}: {count}")
        print("top signatures:", "  ".join(f"{c}x {s}" for s, c in sig_c.most_common(8)))


if __name__ == "__main__":
    main()
