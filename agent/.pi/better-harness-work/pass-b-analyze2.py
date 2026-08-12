#!/usr/bin/env python3
"""Pass B: correct Pi JSONL schema analysis for session evidence."""
import json, os, re, hashlib
from collections import Counter, defaultdict
from datetime import datetime, timezone

base = os.path.expanduser("~/.pi/agent/sessions")
window_start = datetime(2026, 7, 5, tzinfo=timezone.utc)
window_end = datetime(2026, 8, 4, 23, 59, 59, tzinfo=timezone.utc)
out_path = "/home/alex/.pi/agent/.pi/better-harness/_run/pass-b-analysis.json"

# Prefer lead helper if present
inspect_path = "/home/alex/.pi/agent/.pi/better-harness/_run/session-inspect.txt"


def parse_ts_from_name(path):
    bn = os.path.basename(path)
    m = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})", bn)
    if not m:
        # nested run session.jsonl — use parent dir
        parts = path.split(os.sep)
        for p in parts:
            m = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})", p)
            if m:
                break
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y-%m-%dT%H-%M-%S").replace(tzinfo=timezone.utc)
    except Exception:
        return None


files = []
for root, dirs, fnames in os.walk(base):
    for f in fnames:
        if f.endswith(".jsonl"):
            files.append(os.path.join(root, f))

in_window = []
for p in files:
    ts = parse_ts_from_name(p)
    if ts and window_start <= ts <= window_end:
        in_window.append((ts, p))
in_window.sort(key=lambda x: x[0], reverse=True)

# Workspace-first portfolio (agent work loop)
ws = [x for x in in_window if "--home-alex-.pi-agent--" in x[1]]
# Eligible set from packet = 12: take largest workspace sessions that look like work
ws_sorted = sorted(ws, key=lambda x: -os.path.getsize(x[1]))

# Also include top work sessions from other dirs for pattern triangulation
others = [x for x in in_window if "--home-alex-.pi-agent--" not in x[1]]
others_sorted = sorted(others, key=lambda x: -os.path.getsize(x[1]))

# Depth=normal: packet says 12 eligible selected. Analyze those 12 workspace + expand to ~20 largest active for patterns.
targets = []
seen = set()
for ts, p in ws_sorted:
    if p not in seen:
        targets.append(p)
        seen.add(p)
    if len(targets) >= 12:
        break
# expand for evidence if needed
for ts, p in others_sorted[:15]:
    if p not in seen and os.path.getsize(p) >= 200_000:
        targets.append(p)
        seen.add(p)
    if len(targets) >= 25:
        break

print(f"IN_WINDOW={len(in_window)} WS={len(ws)} TARGETS={len(targets)}")
print("PRIMARY12:")
for p in targets[:12]:
    print(f"  {os.path.getsize(p):8d} {os.path.relpath(p, base)}")


def text_from_content(content):
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for x in content:
            if isinstance(x, dict):
                if x.get("type") == "text":
                    parts.append(x.get("text") or "")
                elif "text" in x:
                    parts.append(str(x.get("text") or ""))
                else:
                    parts.append(json.dumps(x)[:200])
            else:
                parts.append(str(x))
        return "\n".join(parts)
    return str(content)


