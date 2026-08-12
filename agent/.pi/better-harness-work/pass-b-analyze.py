#!/usr/bin/env python3
"""Pass B session evidence quantification."""
import json, os, re, sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

base = os.path.expanduser("~/.pi/agent/sessions")
window_start = datetime(2026, 7, 5, tzinfo=timezone.utc)
window_end = datetime(2026, 8, 4, 23, 59, 59, tzinfo=timezone.utc)

files = []
for root, dirs, fnames in os.walk(base):
    for f in fnames:
        if f.endswith(".jsonl"):
            files.append(os.path.join(root, f))
print(f"TOTAL_JSONL={len(files)}")


def parse_ts_from_name(path):
    bn = os.path.basename(path)
    m = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})", bn)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y-%m-%dT%H-%M-%S").replace(tzinfo=timezone.utc)
    except Exception:
        return None


in_window = []
for p in files:
    ts = parse_ts_from_name(p)
    if ts and window_start <= ts <= window_end:
        in_window.append((ts, p))
    elif ts is None:
        mtime = datetime.fromtimestamp(os.path.getmtime(p), tz=timezone.utc)
        if window_start <= mtime <= window_end:
            in_window.append((mtime, p))

in_window.sort(key=lambda x: x[0], reverse=True)
print(f"IN_WINDOW={len(in_window)}")

dirs_c = Counter()
for ts, p in in_window:
    rel = os.path.relpath(p, base).split(os.sep)[0]
    dirs_c[rel] += 1
print("TOP_DIRS:")
for d, c in dirs_c.most_common(25):
    print(f"  {d}: {c}")

ws = [x for x in in_window if "--home-alex-.pi-agent--" in x[1]]
print(f"WS_DIR_COUNT={len(ws)}")
print("\nWORKSPACE_SESSIONS:")
for ts, p in sorted(ws, key=lambda x: -os.path.getsize(x[1])):
    print(f"  {os.path.getsize(p):8d} {ts.isoformat()} {os.path.basename(p)}")

print("\nLARGEST_IN_WINDOW:")
for ts, p in sorted(in_window, key=lambda x: -os.path.getsize(x[1]))[:30]:
    print(f"  {os.path.getsize(p):8d} {ts.isoformat()} {os.path.relpath(p, base)}")


def classify_entry(obj):
    """Return (kind, tool_name_or_None, is_error, detail)."""
    t = obj.get("type") or obj.get("message", {}).get("type") or obj.get("role")
    # Pi JSONL variants
    msg = obj.get("message") if isinstance(obj.get("message"), dict) else None
    if msg:
        mt = msg.get("type") or msg.get("role")
        if mt in ("toolCall", "tool_call", "toolUse", "tool_use"):
            name = msg.get("name") or msg.get("toolName") or (msg.get("function") or {}).get("name")
            return ("toolCall", name, False, None)
        if mt in ("toolResult", "tool_result"):
            name = msg.get("name") or msg.get("toolName") or obj.get("toolName")
            is_err = bool(
                msg.get("isError")
                or msg.get("error")
                or obj.get("isError")
                or (isinstance(msg.get("content"), str) and "error" in msg.get("content", "").lower()[:200])
            )
            # also check status
            st = (msg.get("status") or obj.get("status") or "").lower()
            if st in ("error", "failed", "failure"):
                is_err = True
            return ("toolResult", name, is_err, st or None)
        if mt in ("user", "assistant", "system"):
            return (mt, None, False, None)
    # top-level
    if t in ("toolCall", "tool_call", "toolUse", "tool_use"):
        name = obj.get("name") or obj.get("toolName")
        return ("toolCall", name, False, None)
    if t in ("toolResult", "tool_result"):
        name = obj.get("name") or obj.get("toolName")
        is_err = bool(obj.get("isError") or obj.get("error"))
        return ("toolResult", name, is_err, None)
    if t:
        return (str(t), None, False, None)
    return ("unknown", None, False, None)


