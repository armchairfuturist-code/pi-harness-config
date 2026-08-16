#!/usr/bin/env python3
"""
Shared session parsing and error detection for harness-doctor scripts.

Used by: trajectory_metrics.py, rot-analysis.py, read_cost.py
Single source of truth for error classification — fixes the duplication that
caused rot-forensics.py (56% false positives) and trajectory_metrics.py
(undercounted MCP errors 2.2x) to disagree.

Error detection is two-tier:
  Tier 1: strict patterns in first 500 chars (real errors — low FP rate)
  Tier 2: broad keywords in first 200 chars only (fallback)

The 200-char limit on tier 2 is critical: file contents routinely contain
"error", "failed", "not found" as normal text (React error boundaries,
build output saying "Errors: 0", documentation). Matching these anywhere
in the result caused 56% false positives in the original rot-forensics.
"""
import json, re, os, glob, math
from collections import defaultdict

SESSIONS_ROOT = os.path.expanduser("~/.pi/agent/sessions")

# ── Error detection ────────────────────────────────────────────────────

# Broad keywords — tier 2 fallback, first 200 chars only
ERROR_KEYWORDS = [
    "error", "failed", "blocked", "not found", "no such file",
    "denied", "exception", "command exited with code",
]

# Strict patterns — tier 1, first 500 chars. These are real error indicators.
STRICT_ERROR_PATTERNS = [
    "enoent", "no such file", "command exited with code",
    "permission denied", "not found:", "is not recognized",
    "cannot find", "unable to", "failed to", "error:",
    "exception", "traceback", "errno", "eacces",
    "lean-ctx internal error", "mcp bridge not connected",
    "mcp server is still running", "timed out", "timeout",
    "path escapes project root", "validation failed",
]

# Harness layer classification (for trajectory_metrics)
LAYER_SIGS = [
    (r'command not found|ENOENT|No such file or directory', "env_path"),
    (r'Could not find|Validation failed for tool|target.*is required', "tool_interface"),
    (r'MCP bridge not connected|lean-ctx internal error|MCP server is still running', "mcp_bridge"),
    (r'BLOCKED — DO NOT RETRY|allowlist', "policy"),
]

# Tool classification (for rot-analysis behavioral signals)
EDIT_TOOLS = {
    "edit", "write", "ctx_edit", "ctx_write", "ctx_patch", "multiedit",
    "str_replace_editor", "apply_patch", "patch", "replace", "write_file",
    "write_to_file", "replace_in_file", "apply_diff", "insert_content",
    "search_and_replace", "edit_file", "ctx_refactor",
}
READ_TOOLS = {
    "read", "ctx_read", "cat", "grep", "ctx_grep", "find", "ctx_find",
    "ctx_shell", "ctx_batch_execute", "read_file", "read_many_files",
    "ctx_execute_file", "ls", "ctx_ls", "ctx_overview", "ctx_tree",
}

# Self-correction regex (from contextrot methodology)
SELF_CORRECTION_RE = re.compile(
    r"\b(i apologize|apologies|my mistake|my error|i made a mistake|"
    r"i made an error|let me (fix|correct) (that|this|my)|"
    r"that was (wrong|incorrect)|that's (wrong|incorrect)|"
    r"i was wrong|oops|correcting my)\b", re.IGNORECASE,
)

TARGET_KEYS = ["file_path", "path", "url", "pattern", "command", "query", "file"]
RETRY_WINDOW = 6

# Rot curve parameters (from contextrot methodology)
MIN_BUCKET_N = 15
LOW_FILL_MAX = 40
HIGH_FILL_MIN = 60
KNEE_RATIO = 1.5
VERDICT_MIN_RATIO = 1.3
VERDICT_MIN_N = 150
DEFAULT_WINDOW = 200000

# Noise patterns to strip from session text
NOISE_PATTERNS = [
    re.compile(r"<environment_context>.*?</environment_context>", re.DOTALL),
    re.compile(r"<permissions instructions>.*?</permissions instructions>", re.DOTALL),
    re.compile(r"<skills_instructions>.*?</skills_instructions>", re.DOTALL),
    re.compile(r"# AGENTS\.md instructions.*?(?=\n\n|\Z)", re.DOTALL),
]


def is_error_result(result_text: str) -> bool:
    """Two-tier error detection. Call this instead of substring matching."""
    rl = result_text.lower()
    first_500 = rl[:500]
    if any(p in first_500 for p in STRICT_ERROR_PATTERNS):
        return True
    # Fallback: broad keywords in first 200 chars only
    return any(kw in rl[:200] for kw in ERROR_KEYWORDS)


def classify_error_layer(result_text: str) -> str:
    """Classify error by harness layer (for trajectory_metrics)."""
    s = json.dumps(result_text)[:400]
    for pat, layer in LAYER_SIGS:
        if re.search(pat, s, re.I):
            return layer
    return "other"


def extract_target(args: dict) -> str:
    """Extract a coarse target from tool call arguments."""
    for key in TARGET_KEYS:
        val = args.get(key, "")
        if val:
            return str(val).split("\n")[0][:300]
    return ""


def session_jsonls(limit=None):
    """All cwd slugs under ~/.pi/agent/sessions, largest first."""
    files = glob.glob(os.path.join(SESSIONS_ROOT, "**", "*.jsonl"), recursive=True)
    files.sort(key=os.path.getsize, reverse=True)
    if limit is not None:
        return files[:limit]
    return files


