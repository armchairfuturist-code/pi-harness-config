#!/usr/bin/env python3
"""Context-growth attribution (survey §5.6, item 4): how much of long-session
fresh-token growth is uncleared tool outputs vs conversation text. Baseline 2026-07-30 (253 sessions, 46.6M fresh input tokens):
- toolResult share of context bytes: p50=0.49, p90=0.72
- big (>2KB) tool results reaching the model UNCLEARED: 1835/1860 (98.7%)
- top fresh-token sessions are CONVERSATION-dominated (share 0.24-0.54) — turn/message growth management (compaction) is the primary attack there; tool-output clearing is the attack for the 88-session mid-tail (6.1M, 13%).

Measurement-gap fix (2026-08-07): the transcript-pruner's CLEAR rewrites happen on a
context clone that is never persisted to the saved JSONL, so a disk scan undercounts
real runtime clearing. Read PI_PRUNE_STATE (default ~/.local/state/pi/prune-events.jsonl)
— emitted by transcript-pruner.ts — and report the runtime-cleared volume alongside the
disk-scan figure. Usage: context_growth.py [--days N] [--json]
"""
import argparse, glob, json, os, time


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    cutoff = time.time() - args.days * 86400
    rows, trunc = [], {"cleared": 0, "uncleared": 0}
    for fp in glob.glob("/home/alex/.pi/agent/sessions/*/*.jsonl"):
        if os.path.getmtime(fp) < cutoff:
            continue
        try:
            lines = open(fp, errors="ignore").readlines()
        except Exception:
            continue
        tool_b = conv_b = fresh = turns = 0
        for line in lines:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get("type") != "message":
                continue
            msg = d.get("message", {})
            role = msg.get("role")
            content = msg.get("content")
            size = len(json.dumps(content)) if content else 0
            if role == "toolResult":
                tool_b += size
                if size > 2048:
                    s = json.dumps(content)
                    key = "cleared" if ("full output ->" in s or "output truncated" in s) else "uncleared"
                    trunc[key] += 1
            elif role in ("user", "assistant"):
                conv_b += size
                if role == "assistant":
                    fresh += (msg.get("usage") or {}).get("input", 0)
            turns += 1
        if turns >= 3 and fresh:
            rows.append({"sess": fp.split("/")[-2], "turns": turns, "fresh_k": round(fresh / 1000, 1),
                         "tool_kb": round(tool_b / 1024), "conv_kb": round(conv_b / 1024),
                         "tool_share": round(tool_b / max(1, tool_b + conv_b), 3)})
    rows.sort(key=lambda r: -r["fresh_k"])
    tot = sum(r["fresh_k"] for r in rows)
    shares = sorted(r["tool_share"] for r in rows)
    big = [r for r in rows if r["tool_share"] > 0.6]

    prune_state_path = os.environ.get("PI_PRUNE_STATE") or os.path.expanduser("~/.local/state/pi/prune-events.jsonl")
    pruner = {"count": 0, "bytes": 0}
    if os.path.isfile(prune_state_path):
        for line in open(prune_state_path, errors="ignore"):
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get("kind") == "clear":
                pruner["count"] += int(d.get("count") or 1)
                pruner["bytes"] += int(d.get("bytes") or 0)

    out = {
        "sessions": len(rows),
        "total_fresh_M": round(tot / 1000, 1),
        "tool_share_p50": shares[len(shares) // 2] if shares else None,
        "tool_share_p90": shares[int(len(shares) * .9)] if shares else None,
        "tool_dominated_sessions": len(big),
        "tool_dominated_fresh_M": round(sum(r["fresh_k"] for r in big) / 1000, 1),
        "big_tool_results": trunc,
        "pruner_runtime_cleared_results": pruner["count"],
        "pruner_runtime_cleared_kb": round(pruner["bytes"] / 1024),
        "top5": rows[:5],
    }
    if args.json:
        print(json.dumps(out, indent=2))
        return
    print(f"sessions={out['sessions']} fresh={out['total_fresh_M']}M "
          f"tool_share p50={out['tool_share_p50']} p90={out['tool_share_p90']}\n"
          f"tool-dominated(>60%): {out['tool_dominated_sessions']} sessions = {out['tool_dominated_fresh_M']}M fresh\n"
          f"big tool results: cleared={trunc['cleared']} uncleared={trunc['uncleared']} "
          f"(disk scan — transcript-pruner runtime-cleared {pruner['count']} results / {round(pruner['bytes']/1024)}KB since state log)\n"
          + "\n".join(f" {r['sess'][:40]:<40} fresh={r['fresh_k']:>7}K share={r['tool_share']}" for r in out['top5']))


if __name__ == "__main__":
    main()