def fail_reasons_from_text(text, is_error_flag):
    reasons = []
    cl = (text or "").lower()
    if is_error_flag:
        reasons.append("isError")
    if "blocked" in cl and (
        "allowlist" in cl or "security" in cl or "do not retry" in cl or "permanent security"
    ):
        reasons.append("allowlist_block")
    if "command not found" in cl:
        reasons.append("command_not_found")
    if "permission denied" in cl:
        reasons.append("permission_denied")
    if "eacces" in cl or "eperm" in cl:
        reasons.append("eacces")
    if "enoent" in cl or "no such file" in cl or "does not exist" in cl or "could not read" in cl:
        reasons.append("enoent")
    if "could not find" in cl and ("old" in cl or "oldtext" in cl or "string" in cl):
        reasons.append("edit_context_miss")
    if "timed out" in cl or "timeout" in cl:
        reasons.append("timeout")
    if "rate limit" in cl or "429" in cl:
        reasons.append("rate_limit")
    if "context" in cl and ("exceed" in cl or "too long" in cl or "overflow" in cl):
        reasons.append("context_overflow")
    if "lean-ctx failed" in cl:
        reasons.append("lean_ctx_failed")
    if "not a directory" in cl:
        reasons.append("not_a_directory")
    if "empty directory" in cl:
        reasons.append("empty_dir_listing")
    if "traceback" in cl or "exception:" in cl:
        reasons.append("exception")
    if not reasons and is_error_flag:
        pass  # already isError
    elif not is_error_flag and any(
        x in cl[:500] for x in ("error:", "failed", "exception", "traceback", "ERROR:")
    ):
        # soft failures where isError=false but text screams error
        if "error" in cl[:400] or "failed" in cl[:400]:
            reasons.append("soft_error_text")
    return reasons


