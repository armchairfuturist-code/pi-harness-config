#!/usr/bin/env python3
"""
Context-Rot Forensics for pi coding agent sessions.

Combines the contextrot project's proven statistical methodology
(Wilson-interval bucketing, knee detection, 5 behavioral signals)
with pi-specific extensions (token bloat curves, compaction tracking,
model-swap detection, live monitoring).

Methodology credit: github.com/Priyanshu-byte-coder/contextrot
Adapted for pi's JSONL session format.

Usage:
  python3 rot-forensics.py                      # top 5 sessions + summary
  python3 rot-forensics.py <file.jsonl>         # specific session
  python3 rot-rot_forensics.py --all            # all sessions
  python3 rot-forensics.py --summary            # cross-session summary
  python3 rot-forensics.py --live <file>        # live-monitor active session
  python3 rot-forensics.py --contextrot <file>  # contextrot-compatible analysis

Signals (from contextrot methodology + pi extensions):
  BEHAVIORAL (contextrot):
    1. tool_error    — any tool call returned an error
    2. edit_failure  — an editing tool returned an error (strongest signal)
    3. retry         — step repeats a (tool, target) that errored within 6 steps
    4. reread        — step re-reads a file already read earlier
    5. self_correction — assistant text matches apology/correction phrases
  PI-SPECIFIC:
    6. token_bloat   — per-turn input jump > threshold
    7. output_decline — avg output tokens dropping in later quartiles
    8. compaction    — context overflow forced reset
    9. model_swap    — operator switched models mid-session (degradation proxy)
"""
import json, sys, os, re, glob, argparse, math
from collections import Counter, defaultdict
from datetime import datetime

SESSIONS_ROOT = os.path.expanduser("~/.pi/agent/sessions")
ROT_LOG = os.path.expanduser("~/.pi/agent/memory/rot-log.jsonl")

def session_jsonls(limit=None):
    """All cwd slugs under ~/.pi/agent/sessions, largest first."""
    files = glob.glob(os.path.join(SESSIONS_ROOT, "**", "*.jsonl"), recursive=True)
    files.sort(key=os.path.getsize, reverse=True)
    if limit is not None:
        return files[:limit]
    return files

# === contextrot signal definitions (adapted for pi) ===
# Broad keywords — used as fallback only (first 200 chars). Strict patterns above are primary.
# Substring matching these against full tool result text caused 56% false positives (file contents).
ERROR_KEYWORDS = ["error", "failed", "blocked", "not found", "no such file", "denied", "exception", "command exited with code"]

# Tool name sets (case-insensitive — pi uses lowercase, but be tolerant)
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

# Noise to strip from session text (from Kote's sync-ai technique)
# These injected scaffolding blocks skew signal density if not removed
NOISE_PATTERNS = [
    re.compile(r"<environment_context>.*?</environment_context>", re.DOTALL),
    re.compile(r"<permissions instructions>.*?</permissions instructions>", re.DOTALL),
    re.compile(r"<skills_instructions>.*?</skills_instructions>", re.DOTALL),
    re.compile(r"# AGENTS\.md instructions.*?(?=\n\n|\Z)", re.DOTALL),
]

# Self-correction regex (from contextrot)
SELF_CORRECTION_RE = re.compile(
    r"\b(i apologize|apologies|my mistake|my error|i made a mistake|"
    r"i made an error|let me (fix|correct) (that|this|my)|"
    r"that was (wrong|incorrect)|that's (wrong|incorrect)|"
    r"i was wrong|oops|correcting my)\b",
    re.IGNORECASE,
)

# Target extraction priority (from contextrot)
TARGET_KEYS = ["file_path", "path", "url", "pattern", "command", "query", "file"]

# Retry window (from contextrot)
RETRY_WINDOW = 6

# Rot curve parameters (from contextrot)
MIN_BUCKET_N = 15
LOW_FILL_MAX = 40   # fresh zone: < 40% fill
HIGH_FILL_MIN = 60  # deep zone: >= 60% fill
KNEE_RATIO = 1.5
VERDICT_MIN_RATIO = 1.3
VERDICT_MIN_N = 150
DEFAULT_WINDOW = 200000  # default context window if not detected