def scan_session(path, max_lines=None):
    stats = {
        "path": path,
        "lines": 0,
        "parse_errors": 0,
        "kinds": Counter(),
        "tools_call": Counter(),
        "tools_result": Counter(),
        "tool_errors": Counter(),
        "error_samples": [],
        "models": Counter(),
        "cwds": Counter(),
        "has_tool": False,
        "bytes": os.path.getsize(path),
        "first_ts": None,
        "last_ts": None,
        "user_msgs": 0,
        "assistant_msgs": 0,
        "retry_signals": 0,
        "allowlist_blocks": 0,
        "compaction_mentions": 0,
        "context_thrash_signals": 0,
        "shell_commands_sample": [],
        "failure_details": Counter(),
    }
    prev_tool = None
    same_tool_streak = 0
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for i, line in enumerate(fh):
                if max_lines and i >= max_lines:
                    break
                line = line.strip()
                if not line:
                    continue
                stats["lines"] += 1
                try:
                    obj = json.loads(line)
                except Exception:
                    stats["parse_errors"] += 1
                    continue
                # timestamps
                ts = obj.get("timestamp") or obj.get("ts") or obj.get("time")
                if ts:
                    if stats["first_ts"] is None:
                        stats["first_ts"] = ts
                    stats["last_ts"] = ts
                # model
                for key in ("model", "modelId", "model_id"):
                    if obj.get(key):
                        stats["models"][str(obj[key])] += 1
                msg = obj.get("message") if isinstance(obj.get("message"), dict) else {}
                if isinstance(msg, dict):
                    for key in ("model", "modelId"):
                        if msg.get(key):
                            stats["models"][str(msg[key])] += 1
                kind, tool, is_err, detail = classify_entry(obj)
                stats["kinds"][kind] += 1
                if kind == "toolCall":
                    stats["has_tool"] = True
                    tname = tool or "unknown"
                    stats["tools_call"][tname] += 1
                    if tname == prev_tool:
                        same_tool_streak += 1
                        if same_tool_streak >= 3:
                            stats["retry_signals"] += 1
                    else:
                        same_tool_streak = 1
                        prev_tool = tname
                    # extract cwd / command hints from args
                    args = None
                    if isinstance(msg, dict):
                        args = msg.get("arguments") or msg.get("args") or msg.get("input")
                    if args is None:
                        args = obj.get("arguments") or obj.get("args") or obj.get("input")
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except Exception:
                            args = {"_raw": args[:300]}
                    if isinstance(args, dict):
                        cwd = args.get("cwd") or args.get("workingDirectory")
                        if cwd:
                            stats["cwds"][str(cwd)] += 1
                        cmd = args.get("command") or args.get("cmd")
                        if cmd and len(stats["shell_commands_sample"]) < 8:
                            stats["shell_commands_sample"].append(str(cmd)[:160])
                        # thrash: re-read same path patterns
                        pth = args.get("path") or args.get("file")
                        if pth and tname in ("read", "Read", "ctx_read", "cat"):
                            pass
                elif kind == "toolResult":
                    tname = tool or "unknown"
                    stats["tools_result"][tname] += 1
                    content = ""
                    if isinstance(msg, dict):
                        c = msg.get("content") or msg.get("result") or msg.get("output")
                        if isinstance(c, str):
                            content = c
                        elif isinstance(c, list):
                            content = " ".join(
                                (x.get("text") if isinstance(x, dict) else str(x)) for x in c[:3]
                            )
                        elif c is not None:
                            content = str(c)[:500]
                    else:
                        content = str(obj.get("content") or obj.get("result") or "")[:500]
                    cl = content.lower()
                    # detect failures
                    fail_reasons = []
                    if is_err:
                        fail_reasons.append("isError")
                    if "blocked" in cl and ("allowlist" in cl or "security" in cl or "do not retry" in cl):
                        fail_reasons.append("allowlist_block")
                        stats["allowlist_blocks"] += 1
                    if "command not found" in cl:
                        fail_reasons.append("command_not_found")
                    if "permission denied" in cl:
                        fail_reasons.append("permission_denied")
                    if "eacces" in cl or "eperm" in cl:
                        fail_reasons.append("eacces")
                    if "enoent" in cl or "no such file" in cl:
                        fail_reasons.append("enoent")
                    if "timed out" in cl or "timeout" in cl:
                        fail_reasons.append("timeout")
                    if "rate limit" in cl or "429" in cl:
                        fail_reasons.append("rate_limit")
                    if "context" in cl and ("exceed" in cl or "too long" in cl or "overflow" in cl):
                        fail_reasons.append("context_overflow")
                        stats["context_thrash_signals"] += 1
                    if "compact" in cl:
                        stats["compaction_mentions"] += 1
                    if "error" in cl[:300] and not fail_reasons:
                        # soft error signal
                        if any(x in cl[:400] for x in ("error:", "failed", "exception", "traceback")):
                            fail_reasons.append("error_text")
                    if fail_reasons:
                        for fr in fail_reasons:
                            stats["tool_errors"][f"{tname}:{fr}"] += 1
                            stats["failure_details"][fr] += 1
                        if len(stats["error_samples"]) < 12:
                            stats["error_samples"].append(
                                {
                                    "tool": tname,
                                    "reasons": fail_reasons,
                                    "snippet": content[:220].replace("\n", " "),
                                }
                            )
                elif kind == "user":
                    stats["user_msgs"] += 1
                elif kind == "assistant":
                    stats["assistant_msgs"] += 1
                # content-level compaction / thrash
                raw = line.lower()
                if "compaction" in raw or "compacted" in raw:
                    stats["compaction_mentions"] += 1
                if "context cleared" in raw or "cleared: ctx_" in raw or "[dup of earlier" in raw:
                    stats["context_thrash_signals"] += 1
    except Exception as e:
        stats["scan_error"] = str(e)
    return stats