def parse_session(filepath):
    """Parse a pi JSONL session file into raw entries."""
    entries = []
    for line in open(filepath, errors="ignore"):
        try:
            entries.append(json.loads(line))
        except Exception:
            pass
    return entries


def extract_signals(entries, context_window=DEFAULT_WINDOW):
    """Extract rot signals from parsed session entries.
    Returns normalized steps compatible with contextrot methodology.
    """
    session_meta = {}
    raw_messages = []
    compactions = []
    model_changes = []

    for e in entries:
        t = e.get("type")
        if t == "session":
            session_meta = e
        elif t == "message":
            raw_messages.append(e)
        elif t == "compaction":
            compactions.append(e)
        elif t == "model_change":
            model_changes.append(e)

    steps = []
    current_step = None
    files_read = set()
    recent_errors = {}
    cumulative_input = 0

    for i, msg in enumerate(raw_messages):
        m = msg.get("message", {})
        role = m.get("role", "?")
        usage = m.get("usage", {})
        content = m.get("content", [])
        ts = msg.get("timestamp", "")
        in_tok = usage.get("input", 0)
        out_tok = usage.get("output", 0)
        cache_read = usage.get("cacheRead", 0)
        cache_write = usage.get("cacheWrite", 0)
        cumulative_input += in_tok

        if role == "assistant":
            if current_step:
                steps.append(current_step)
            fill_tokens = in_tok + cache_read + cache_write
            fill_pct = (fill_tokens / context_window * 100) if context_window else 0
            current_step = {
                "idx": i, "step_num": len(steps) + 1, "timestamp": ts,
                "input_tokens": in_tok, "output_tokens": out_tok,
                "cache_read": cache_read, "cache_write": cache_write,
                "fill_tokens": fill_tokens, "fill_pct": fill_pct,
                "cumulative_input": cumulative_input,
                "tool_calls": [], "text": "", "signals": set(),
                "degraded": False, "reversal_count": 0,
            }
            for c in content:
                if not isinstance(c, dict):
                    continue
                ct = c.get("type")
                if ct == "text":
                    raw_text = c.get("text", "")
                    for pattern in NOISE_PATTERNS:
                        raw_text = pattern.sub("", raw_text)
                    current_step["text"] += raw_text
                elif ct == "toolCall":
                    tool_name = (c.get("name") or "").lower()
                    args = c.get("arguments", {})
                    target = extract_target(args)
                    current_step["tool_calls"].append({
                        "name": tool_name, "target": target,
                        "args": args, "is_error": False,
                    })
                    if tool_name in READ_TOOLS and target:
                        files_read.add(target)
        elif role == "toolResult" and current_step:
            result_text = ""
            for c in content:
                if isinstance(c, dict) and c.get("type") == "text":
                    result_text += c.get("text", "")
            is_error = is_error_result(result_text)
            for tc in reversed(current_step["tool_calls"]):
                if not tc.get("result_matched"):
                    tc["is_error"] = is_error
                    tc["result_matched"] = True
                    tc["result_size"] = len(result_text)
                    break

    if current_step:
        steps.append(current_step)

    # Apply contextrot behavioral signals
    for step_idx, step in enumerate(steps):
        has_tool_error = any(tc["is_error"] for tc in step["tool_calls"])
        has_edit_failure = any(
            tc["is_error"] and tc["name"] in EDIT_TOOLS for tc in step["tool_calls"]
        )
        has_retry = False
        for tc in step["tool_calls"]:
            if tc["is_error"]:
                key = (tc["name"], tc["target"])
                if key in recent_errors:
                    if step_idx - recent_errors[key] <= RETRY_WINDOW:
                        has_retry = True
                recent_errors[key] = step_idx
        has_reread = False
        for tc in step["tool_calls"]:
            if tc["name"] in READ_TOOLS and tc["target"]:
                if tc["target"] in files_read:
                    prev_reads = set()
                    for prev_step in steps[:step_idx]:
                        for prev_tc in prev_step["tool_calls"]:
                            if prev_tc["name"] in READ_TOOLS:
                                prev_reads.add(prev_tc["target"])
                    if tc["target"] in prev_reads:
                        has_reread = True
                files_read.add(tc["target"])
        has_self_correction = bool(SELF_CORRECTION_RE.search(step["text"]))

        step["signals"] = set()
        if has_tool_error: step["signals"].add("tool_error")
        if has_edit_failure: step["signals"].add("edit_failure")
        if has_retry: step["signals"].add("retry")
        if has_reread: step["signals"].add("reread")
        if has_self_correction: step["signals"].add("self_correction")
        step["degraded"] = len(step["signals"]) > 0
        step["reversal_count"] = sum(
            1 for s in steps[:step_idx]
            if s["signals"] & {"self_correction", "retry", "edit_failure"}
        )

    return {
        "session_meta": session_meta, "steps": steps,
        "compactions": compactions, "model_changes": model_changes,
        "context_window": context_window, "cumulative_input": cumulative_input,
    }


def wilson_interval(successes: int, n: int, z: float = 1.96):
    """Wilson score 95% confidence interval for a proportion."""
    if n == 0:
        return (0.0, 0.0)
    p = successes / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    spread = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denom
    return (max(0.0, center - spread), min(1.0, center + spread))