def scan_session(path):
    st = {
        "path": path,
        "rel": os.path.relpath(path, base),
        "bytes": os.path.getsize(path),
        "lines": 0,
        "types": Counter(),
        "roles": Counter(),
        "tools_call": Counter(),
        "tools_result": Counter(),
        "tool_errors": Counter(),  # tool:reason
        "fail_reasons": Counter(),
        "error_samples": [],
        "models": Counter(),
        "providers": Counter(),
        "cwd": None,
        "first_ts": None,
        "last_ts": None,
        "user_msgs": 0,
        "assistant_msgs": 0,
        "tool_results": 0,
        "tool_calls": 0,
        "is_error_true": 0,
        "allowlist_blocks": 0,
        "compactions": 0,
        "compaction_tokens_before": [],
        "model_changes": 0,
        "retry_pairs": 0,
        "same_tool_streak_max": 0,
        "edit_misses": 0,
        "read_misses": 0,
        "shell_blocks": 0,
        "shell_cmds": Counter(),
        "shell_samples": [],
        "failed_tool_sequence": [],  # recent fail tool names for loops
        "path_reads": Counter(),
        "reread_hot": [],
        "stop_reasons": Counter(),
        "custom_types": Counter(),
        "user_prompts_sample": [],
        "usage_totals": {"input": 0, "output": 0, "cacheRead": 0, "totalTokens": 0, "n": 0},
        "turn_tool_counts": [],
        "episodes_with_tools": 0,
        "validation_repair_signals": 0,
        "boundary_change_signals": 0,
        "lifecycle_signals": 0,
        "operation_control_signals": 0,
        "readonly_signals": 0,
    }
    prev_calls = []  # list of (name, args_hash)
    streak_name = None
    streak_n = 0
    last_fail_tools = []
    current_assistant_tools = 0

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                st["lines"] += 1
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                t = obj.get("type")
                st["types"][str(t)] += 1
                ts = obj.get("timestamp")
                if ts:
                    if st["first_ts"] is None:
                        st["first_ts"] = ts
                    st["last_ts"] = ts

                if t == "session":
                    st["cwd"] = obj.get("cwd")
                elif t == "model_change":
                    st["model_changes"] += 1
                    if obj.get("modelId"):
                        st["models"][str(obj["modelId"])] += 1
                    if obj.get("provider"):
                        st["providers"][str(obj["provider"])] += 1
                elif t == "compaction":
                    st["compactions"] += 1
                    if obj.get("tokensBefore") is not None:
                        st["compaction_tokens_before"].append(obj.get("tokensBefore"))
                elif t == "custom":
                    st["custom_types"][str(obj.get("customType") or "custom")] += 1
                elif t == "message":
                    msg = obj.get("message") or {}
                    role = msg.get("role")
                    st["roles"][str(role)] += 1
                    if msg.get("model"):
                        st["models"][str(msg["model"])] += 1
                    if msg.get("provider"):
                        st["providers"][str(msg["provider"])] += 1
                    if msg.get("stopReason"):
                        st["stop_reasons"][str(msg["stopReason"])] += 1
                    usage = msg.get("usage") or {}
                    if usage:
                        st["usage_totals"]["input"] += usage.get("input") or 0
                        st["usage_totals"]["output"] += usage.get("output") or 0
                        st["usage_totals"]["cacheRead"] += usage.get("cacheRead") or 0
                        st["usage_totals"]["totalTokens"] += usage.get("totalTokens") or 0
                        st["usage_totals"]["n"] += 1

                    if role == "user":
                        st["user_msgs"] += 1
                        txt = text_from_content(msg.get("content"))
                        if txt and len(st["user_prompts_sample"]) < 6:
                            st["user_prompts_sample"].append(txt[:240].replace("\n", " "))
                        low = txt.lower()
                        if any(k in low for k in ("fix", "fix", "fix", "verify", "lint", "typecheck", "ci")):
                            st["validation_repair_signals"] += 1
                        if any(k in low for k in ("skill", "hook", "config", "settings", "boundary", "allowlist", "sandbox")):
                            st["boundary_change_signals"] += 1
                        if any(k in low for k in ("compact", "continue", "resume", "session", "context rot", "new session")):
                            st["lifecycle_signals"] += 1
                        if any(k in low for k in ("stop", "cancel", "retry", "run workflow", "background")):
                            st["operation_control_signals"] += 1
                        if any(k in low for k in ("read", "explain", "what is", "show", "audit", "review", "find")):
                            st["readonly_signals"] += 1

                    elif role == "assistant":
                        st["assistant_msgs"] += 1
                        content = msg.get("content") or []
                        calls_this = []
                        if isinstance(content, list):
                            for part in content:
                                if not isinstance(part, dict):
                                    continue
                                if part.get("type") == "toolCall":
                                    name = part.get("name") or "unknown"
                                    args = part.get("arguments") or {}
                                    st["tools_call"][name] += 1
                                    st["tool_calls"] += 1
                                    calls_this.append(name)
                                    # args hash for retry detection
                                    try:
                                        ah = hashlib.md5(
                                            json.dumps(args, sort_keys=True, default=str).encode()
                                        ).hexdigest()[:10]
                                    except Exception:
                                        ah = "x"
                                    if prev_calls and prev_calls[-1] == (name, ah):
                                        st["retry_pairs"] += 1
                                    prev_calls.append((name, ah))
                                    if len(prev_calls) > 30:
                                        prev_calls = prev_calls[-30:]
                                    if name == streak_name:
                                        streak_n += 1
                                    else:
                                        streak_name = name
                                        streak_n = 1
                                    st["same_tool_streak_max"] = max(st["same_tool_streak_max"], streak_n)

                                    if isinstance(args, dict):
                                        cmd = args.get("command")
                                        if cmd:
                                            # normalize first token
                                            first = str(cmd).strip().split()[0] if str(cmd).strip() else ""
                                            st["shell_cmds"][first[:40]] += 1
                                            if len(st["shell_samples"]) < 10:
                                                st["shell_samples"].append(str(cmd)[:180])
                                        pth = args.get("path")
                                        if pth and name in (
                                            "ctx_read",
                                            "read",
                                            "Read",
                                            "ctx_execute_file",
                                        ):
                                            st["path_reads"][str(pth)] += 1
                        if calls_this:
                            st["episodes_with_tools"] += 1
                            st["turn_tool_counts"].append(len(calls_this))
                            current_assistant_tools = len(calls_this)

                    elif role == "toolResult":
                        st["tool_results"] += 1
                        name = msg.get("toolName") or "unknown"
                        st["tools_result"][name] += 1
                        is_err = bool(msg.get("isError"))
                        txt = text_from_content(msg.get("content"))
                        reasons = fail_reasons_from_text(txt, is_err)
                        if is_err:
                            st["is_error_true"] += 1
                        if reasons:
                            for r in reasons:
                                st["fail_reasons"][r] += 1
                                st["tool_errors"][f"{name}:{r}"] += 1
                            if "allowlist_block" in reasons:
                                st["allowlist_blocks"] += 1
                                st["shell_blocks"] += 1
                            if "edit_context_miss" in reasons or (
                                is_err and name in ("edit", "Edit", "ctx_edit")
                            ):
                                st["edit_misses"] += 1
                            if "enoent" in reasons and name in ("ctx_read", "read", "Read"):
                                st["read_misses"] += 1
                            if len(st["error_samples"]) < 15:
                                st["error_samples"].append(
                                    {
                                        "tool": name,
                                        "reasons": reasons,
                                        "isError": is_err,
                                        "snippet": txt[:240].replace("\n", " "),
                                    }
                                )
                            last_fail_tools.append(name)
                            if len(last_fail_tools) > 8:
                                last_fail_tools = last_fail_tools[-8:]
                            # loop: same tool failed 3+ times in last 8
                            if last_fail_tools.count(name) >= 3:
                                st["failed_tool_sequence"].append(name)
    except Exception as e:
        st["scan_error"] = str(e)

    # hot rereads
    hot = [(p, c) for p, c in st["path_reads"].most_common(10) if c >= 3]
    st["reread_hot"] = hot
    return st