# Prefer workspace sessions + largest active sessions across tree
targets = []
seen = set()
for ts, p in sorted(ws, key=lambda x: -os.path.getsize(x[1])):
    if p not in seen:
        targets.append(p)
        seen.add(p)
for ts, p in sorted(in_window, key=lambda x: -os.path.getsize(x[1]))[:40]:
    if p not in seen:
        targets.append(p)
        seen.add(p)

# Cap scan set for depth=normal
targets = targets[:35]
print(f"\nSCANNING={len(targets)}")

all_stats = []
agg_tools = Counter()
agg_errors = Counter()
agg_fail_reasons = Counter()
agg_kinds = Counter()
agg_models = Counter()
agg_cwds = Counter()
sessions_with_tools = 0
sessions_idle = 0
total_tool_calls = 0
total_failures = 0
total_allowlist = 0
total_retries = 0
total_bytes = 0
long_sessions = []

for p in targets:
    st = scan_session(p)
    all_stats.append(st)
    total_bytes += st["bytes"]
    if st["has_tool"] or st["tools_call"]:
        sessions_with_tools += 1
    else:
        sessions_idle += 1
    tc = sum(st["tools_call"].values())
    total_tool_calls += tc
    fails = sum(st["tool_errors"].values())
    # count unique failure events more carefully: each error sample-ish
    fail_events = sum(st["failure_details"].values())
    total_failures += fail_events
    total_allowlist += st["allowlist_blocks"]
    total_retries += st["retry_signals"]
    agg_tools.update(st["tools_call"])
    agg_errors.update(st["tool_errors"])
    agg_fail_reasons.update(st["failure_details"])
    agg_kinds.update(st["kinds"])
    agg_models.update(st["models"])
    agg_cwds.update(st["cwds"])
    # long session heuristic: many lines or many tools
    if st["lines"] >= 200 or tc >= 80 or st["bytes"] >= 500_000:
        long_sessions.append(
            {
                "path": os.path.relpath(p, base),
                "bytes": st["bytes"],
                "lines": st["lines"],
                "toolCalls": tc,
                "failEvents": fail_events,
                "allowlist": st["allowlist_blocks"],
                "retries": st["retry_signals"],
                "topTools": st["tools_call"].most_common(5),
                "failTop": st["failure_details"].most_common(5),
                "models": st["models"].most_common(3),
                "first": st["first_ts"],
                "last": st["last_ts"],
                "users": st["user_msgs"],
                "errorSamples": st["error_samples"][:4],
            }
        )