def wilson_interval(successes: int, n: int, z: float = 1.96):
    """Wilson score 95% confidence interval for a proportion."""
    if n == 0:
        return (0.0, 0.0)
    p = successes / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    spread = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denom
    return (max(0.0, center - spread), min(1.0, center + spread))


def extract_target(args: dict) -> str:
    """Extract a coarse target from tool call arguments."""
    for key in TARGET_KEYS:
        val = args.get(key, "")
        if val:
            return str(val).split("\n")[0][:300]
    return ""


def parse_session(filepath):
    """Parse a pi JSONL session file."""
    entries = []
    for line in open(filepath):
        try:
            entries.append(json.loads(line))
        except:
            pass
    return entries


def extract_signals(entries, context_window=DEFAULT_WINDOW):
    """
    Extract rot signals from parsed session entries.
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

    # Build normalized steps (one step = one assistant turn + its tool results)
    steps = []
    current_step = None
    files_read = set()
    recent_errors = {}  # (tool, target) -> step_idx of last error
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
            # Start new step
            if current_step:
                steps.append(current_step)

            fill_tokens = in_tok + cache_read + cache_write
            fill_pct = (fill_tokens / context_window * 100) if context_window else 0

            current_step = {
                "idx": i,
                "step_num": len(steps) + 1,
                "timestamp": ts,
                "input_tokens": in_tok,
                "output_tokens": out_tok,
                "cache_read": cache_read,
                "cache_write": cache_write,
                "fill_tokens": fill_tokens,
                "fill_pct": fill_pct,
                "cumulative_input": cumulative_input,
                "tool_calls": [],
                "text": "",
                "signals": set(),
                "degraded": False,
                "reversal_count": 0,
            }

            # Extract text and tool calls from content
            for c in content:
                if not isinstance(c, dict):
                    continue
                ct = c.get("type")
                if ct == "text":
                    raw_text = c.get("text", "")
                    # Strip injected scaffolding noise (Kote technique)
                    for pattern in NOISE_PATTERNS:
                        raw_text = pattern.sub("", raw_text)
                    current_step["text"] += raw_text
                elif ct == "toolCall":
                    tool_name = (c.get("name") or "").lower()
                    args = c.get("arguments", {})
                    target = extract_target(args)
                    current_step["tool_calls"].append({
                        "name": tool_name,
                        "target": target,
                        "args": args,
                        "is_error": False,
                    })
                    # Track file reads
                    if tool_name in READ_TOOLS and target:
                        files_read.add(target)

        elif role == "toolResult" and current_step:
            # Match tool result to last tool call
            tool_call_id = m.get("toolCallId", "")
            result_text = ""
            for c in content:
                if isinstance(c, dict) and c.get("type") == "text":
                    result_text += c.get("text", "")

            # Mark error on the last unmatched tool call
            # Two-tier error detection (fixes 56% false-positive rate):
            # Tier 1: strict patterns in first 500 chars (real errors)
            # Tier 2: broad keywords anywhere (fallback, but only if tier 1 misses)
            _rl = result_text.lower()
            _strict_patterns = ["enoent", "no such file", "command exited with code",
                                "permission denied", "not found:", "is not recognized",
                                "cannot find", "unable to", "failed to", "error:",
                                "exception", "traceback", "errno", "eacces",
                                "lean-ctx internal error", "mcp bridge not connected",
                                "mcp server is still running", "timed out", "timeout",
                                "path escapes project root", "validation failed"]
            _first_500 = _rl[:500]
            is_error = any(p in _first_500 for p in _strict_patterns)
            if not is_error:
                # Fallback: broad keywords, but only in first 200 chars to avoid
                # matching file contents that happen to contain "error" or "failed"
                is_error = any(kw in _rl[:200] for kw in ERROR_KEYWORDS)
            for tc in reversed(current_step["tool_calls"]):
                if not tc.get("result_matched"):
                    tc["is_error"] = is_error
                    tc["result_matched"] = True
                    tc["result_size"] = len(result_text)
                    break

        elif role == "user" and current_step:
            # User messages within a step (rare in pi, but handle)
            pass

    if current_step:
        steps.append(current_step)

    # === Apply contextrot signals ===
    reversal_history = []
    for step_idx, step in enumerate(steps):
        # Signal 1: tool_error
        has_tool_error = any(tc["is_error"] for tc in step["tool_calls"])

        # Signal 2: edit_failure
        has_edit_failure = any(
            tc["is_error"] and tc["name"] in EDIT_TOOLS
            for tc in step["tool_calls"]
        )

        # Signal 3: retry (same tool+target errored within RETRY_WINDOW steps)
        has_retry = False
        for tc in step["tool_calls"]:
            if tc["is_error"]:
                key = (tc["name"], tc["target"])
                if key in recent_errors:
                    if step_idx - recent_errors[key] <= RETRY_WINDOW:
                        has_retry = True
                # Update recent_errors
                recent_errors[key] = step_idx

        # Signal 4: reread
        has_reread = False
        for tc in step["tool_calls"]:
            if tc["name"] in READ_TOOLS and tc["target"]:
                if tc["target"] in files_read:
                    # Was it read in a PREVIOUS step?
                    prev_reads = set()
                    for prev_step in steps[:step_idx]:
                        for prev_tc in prev_step["tool_calls"]:
                            if prev_tc["name"] in READ_TOOLS:
                                prev_reads.add(prev_tc["target"])
                    if tc["target"] in prev_reads:
                        has_reread = True
                files_read.add(tc["target"])

        # Signal 5: self_correction
        has_self_correction = bool(SELF_CORRECTION_RE.search(step["text"]))

        # Set signals
        step["signals"] = set()
        if has_tool_error:
            step["signals"].add("tool_error")
        if has_edit_failure:
            step["signals"].add("edit_failure")
        if has_retry:
            step["signals"].add("retry")
        if has_reread:
            step["signals"].add("reread")
        if has_self_correction:
            step["signals"].add("self_correction")

        step["degraded"] = len(step["signals"]) > 0

        # Reversal count: count prior steps with self_correction, retry, or edit_failure
        reversal_count = sum(
            1 for s in steps[:step_idx]
            if s["signals"] & {"self_correction", "retry", "edit_failure"}
        )
        step["reversal_count"] = reversal_count

    return {
        "session_meta": session_meta,
        "steps": steps,
        "compactions": compactions,
        "model_changes": model_changes,
        "context_window": context_window,
        "cumulative_input": cumulative_input,
    }


def compute_rot_curve(steps, context_window=DEFAULT_WINDOW):
    """
    Compute the rot curve using contextrot's methodology:
    10-point fill-% buckets, Wilson CIs, knee detection, verdict.
    """
    # Bucket steps by fill %
    buckets = defaultdict(lambda: {"total": 0, "degraded": 0})
    for step in steps:
        bucket = int(step["fill_pct"] // 10) * 10
        bucket = min(90, max(0, bucket))
        buckets[bucket]["total"] += 1
        if step["degraded"]:
            buckets[bucket]["degraded"] += 1

    # Compute per-bucket statistics
    bucket_stats = []
    for bucket in sorted(buckets.keys()):
        b = buckets[bucket]
        rate = b["degraded"] / b["total"] if b["total"] > 0 else 0
        ci_lo, ci_hi = wilson_interval(b["degraded"], b["total"])
        bucket_stats.append({
            "bucket": bucket,
            "bucket_label": f"{bucket}-{bucket+10}%",
            "n": b["total"],
            "degraded": b["degraded"],
            "rate": rate,
            "ci_lo": ci_lo,
            "ci_hi": ci_hi,
            "low_confidence": b["total"] < MIN_BUCKET_N,
        })

    # Fresh zone: < LOW_FILL_MAX, Deep zone: >= HIGH_FILL_MIN
    fresh_steps = [s for s in steps if s["fill_pct"] < LOW_FILL_MAX]
    deep_steps = [s for s in steps if s["fill_pct"] >= HIGH_FILL_MIN]

    fresh_degraded = sum(1 for s in fresh_steps if s["degraded"])
    deep_degraded = sum(1 for s in deep_steps if s["degraded"])
    fresh_rate = fresh_degraded / len(fresh_steps) if fresh_steps else 0
    deep_rate = deep_degraded / len(deep_steps) if deep_steps else 0
    fresh_ci = wilson_interval(fresh_degraded, len(fresh_steps)) if fresh_steps else (0, 0)
    deep_ci = wilson_interval(deep_degraded, len(deep_steps)) if deep_steps else (0, 0)

    degradation_ratio = deep_rate / fresh_rate if fresh_rate > 0 else float("inf") if deep_rate > 0 else 0

    # Significance: deep CI floor clears fresh CI ceiling
    significant = deep_ci[0] > fresh_ci[1] if fresh_steps and deep_steps else False

    # Adaptive zone fallback (from contextrot methodology):
    # If either fixed zone has < VERDICT_MIN_N steps, fall back to percentiles
    # of the user's own fill distribution (40th / 80th pct, must be >= 8 points apart)
    adaptive = False
    adaptive_low = LOW_FILL_MAX
    adaptive_high = HIGH_FILL_MIN
    if len(fresh_steps) < VERDICT_MIN_N or len(deep_steps) < VERDICT_MIN_N:
        fill_pcts = sorted(s["fill_pct"] for s in steps)
        if len(fill_pcts) >= 20:
            p40 = fill_pcts[int(len(fill_pcts) * 0.40)]
            p80 = fill_pcts[int(len(fill_pcts) * 0.80)]
            if p80 - p40 >= 8:
                adaptive = True
                adaptive_low = p40
                adaptive_high = p80
                fresh_steps = [s for s in steps if s["fill_pct"] < p40]
                deep_steps = [s for s in steps if s["fill_pct"] >= p80]
                fresh_degraded = sum(1 for s in fresh_steps if s["degraded"])
                deep_degraded = sum(1 for s in deep_steps if s["degraded"])
                fresh_rate = fresh_degraded / len(fresh_steps) if fresh_steps else 0
                deep_rate = deep_degraded / len(deep_steps) if deep_steps else 0
                fresh_ci = wilson_interval(fresh_degraded, len(fresh_steps)) if fresh_steps else (0, 0)
                deep_ci = wilson_interval(deep_degraded, len(deep_steps)) if deep_steps else (0, 0)
                degradation_ratio = deep_rate / fresh_rate if fresh_rate > 0 else float("inf") if deep_rate > 0 else 0
                significant = deep_ci[0] > fresh_ci[1] if fresh_steps and deep_steps else False

    # Knee detection — accept low-confidence buckets if n >= 5 (pi sessions are shorter)
    knee = None
    knee_boundary = int(adaptive_low) if adaptive else LOW_FILL_MAX
    for bs in bucket_stats:
        if bs["bucket"] < knee_boundary:
            continue
        if bs["low_confidence"] and bs["n"] < 5:
            continue
        if fresh_rate > 0 and bs["rate"] >= fresh_rate * KNEE_RATIO:
            if bs["ci_lo"] > fresh_ci[1] or bs["n"] >= 10:
                knee = bs["bucket"]
                break

    # Verdict — tuned for pi's shorter sessions (PI_MIN_N instead of VERDICT_MIN_N)
    PI_MIN_N = 10
    if not fresh_steps or not deep_steps:
        verdict = "insufficient"
    elif len(fresh_steps) < PI_MIN_N or len(deep_steps) < PI_MIN_N:
        verdict = "insufficient"
    elif significant and degradation_ratio >= VERDICT_MIN_RATIO:
        verdict = "rot"
    elif knee is not None:
        verdict = "edge"
    else:
        verdict = "clean"

    return {
        "bucket_stats": bucket_stats,
        "fresh_rate": fresh_rate,
        "deep_rate": deep_rate,
        "fresh_n": len(fresh_steps),
        "deep_n": len(deep_steps),
        "fresh_ci": fresh_ci,
        "deep_ci": deep_ci,
        "degradation_ratio": degradation_ratio,
        "significant": significant,
        "knee": knee,
        "verdict": verdict,
        "adaptive": adaptive,
        "adaptive_low": adaptive_low,
        "adaptive_high": adaptive_high,
    }


def analyze_session(filepath, verbose=True, context_window=DEFAULT_WINDOW):
    """Analyze a single session with full contextrot methodology."""
    entries = parse_session(filepath)
    data = extract_signals(entries, context_window)
    steps = data["steps"]
    fname = os.path.basename(filepath)

    if len(steps) < 3:
        if verbose:
            print(f"\n{'='*70}\nSESSION: {fname}\n  ({len(steps)} steps — skipping, need ≥3)")
        return None

    rot = compute_rot_curve(steps, context_window)

    print(f"\n{'='*70}")
    print(f"SESSION: {fname}")
    print(f"  cwd: {data['session_meta'].get('cwd', '?')}")
    print(f"  Steps: {len(steps)} | Compactions: {len(data['compactions'])} | Model swaps: {len(data['model_changes'])}")
    print(f"  Context window: {context_window:,} | Final cumulative input: {data['cumulative_input']:,}")

    # === ROT CURVE ===
    print(f"\n--- ROT CURVE (contextrot methodology) ---")
    print(f"  {'Bucket':<12} {'N':>4} {'Degraded':>8} {'Rate':>6} {'95% CI':>20} {'Conf':>6}")
    print(f"  {'-'*60}")
    for bs in rot["bucket_stats"]:
        conf = "LOW" if bs["low_confidence"] else "ok"
        ci_str = f"[{bs['ci_lo']:.2f}, {bs['ci_hi']:.2f}]"
        print(f"  {bs['bucket_label']:<12} {bs['n']:>4} {bs['degraded']:>8} {bs['rate']:>5.1%} {ci_str:>20} {conf:>6}")

    if rot["adaptive"]:
        print(f"  Fresh zone (<{rot['adaptive_low']:.0f}%): rate={rot['fresh_rate']:.1%} (n={rot['fresh_n']}, CI [{rot['fresh_ci'][0]:.2f}, {rot['fresh_ci'][1]:.2f}]) [ADAPTIVE]")
        print(f"  Deep zone (≥{rot['adaptive_high']:.0f}%): rate={rot['deep_rate']:.1%} (n={rot['deep_n']}, CI [{rot['deep_ci'][0]:.2f}, {rot['deep_ci'][1]:.2f}]) [ADAPTIVE]")
    else:
        print(f"  Fresh zone (<{LOW_FILL_MAX}%): rate={rot['fresh_rate']:.1%} (n={rot['fresh_n']}, CI [{rot['fresh_ci'][0]:.2f}, {rot['fresh_ci'][1]:.2f}])")
        print(f"  Deep zone (≥{HIGH_FILL_MIN}%): rate={rot['deep_rate']:.1%} (n={rot['deep_n']}, CI [{rot['deep_ci'][0]:.2f}, {rot['deep_ci'][1]:.2f}])")
    print(f"  Degradation ratio: {rot['degradation_ratio']:.2f}x | Significant: {rot['significant']}")

    if rot["knee"] is not None:
        print(f"  ⚠️  KNEE detected at {rot['knee']}% fill — quality starts collapsing here")
    else:
        print(f"  No knee detected")

    verdict_emoji = {"rot": "🔴", "edge": "🟡", "clean": "🟢", "insufficient": "⚪"}.get(rot["verdict"], "?")
    print(f"  {verdict_emoji} VERDICT: {rot['verdict'].upper()}")

    # === SIGNAL BREAKDOWN ===
    print(f"\n--- SIGNAL BREAKDOWN ---")
    signal_counts = Counter()
    for step in steps:
        for sig in step["signals"]:
            signal_counts[sig] += 1
    total_degraded = sum(1 for s in steps if s["degraded"])
    print(f"  Total steps: {len(steps)} | Degraded: {total_degraded} ({total_degraded/len(steps):.1%})")
    for sig in ["tool_error", "edit_failure", "retry", "reread", "self_correction"]:
        count = signal_counts.get(sig, 0)
        pct = count / len(steps) * 100 if steps else 0
        print(f"  {sig:20s}: {count:3d} ({pct:.1f}%)")

    # === PI-SPECIFIC SIGNALS ===
    print(f"\n--- PI-SPECIFIC SIGNALS ---")

    # Token bloat
    bloat_events = []
    for j in range(1, len(steps)):
        delta = steps[j]["input_tokens"] - steps[j-1]["input_tokens"]
        if delta > 5000:
            bloat_events.append((steps[j]["step_num"], delta, steps[j]["input_tokens"], steps[j]["cumulative_input"]))
    if bloat_events:
        print(f"  Bloat events (input jump >5k):")
        for sn, delta, inp, cum in sorted(bloat_events, key=lambda x: -x[1])[:5]:
            print(f"    step {sn:3d}: +{delta:>7,} tokens (input={inp:>7,}, cumulative={cum:>8,})")
    else:
        print(f"  No significant bloat events.")

    # Output decline (quartile analysis)
    if len(steps) > 10:
        print(f"\n  Output decline (quartile analysis):")
        q = max(1, len(steps) // 4)
        for label, start, end in [("Q1", 0, q), ("Q2", q, 2*q), ("Q3", 2*q, 3*q), ("Q4", 3*q, len(steps))]:
            q_steps = steps[start:end]
            if not q_steps:
                continue
            avg_out = sum(s["output_tokens"] for s in q_steps) / len(q_steps)
            avg_in = sum(s["input_tokens"] for s in q_steps) / len(q_steps)
            deg = sum(1 for s in q_steps if s["degraded"])
            print(f"    {label} (steps {q_steps[0]['step_num']:3d}-{q_steps[-1]['step_num']:3d}): "
                  f"avg_in={avg_in:>8,.0f}  avg_out={avg_out:>6,.0f}  degraded={deg}/{len(q_steps)}")

    # Compaction
    if data["compactions"]:
        print(f"\n  COMPACTION EVENTS ({len(data['compactions'])}):")
        for c in data["compactions"]:
            tokens_before = c.get("tokensBefore", "?")
            print(f"    tokensBefore={tokens_before}, ts={c.get('timestamp', '?')[:19]}")

    # Model swaps
    if data["model_changes"]:
        print(f"\n  MODEL CHANGES ({len(data['model_changes'])}):")
        for mc in data["model_changes"]:
            print(f"    {mc.get('timestamp', '?')[:19]}: {mc.get('provider', '?')}/{mc.get('modelId', '?')}")

    # === COLLAPSE POINT ===
    print(f"\n--- COLLAPSE POINT ---")
    if rot["knee"] is not None:
        # Find the step at the knee fill %
        knee_steps = [s for s in steps if s["fill_pct"] >= rot["knee"]]
        if knee_steps:
            first_knee = knee_steps[0]
            print(f"  Knee at {rot['knee']}% fill → step {first_knee['step_num']}, "
                  f"cumulative {first_knee['cumulative_input']:,} tokens")
    else:
        # Fallback: behavioral collapse detection
        collapse = None
        for j in range(5, len(steps)):
            before = steps[max(0, j-5):j]
            after = steps[j:j+5]
            if not before or not after:
                continue
            before_deg = sum(1 for s in before if s["degraded"])
            after_deg = sum(1 for s in after if s["degraded"])
            before_avg_in = sum(s["input_tokens"] for s in before) / len(before)
            after_avg_in = sum(s["input_tokens"] for s in after) / len(after)
            if after_deg > before_deg * 2 and after_avg_in > before_avg_in * 2 and after_deg >= 3:
                collapse = steps[j]
                break
        if collapse:
            print(f"  ⚠️  Behavioral collapse at step {collapse['step_num']} "
                  f"(cumulative {collapse['cumulative_input']:,} tokens, fill {collapse['fill_pct']:.1f}%)")
        else:
            print(f"  No collapse point detected.")

    return {"data": data, "rot": rot, "file": fname}


def cross_session_summary():
    """Cross-session rot summary using contextrot methodology."""
    files = session_jsonls()
    print(f"\n{'='*70}")
    print(f"CROSS-SESSION ROT SUMMARY ({len(files)} sessions)")
    print(f"Methodology: contextrot (Wilson CI bucketing + knee detection + 5 behavioral signals)")
    print(f"{'='*70}\n")

    all_data = []
    for f in files:
        entries = parse_session(f)
        data = extract_signals(entries)
        steps = data["steps"]
        if len(steps) < 3:
            continue

        rot = compute_rot_curve(steps)
        signal_counts = Counter()
        for s in steps:
            for sig in s["signals"]:
                signal_counts[sig] += 1

        # Find knee step
        knee_step = None
        if rot["knee"] is not None:
            knee_steps = [s for s in steps if s["fill_pct"] >= rot["knee"]]
            if knee_steps:
                knee_step = knee_steps[0]

        all_data.append({
            "file": os.path.basename(f),
            "steps": len(steps),
            "cum_input": data["cumulative_input"],
            "degraded_pct": sum(1 for s in steps if s["degraded"]) / len(steps),
            "tool_errors": signal_counts.get("tool_error", 0),
            "edit_failures": signal_counts.get("edit_failure", 0),
            "retries": signal_counts.get("retry", 0),
            "rereads": signal_counts.get("reread", 0),
            "self_corrections": signal_counts.get("self_correction", 0),
            "compactions": len(data["compactions"]),
            "model_swaps": len(data["model_changes"]),
            "verdict": rot["verdict"],
            "ratio": rot["degradation_ratio"],
            "knee": rot["knee"],
            "knee_step": knee_step["step_num"] if knee_step else None,
            "knee_tokens": knee_step["cumulative_input"] if knee_step else None,
        })

    # Print table
    print(f"{'Session':<45} {'Steps':>5} {'Degr%':>5} {'Ratio':>6} {'Knee':>5} {'KneeTok':>10} {'Verdict':>12}")
    print("-" * 95)
    for d in all_data:
        knee = f"{d['knee']}%" if d["knee"] is not None else "-"
        knee_tok = f"{d['knee_tokens']:,}" if d["knee_tokens"] else "-"
        print(f"{d['file'][:45]:<45} {d['steps']:>5} {d['degraded_pct']:>4.0%} {d['ratio']:>5.1f}x {knee:>5} {knee_tok:>10} {d['verdict']:>12}")

    # Aggregate
    print(f"\n--- AGGREGATE ---")
    rot_sessions = [d for d in all_data if d["verdict"] == "rot"]
    edge_sessions = [d for d in all_data if d["verdict"] == "edge"]
    clean_sessions = [d for d in all_data if d["verdict"] == "clean"]
    insufficient = [d for d in all_data if d["verdict"] == "insufficient"]

    print(f"  Rot: {len(rot_sessions)} | Edge: {len(edge_sessions)} | Clean: {len(clean_sessions)} | Insufficient: {len(insufficient)}")

    knees = [d for d in all_data if d["knee"] is not None]
    if knees:
        avg_knee = sum(d["knee"] for d in knees) / len(knees)
        avg_knee_tokens = sum(d["knee_tokens"] for d in knees) / len(knees)
        avg_knee_step = sum(d["knee_step"] for d in knees) / len(knees)
        print(f"  Sessions with knee: {len(knees)}/{len(all_data)}")
        print(f"  Average knee: {avg_knee:.0f}% fill, step {avg_knee_step:.0f}, {avg_knee_tokens:,.0f} cumulative tokens")
        print(f"\n  ⚠️  YOUR SESSIONS ROT AT: ~{avg_knee:.0f}% context fill / step {avg_knee_step:.0f} / {avg_knee_tokens:,.0f} tokens")
        print(f"  → Handoff BEFORE this point (ce-lite should trigger at ~{max(20, avg_knee-15):.0f}% fill)")

    # Signal frequency
    print(f"\n--- SIGNAL FREQUENCY (across all sessions) ---")
    total_steps = sum(d["steps"] for d in all_data)
    total_signals = {
        "tool_error": sum(d["tool_errors"] for d in all_data),
        "edit_failure": sum(d["edit_failures"] for d in all_data),
        "retry": sum(d["retries"] for d in all_data),
        "reread": sum(d["rereads"] for d in all_data),
        "self_correction": sum(d["self_corrections"] for d in all_data),
    }
    for sig, count in sorted(total_signals.items(), key=lambda x: -x[1]):
        pct = count / total_steps * 100 if total_steps else 0
        print(f"  {sig:20s}: {count:4d} ({pct:.1f}% of {total_steps} steps)")

    # Check rot-log
    if os.path.exists(ROT_LOG):
        print(f"\n--- LIVE ROT-LOG (from rot-sentinel extension) ---")
        rot_events = []
        for line in open(ROT_LOG):
            try:
                rot_events.append(json.loads(line))
            except:
                pass
        if rot_events:
            warnings = [e for e in rot_events if e.get("type") == "rot_warning"]
            handoffs = [e for e in rot_events if e.get("type") == "handoff_triggered"]
            compactions = [e for e in rot_events if e.get("type") == "compaction"]
            print(f"  Events: {len(rot_events)} | Warnings: {len(warnings)} | Handoffs: {len(handoffs)} | Compactions: {len(compactions)}")


def live_monitor(filepath):
    """Tail-follow a session file for live rot monitoring."""
    print(f"Live monitoring: {filepath}")
    print(f"Watching for rot signals... (Ctrl+C to stop)\n")
    print(f"  {'Turn':>4}  {'Input':>8}  {'Output':>6}  {'Cumulative':>10}  {'Fill%':>5}  {'Signals':>30}")
    print(f"  {'-'*75}")

    with open(filepath, "r") as f:
        f.seek(0, 2)
        cumulative = 0
        turn = 0
        files_read = set()
        recent_errors = {}
        step_signals = set()

        while True:
            line = f.readline()
            if not line:
                import time
                time.sleep(0.5)
                continue
            try:
                e = json.loads(line)
            except:
                continue

            if e.get("type") == "message":
                m = e.get("message", {})
                role = m.get("role", "?")
                usage = m.get("usage", {})
                content = m.get("content", [])

                if role == "assistant":
                    in_tok = usage.get("input", 0)
                    out_tok = usage.get("output", 0)
                    cumulative += in_tok
                    if in_tok:
                        turn += 1
                        fill_pct = in_tok / DEFAULT_WINDOW * 100

                        sig_str = ", ".join(sorted(step_signals)) if step_signals else ""
                        bar = "#" * min(30, int(fill_pct / 3))
                        print(f"  {turn:>4}  {in_tok:>7,}  {out_tok:>5,}  {cumulative:>9,}  {fill_pct:>4.1f}%  {sig_str:<30} {bar}")
                        step_signals = set()

                        # Alert on high fill
                        if fill_pct > 55:
                            print(f"  {'':>4}  ⚠️  FILL WARNING: {fill_pct:.1f}% — approaching rot zone")
                        if fill_pct > 70:
                            print(f"  {'':>4}  🔴 ROT CRITICAL: {fill_pct:.1f}% — trigger handoff now")

                elif role == "toolResult":
                    text = ""
                    for c in content:
                        if isinstance(c, dict) and c.get("type") == "text":
                            text += c.get("text", "")
                    # Use strict error detection (fixes false positives from file content)
                    _text_lower = text.lower()[:500]
                    if any(p in _text_lower for p in ["enoent", "no such file", "command exited with code",
                                                          "permission denied", "error:", "exception", "traceback",
                                                          "lean-ctx internal error", "mcp bridge not connected",
                                                          "mcp server is still running", "timed out", "timeout",
                                                          "path escapes project root", "validation failed",
                                                          "failed to", "unable to", "not found:", "blocked"]):
                        step_signals.add("tool_error")
                    if len(text) > 5000:
                        print(f"  {'':>4}  🔴 BLOAT: tool result = {len(text):,} chars")

            elif e.get("type") == "compaction":
                print(f"  ═══ COMPACTION at cumulative={cumulative:,} tokens ═══")
                cumulative = 0
            elif e.get("type") == "model_change":
                print(f"  ─── MODEL CHANGE: {e.get('provider', '?')}/{e.get('modelId', '?')} ───")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Context-rot forensics for pi sessions (contextrot methodology)")
    parser.add_argument("file", nargs="?", help="Specific session file to analyze")
    parser.add_argument("--all", action="store_true", help="Analyze all sessions")
    parser.add_argument("--summary", action="store_true", help="Cross-session summary only")
    parser.add_argument("--live", metavar="FILE", help="Live-monitor a session file")
    parser.add_argument("--window", type=int, default=DEFAULT_WINDOW, help="Context window size (default: 200000)")
    args = parser.parse_args()

    if args.live:
        live_monitor(args.live)
    elif args.summary:
        cross_session_summary()
    elif args.file:
        analyze_session(args.file, context_window=args.window)
    elif args.all:
        for f in session_jsonls():
            analyze_session(f, context_window=args.window)
    else:
        cross_session_summary()
        files = session_jsonls(limit=5)
        for f in files:
            analyze_session(f, context_window=args.window)