all_stats = [scan_session(p) for p in targets]
primary = all_stats[:12]
expanded = all_stats

# Aggregates on primary 12 (packet-aligned)
def agg(stats_list):
    a = {
        "n": len(stats_list),
        "toolCalls": sum(s["tool_calls"] for s in stats_list),
        "toolResults": sum(s["tool_results"] for s in stats_list),
        "isErrorTrue": sum(s["is_error_true"] for s in stats_list),
        "allowlist": sum(s["allowlist_blocks"] for s in stats_list),
        "compactions": sum(s["compactions"] for s in stats_list),
        "retries": sum(s["retry_pairs"] for s in stats_list),
        "editMisses": sum(s["edit_misses"] for s in stats_list),
        "readMisses": sum(s["read_misses"] for s in stats_list),
        "userMsgs": sum(s["user_msgs"] for s in stats_list),
        "assistantMsgs": sum(s["assistant_msgs"] for s in stats_list),
        "bytes": sum(s["bytes"] for s in stats_list),
        "lines": sum(s["lines"] for s in stats_list),
        "episodesWithTools": sum(s["episodes_with_tools"] for s in stats_list),
        "tools": Counter(),
        "failReasons": Counter(),
        "toolErrors": Counter(),
        "models": Counter(),
        "providers": Counter(),
        "stopReasons": Counter(),
        "shellCmds": Counter(),
        "sessionsWithTools": 0,
        "sessionsIdle": 0,
        "longSessions": 0,
        "errorRate": 0.0,
    }
    for s in stats_list:
        a["tools"].update(s["tools_call"])
        a["failReasons"].update(s["fail_reasons"])
        a["toolErrors"].update(s["tool_errors"])
        a["models"].update(s["models"])
        a["providers"].update(s["providers"])
        a["stopReasons"].update(s["stop_reasons"])
        a["shellCmds"].update(s["shell_cmds"])
        if s["tool_calls"] > 0:
            a["sessionsWithTools"] += 1
        else:
            a["sessionsIdle"] += 1
        if s["tool_calls"] >= 80 or s["lines"] >= 200 or s["bytes"] >= 500_000:
            a["longSessions"] += 1
    if a["toolResults"] > 0:
        a["errorRate"] = round(a["isErrorTrue"] / a["toolResults"], 4)
    return a


A12 = agg(primary)
AX = agg(expanded)