print("\n=== AGGREGATE ===")
print(f"scanned_sessions={len(all_stats)}")
print(f"sessions_with_tools={sessions_with_tools}")
print(f"sessions_idle_no_tools={sessions_idle}")
print(f"total_tool_calls={total_tool_calls}")
print(f"total_failure_reason_counts={total_failures}")
print(f"total_allowlist_blocks={total_allowlist}")
print(f"total_retry_signals={total_retries}")
print(f"total_bytes_scanned={total_bytes}")
print("TOP_TOOLS:")
for t, c in agg_tools.most_common(20):
    print(f"  {t}: {c}")
print("TOP_FAIL_REASONS:")
for t, c in agg_fail_reasons.most_common(15):
    print(f"  {t}: {c}")
print("TOP_TOOL_ERRORS:")
for t, c in agg_errors.most_common(20):
    print(f"  {t}: {c}")
print("KINDS:")
for t, c in agg_kinds.most_common(20):
    print(f"  {t}: {c}")
print("MODELS:")
for t, c in agg_models.most_common(10):
    print(f"  {t}: {c}")
print("CWDS:")
for t, c in agg_cwds.most_common(15):
    print(f"  {t}: {c}")
print(f"LONG_SESSIONS={len(long_sessions)}")

# Per-session summary table
print("\n=== PER_SESSION ===")
rows = []
for st in all_stats:
    tc = sum(st["tools_call"].values())
    fe = sum(st["failure_details"].values())
    rows.append((tc, fe, st))
rows.sort(key=lambda x: (-x[0], -x[1]))
for tc, fe, st in rows:
    rel = os.path.relpath(st["path"], base)
    print(
        f"tools={tc:4d} fails={fe:3d} lines={st['lines']:5d} bytes={st['bytes']:8d} "
        f"allow={st['allowlist_blocks']:3d} retry={st['retry_signals']:3d} "
        f"models={list(st['models'].keys())[:2]} top={st['tools_call'].most_common(3)} :: {rel}"
    )

# Dump machine JSON for handoff drafting
out = {
    "inWindowSessionFiles": len(in_window),
    "scanned": len(all_stats),
    "sessionsWithTools": sessions_with_tools,
    "sessionsIdle": sessions_idle,
    "totalToolCalls": total_tool_calls,
    "totalFailureReasonCounts": total_failures,
    "allowlistBlocks": total_allowlist,
    "retrySignals": total_retries,
    "topTools": agg_tools.most_common(25),
    "topFailReasons": agg_fail_reasons.most_common(20),
    "topToolErrors": agg_errors.most_common(25),
    "kinds": dict(agg_kinds),
    "models": agg_models.most_common(15),
    "cwds": agg_cwds.most_common(20),
    "longSessions": long_sessions,
    "dirCounts": dirs_c.most_common(20),
    "perSession": [
        {
            "path": os.path.relpath(st["path"], base),
            "bytes": st["bytes"],
            "lines": st["lines"],
            "toolCalls": sum(st["tools_call"].values()),
            "failEvents": sum(st["failure_details"].values()),
            "allowlist": st["allowlist_blocks"],
            "retries": st["retry_signals"],
            "topTools": st["tools_call"].most_common(5),
            "failTop": st["failure_details"].most_common(5),
            "models": st["models"].most_common(3),
            "kinds": dict(st["kinds"]),
            "errorSamples": st["error_samples"][:5],
            "shellSample": st["shell_commands_sample"][:5],
            "first": st["first_ts"],
            "last": st["last_ts"],
            "userMsgs": st["user_msgs"],
            "compaction": st["compaction_mentions"],
            "thrash": st["context_thrash_signals"],
        }
        for st in sorted(all_stats, key=lambda s: -sum(s["tools_call"].values()))
    ],
}
out_path = "/home/alex/.pi/agent/.pi/better-harness/_run/pass-b-analysis.json"
with open(out_path, "w") as f:
    json.dump(out, f, indent=2, default=str)
print(f"\nWROTE {out_path}")