print("\n=== PRIMARY12 AGG ===")
print(f"sessions={A12['n']} withTools={A12['sessionsWithTools']} idle={A12['sessionsIdle']}")
print(f"toolCalls={A12['toolCalls']} toolResults={A12['toolResults']} isError={A12['isErrorTrue']} errRate={A12['errorRate']}")
print(f"allowlist={A12['allowlist']} retries={A12['retries']} editMiss={A12['editMisses']} readMiss={A12['readMisses']} compactions={A12['compactions']}")
print(f"longSessions={A12['longSessions']} episodesWithTools={A12['episodesWithTools']}")
print("TOP_TOOLS", A12["tools"].most_common(15))
print("FAIL_REASONS", A12["failReasons"].most_common(15))
print("TOOL_ERRORS", A12["toolErrors"].most_common(20))
print("MODELS", A12["models"].most_common(10))
print("PROVIDERS", A12["providers"].most_common(10))
print("SHELL_CMDS", A12["shellCmds"].most_common(15))

print("\n=== EXPANDED AGG ===")
print(f"sessions={AX['n']} toolCalls={AX['toolCalls']} isError={AX['isErrorTrue']} errRate={AX['errorRate']} allowlist={AX['allowlist']}")
print("TOP_TOOLS", AX["tools"].most_common(12))
print("FAIL_REASONS", AX["failReasons"].most_common(12))

print("\n=== PER SESSION PRIMARY ===")
for s in sorted(primary, key=lambda x: -x["tool_calls"]):
    print(
        f"tc={s['tool_calls']:4d} err={s['is_error_true']:3d} allow={s['allowlist_blocks']:2d} "
        f"retry={s['retry_pairs']:2d} editMiss={s['edit_misses']:2d} compact={s['compactions']} "
        f"users={s['user_msgs']:2d} models={s['models'].most_common(2)} "
        f"top={s['tools_call'].most_common(4)} :: {s['rel']}"
    )

# Build friction clusters
clusters = []


def add_cluster(cid, title, severity, sessions, metric, evidence, signals, recommendation):
    clusters.append(
        {
            "id": cid,
            "title": title,
            "severity": severity,
            "sessionCount": sessions,
            "metric": metric,
            "evidence": evidence,
            "signals": signals,
            "recommendation": recommendation,
        }
    )


# Cluster: tool isError rate high on shell/edit
if A12["isErrorTrue"] > 0:
    te = A12["toolErrors"].most_common(8)
    add_cluster(
        "friction-tool-errors",
        "High tool isError volume concentrated on shell and edit surfaces",
        "high" if A12["errorRate"] >= 0.08 else "medium",
        A12["sessionsWithTools"],
        {
            "isErrorTrue": A12["isErrorTrue"],
            "toolResults": A12["toolResults"],
            "errorRate": A12["errorRate"],
            "top": te,
        },
        [s["error_samples"][:2] for s in primary if s["error_samples"]][:5],
        ["failed-event", "repair-loop"],
        "Tighten tool preconditions (path existence, edit uniqueness) and route shell through allowlisted patterns; prefer ctx_* over raw bash where failures cluster.",
    )

if A12["allowlist"] > 0:
    add_cluster(
        "friction-allowlist",
        "Shell allowlist / security blocks mid-task",
        "high" if A12["allowlist"] >= 20 else "medium",
        sum(1 for s in primary if s["allowlist_blocks"] > 0),
        {"allowlistBlocks": A12["allowlist"], "shellBlocks": sum(s["shell_blocks"] for s in primary)},
        [ex for s in primary for ex in s["error_samples"] if "allowlist_block" in ex.get("reasons", [])][:6],
        ["allowlist-block", "boundary-friction"],
        "Pre-declare needed interpreters/commands in allowlist or force write-script-then-run pattern in skill instructions to avoid blocked heredoc python.",
    )

if A12["editMisses"] > 0:
    add_cluster(
        "friction-edit-miss",
        "Edit/ctx_edit context misses and failed patches",
        "medium",
        sum(1 for s in primary if s["edit_misses"] > 0),
        {"editMisses": A12["editMisses"]},
        [ex for s in primary for ex in s["error_samples"] if ex.get("tool") in ("edit", "Edit", "ctx_edit")][:5],
        ["edit-miss", "repair-loop"],
        "Re-read target span immediately before edit; on miss fall back to sed/perl via shell once; avoid identical retry.",
    )

if A12["readMisses"] > 0:
    add_cluster(
        "friction-read-miss",
        "Read path misses (enoent / could not read)",
        "medium",
        sum(1 for s in primary if s["read_misses"] > 0),
        {"readMisses": A12["readMisses"]},
        [ex for s in primary for ex in s["error_samples"] if "enoent" in ex.get("reasons", [])][:5],
        ["path-miss", "discovery-waste"],
        "ls/find before read; expand ~ and relative paths against session cwd; cache discovered roots.",
    )

if A12["compactions"] > 0:
    add_cluster(
        "lifecycle-compaction",
        "Compaction events in long agent sessions",
        "medium" if A12["compactions"] >= 2 else "low",
        sum(1 for s in primary if s["compactions"] > 0),
        {
            "compactions": A12["compactions"],
            "tokensBefore": [tb for s in primary for tb in s["compaction_tokens_before"]][:10],
        },
        [{"rel": s["rel"], "compactions": s["compactions"], "tokensBefore": s["compaction_tokens_before"]} for s in primary if s["compactions"]][:5],
        ["compaction", "lifecycle-demand"],
        "Ensure compaction + continue hooks remain error-free; keep task state in durable files outside context.",
    )

if A12["retries"] > 0:
    add_cluster(
        "friction-identical-retry",
        "Identical tool-call retries detected",
        "medium" if A12["retries"] >= 10 else "low",
        sum(1 for s in primary if s["retry_pairs"] > 0),
        {"retryPairs": A12["retries"]},
        [{"rel": s["rel"], "retries": s["retry_pairs"], "maxStreak": s["same_tool_streak_max"]} for s in primary if s["retry_pairs"]][:6],
        ["retry-loop"],
        "After one failure, change args or strategy; never identical retry on blocked/edit-miss.",
    )

# Model churn
model_churn_sessions = [s for s in primary if s["model_changes"] >= 2 or len(s["models"]) >= 2]
if model_churn_sessions:
    add_cluster(
        "ops-model-churn",
        "Multi-model switching within sessions",
        "low",
        len(model_churn_sessions),
        {"sessions": len(model_churn_sessions), "models": A12["models"].most_common(8)},
        [{"rel": s["rel"], "models": s["models"].most_common(4), "changes": s["model_changes"]} for s in model_churn_sessions][:6],
        ["model-switch", "operation-control"],
        "Pin model per task class when switching correlates with repair loops; log why switches happen.",
    )

# Idle / short sessions
idle = [s for s in primary if s["tool_calls"] == 0]
if idle:
    add_cluster(
        "portfolio-idle-sessions",
        "Eligible sessions with zero tool calls",
        "info",
        len(idle),
        {"idle": len(idle)},
        [{"rel": s["rel"], "users": s["user_msgs"], "bytes": s["bytes"]} for s in idle][:6],
        ["idle"],
        "Exclude pure chat/idle from work-loop KPI denominators.",
    )

# Dominant tool pattern
if A12["tools"]:
    top_tool, top_n = A12["tools"].most_common(1)[0]
    add_cluster(
        "pattern-tool-mix",
        f"Dominant tool mix led by {top_tool}",
        "info",
        A12["sessionsWithTools"],
        {"topTools": A12["tools"].most_common(10), "shellCmds": A12["shellCmds"].most_common(10)},
        [{"rel": s["rel"], "top": s["tools_call"].most_common(5)} for s in primary if s["tool_calls"]][:6],
        ["tool-mix", "read-only-work" if "read" in top_tool or "ctx_read" in top_tool else "operation-control"],
        "Bias defaults toward high-success tools; add skill guardrails where failure density is highest.",
    )

# Cross-check lead inspect numbers if file exists
lead_note = None
if os.path.exists(inspect_path):
    lead_note = open(inspect_path).read()[:2000]

out = {
    "schemaVersion": 1,
    "pass": "B",
    "lane": "session-evidence",
    "window": {"start": "2026-07-05", "end": "2026-08-04", "until": "2026-08-04T00:00:00.000Z"},
    "packetScope": {
        "eligibleSessions": 12,
        "selectedSessions": 12,
        "platform": "pi",
        "workspace": "agent",
        "selection": "all-eligible",
    },
    "inventory": {
        "inWindowJsonl": len(in_window),
        "workspaceSessionsInWindow": len(ws),
        "primaryScanned": len(primary),
        "expandedScanned": len(expanded),
        "primaryPaths": [s["rel"] for s in primary],
    },
    "aggregatePrimary12": {
        **{k: v for k, v in A12.items() if not isinstance(v, Counter)},
        "topTools": A12["tools"].most_common(20),
        "failReasons": A12["failReasons"].most_common(20),
        "toolErrors": A12["toolErrors"].most_common(25),
        "models": A12["models"].most_common(15),
        "providers": A12["providers"].most_common(10),
        "stopReasons": A12["stopReasons"].most_common(10),
        "shellCmds": A12["shellCmds"].most_common(15),
    },
    "aggregateExpanded": {
        **{k: v for k, v in AX.items() if not isinstance(v, Counter)},
        "topTools": AX["tools"].most_common(15),
        "failReasons": AX["failReasons"].most_common(15),
        "toolErrors": AX["toolErrors"].most_common(20),
    },
    "clusters": clusters,
    "perSessionPrimary": [
        {
            "rel": s["rel"],
            "bytes": s["bytes"],
            "lines": s["lines"],
            "cwd": s["cwd"],
            "toolCalls": s["tool_calls"],
            "toolResults": s["tool_results"],
            "isErrorTrue": s["is_error_true"],
            "errorRate": round(s["is_error_true"] / s["tool_results"], 4) if s["tool_results"] else None,
            "allowlist": s["allowlist_blocks"],
            "retries": s["retry_pairs"],
            "editMisses": s["edit_misses"],
            "readMisses": s["read_misses"],
            "compactions": s["compactions"],
            "compactionTokensBefore": s["compaction_tokens_before"],
            "userMsgs": s["user_msgs"],
            "assistantMsgs": s["assistant_msgs"],
            "episodesWithTools": s["episodes_with_tools"],
            "maxToolStreak": s["same_tool_streak_max"],
            "models": s["models"].most_common(5),
            "providers": s["providers"].most_common(5),
            "topTools": s["tools_call"].most_common(8),
            "failReasons": s["fail_reasons"].most_common(8),
            "toolErrors": s["tool_errors"].most_common(8),
            "stopReasons": s["stop_reasons"].most_common(5),
            "shellCmds": s["shell_cmds"].most_common(8),
            "rereadHot": s["reread_hot"][:5],
            "errorSamples": s["error_samples"][:6],
            "userPromptsSample": s["user_prompts_sample"][:4],
            "classSignals": {
                "validationRepair": s["validation_repair_signals"],
                "boundaryChange": s["boundary_change_signals"],
                "lifecycle": s["lifecycle_signals"],
                "operationControl": s["operation_control_signals"],
                "readOnly": s["readonly_signals"],
            },
            "first": s["first_ts"],
            "last": s["last_ts"],
            "usage": s["usage_totals"],
        }
        for s in sorted(primary, key=lambda x: -x["tool_calls"])
    ],
    "leadInspectNote": lead_note,
}

with open(out_path, "w") as f:
    json.dump(out, f, indent=2, default=str)
print(f"\nWROTE {out_path}")

# Print key error samples
print("\n=== SAMPLE ERRORS PRIMARY ===")
for s in primary:
    if not s["error_samples"]:
        continue
    print("SESSION", s["rel"])
    for ex in s["error_samples"][:3]:
        print(" ", ex)
