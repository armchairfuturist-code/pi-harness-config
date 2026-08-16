#!/usr/bin/env python3
"""
Context-rot analysis for pi coding agent sessions.

Implements the contextrot project's statistical methodology (Wilson-interval
bucketing, knee detection, 5 behavioral signals) adapted for pi's JSONL format.
Uses shared error detection from _session_utils.py (single source of truth).

Merged from the former context-rot-forensics skill into harness-doctor.

Usage:
  python3 rot-analysis.py              # top 5 sessions + summary
  python3 rot-analysis.py --all        # all sessions
  python3 rot-analysis.py --summary    # cross-session summary only
  python3 rot-analysis.py <file.jsonl> # specific session
  python3 rot-analysis.py --live <f>   # live-monitor active session

Methodology credit: github.com/Priyanshu-byte-coder/contextrot
"""
import sys, os, re, argparse
from collections import Counter, defaultdict

# Import shared utilities (same directory)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _session_utils as su


def compute_rot_curve(steps, context_window=su.DEFAULT_WINDOW):
    """Compute the rot curve: 10-point fill-% buckets, Wilson CIs, knee detection."""
    buckets = defaultdict(lambda: {"total": 0, "degraded": 0})
    for step in steps:
        bucket = int(step["fill_pct"] // 10) * 10
        bucket = min(90, max(0, bucket))
        buckets[bucket]["total"] += 1
        if step["degraded"]:
            buckets[bucket]["degraded"] += 1

    bucket_stats = []
    for bucket in sorted(buckets.keys()):
        b = buckets[bucket]
        rate = b["degraded"] / b["total"] if b["total"] > 0 else 0
        ci_lo, ci_hi = su.wilson_interval(b["degraded"], b["total"])
        bucket_stats.append({
            "bucket": bucket, "bucket_label": f"{bucket}-{bucket+10}%",
            "n": b["total"], "degraded": b["degraded"], "rate": rate,
            "ci_lo": ci_lo, "ci_hi": ci_hi,
            "low_confidence": b["total"] < su.MIN_BUCKET_N,
        })

    fresh_steps = [s for s in steps if s["fill_pct"] < su.LOW_FILL_MAX]
    deep_steps = [s for s in steps if s["fill_pct"] >= su.HIGH_FILL_MIN]
    fresh_degraded = sum(1 for s in fresh_steps if s["degraded"])
    deep_degraded = sum(1 for s in deep_steps if s["degraded"])
    fresh_rate = fresh_degraded / len(fresh_steps) if fresh_steps else 0
    deep_rate = deep_degraded / len(deep_steps) if deep_steps else 0
    fresh_ci = su.wilson_interval(fresh_degraded, len(fresh_steps)) if fresh_steps else (0, 0)
    deep_ci = su.wilson_interval(deep_degraded, len(deep_steps)) if deep_steps else (0, 0)
    degradation_ratio = deep_rate / fresh_rate if fresh_rate > 0 else float("inf") if deep_rate > 0 else 0
    significant = deep_ci[0] > fresh_ci[1] if fresh_steps and deep_steps else False

    # Adaptive zone fallback
    adaptive = False
    adaptive_low = su.LOW_FILL_MAX
    adaptive_high = su.HIGH_FILL_MIN
    if len(fresh_steps) < su.VERDICT_MIN_N or len(deep_steps) < su.VERDICT_MIN_N:
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
                fresh_ci = su.wilson_interval(fresh_degraded, len(fresh_steps)) if fresh_steps else (0, 0)
                deep_ci = su.wilson_interval(deep_degraded, len(deep_steps)) if deep_steps else (0, 0)
                degradation_ratio = deep_rate / fresh_rate if fresh_rate > 0 else float("inf") if deep_rate > 0 else 0
                significant = deep_ci[0] > fresh_ci[1] if fresh_steps and deep_steps else False

    # Knee detection
    knee = None
    knee_boundary = int(adaptive_low) if adaptive else su.LOW_FILL_MAX
    for bs in bucket_stats:
        if bs["bucket"] < knee_boundary:
            continue
        if bs["low_confidence"] and bs["n"] < 5:
            continue
        if fresh_rate > 0 and bs["rate"] >= fresh_rate * su.KNEE_RATIO:
            if bs["ci_lo"] > fresh_ci[1] or bs["n"] >= 10:
                knee = bs["bucket"]
                break

    PI_MIN_N = 10
    if not fresh_steps or not deep_steps:
        verdict = "insufficient"
    elif len(fresh_steps) < PI_MIN_N or len(deep_steps) < PI_MIN_N:
        verdict = "insufficient"
    elif significant and degradation_ratio >= su.VERDICT_MIN_RATIO:
        verdict = "rot"
    elif knee is not None:
        verdict = "edge"
    else:
        verdict = "clean"

    return {
        "bucket_stats": bucket_stats, "fresh_rate": fresh_rate,
        "deep_rate": deep_rate, "fresh_n": len(fresh_steps),
        "deep_n": len(deep_steps), "fresh_ci": fresh_ci, "deep_ci": deep_ci,
        "degradation_ratio": degradation_ratio, "significant": significant,
        "knee": knee, "verdict": verdict, "adaptive": adaptive,
        "adaptive_low": adaptive_low, "adaptive_high": adaptive_high,
    }


def analyze_session(filepath, verbose=True, context_window=su.DEFAULT_WINDOW):
    """Analyze a single session with full contextrot methodology."""
    entries = su.parse_session(filepath)
    data = su.extract_signals(entries, context_window)
    steps = data["steps"]
    fname = os.path.basename(filepath)

    if len(steps) < 3:
        if verbose:
            print(f"\n{'='*70}\nSESSION: {fname}\n ({len(steps)} steps — skipping, need >=3)")
        return None

    rot = compute_rot_curve(steps, context_window)

    print(f"\n{'='*70}")
    print(f"SESSION: {fname}")
    print(f" cwd: {data['session_meta'].get('cwd', '?')}")
    print(f" Steps: {len(steps)} | Compactions: {len(data['compactions'])} | Model swaps: {len(data['model_changes'])}")
    print(f" Context window: {context_window:,} | Final cumulative input: {data['cumulative_input']:,}")

    print(f"\n--- ROT CURVE (contextrot methodology) ---")
    print(f" {'Bucket':<12} {'N':>4} {'Degraded':>8} {'Rate':>6} {'95% CI':>20} {'Conf':>6}")
    print(f" {'-'*60}")
    for bs in rot["bucket_stats"]:
        conf = "LOW" if bs["low_confidence"] else "ok"
        ci_str = f"[{bs['ci_lo']:.2f}, {bs['ci_hi']:.2f}]"
        print(f" {bs['bucket_label']:<12} {bs['n']:>4} {bs['degraded']:>8} {bs['rate']:>5.1%} {ci_str:>20} {conf:>6}")

    if rot["adaptive"]:
        print(f" Fresh zone (<{rot['adaptive_low']:.0f}%): rate={rot['fresh_rate']:.1%} (n={rot['fresh_n']}, CI [{rot['fresh_ci'][0]:.2f}, {rot['fresh_ci'][1]:.2f}]) [ADAPTIVE]")
        print(f" Deep zone (>={rot['adaptive_high']:.0f}%): rate={rot['deep_rate']:.1%} (n={rot['deep_n']}, CI [{rot['deep_ci'][0]:.2f}, {rot['deep_ci'][1]:.2f}]) [ADAPTIVE]")
    else:
        print(f" Fresh zone (<{su.LOW_FILL_MAX}%): rate={rot['fresh_rate']:.1%} (n={rot['fresh_n']}, CI [{rot['fresh_ci'][0]:.2f}, {rot['fresh_ci'][1]:.2f}])")
        print(f" Deep zone (>={su.HIGH_FILL_MIN}%): rate={rot['deep_rate']:.1%} (n={rot['deep_n']}, CI [{rot['deep_ci'][0]:.2f}, {rot['deep_ci'][1]:.2f}])")
    print(f" Degradation ratio: {rot['degradation_ratio']:.2f}x | Significant: {rot['significant']}")

    if rot["knee"] is not None:
        print(f" KNEE detected at {rot['knee']}% fill — quality starts collapsing here")
    else:
        print(f" No knee detected")

    verdict_emoji = {"rot": "🔴", "edge": "🟡", "clean": "🟢", "insufficient": "⚪"}.get(rot["verdict"], "?")
    print(f" {verdict_emoji} VERDICT: {rot['verdict'].upper()}")

    print(f"\n--- SIGNAL BREAKDOWN ---")
    signal_counts = Counter()
    for step in steps:
        for sig in step["signals"]:
            signal_counts[sig] += 1
    total_degraded = sum(1 for s in steps if s["degraded"])
    print(f" Total steps: {len(steps)} | Degraded: {total_degraded} ({total_degraded/len(steps):.1%})")
    for sig in ["tool_error", "edit_failure", "retry", "reread", "self_correction"]:
        count = signal_counts.get(sig, 0)
        pct = count / len(steps) * 100 if steps else 0
        print(f" {sig:20s}: {count:3d} ({pct:.1f}%)")

    print(f"\n--- PI-SPECIFIC SIGNALS ---")
    bloat_events = []
    for j in range(1, len(steps)):
        delta = steps[j]["input_tokens"] - steps[j-1]["input_tokens"]
        if delta > 5000:
            bloat_events.append((steps[j]["step_num"], delta, steps[j]["input_tokens"], steps[j]["cumulative_input"]))
    if bloat_events:
        print(f" Bloat events (input jump >5k):")
        for sn, delta, inp, cum in sorted(bloat_events, key=lambda x: -x[1])[:5]:
            print(f"  step {sn:3d}: +{delta:>7,} tokens (input={inp:>7,}, cumulative={cum:>8,})")
    else:
        print(f" No significant bloat events.")

    if len(steps) > 10:
        print(f"\n Output decline (quartile analysis):")
        q = max(1, len(steps) // 4)
        for label, start, end in [("Q1", 0, q), ("Q2", q, 2*q), ("Q3", 2*q, 3*q), ("Q4", 3*q, len(steps))]:
            q_steps = steps[start:end]
            if not q_steps: continue
            avg_out = sum(s["output_tokens"] for s in q_steps) / len(q_steps)
            avg_in = sum(s["input_tokens"] for s in q_steps) / len(q_steps)
            deg = sum(1 for s in q_steps if s["degraded"])
            print(f"  {label} (steps {q_steps[0]['step_num']:3d}-{q_steps[-1]['step_num']:3d}): "
                  f"avg_in={avg_in:>8.0f} avg_out={avg_out:>6.0f} degraded={deg}/{len(q_steps)}")

    if data["compactions"]:
        print(f"\n COMPACTION EVENTS ({len(data['compactions'])}):")
        for c in data["compactions"]:
            print(f"  tokensBefore={c.get('tokensBefore', '?')}, ts={c.get('timestamp', '?')[:19]}")

    if data["model_changes"]:
        print(f"\n MODEL CHANGES ({len(data['model_changes'])}):")
        for mc in data["model_changes"]:
            print(f"  {mc.get('timestamp', '?')[:19]}: {mc.get('provider', '?')}/{mc.get('modelId', '?')}")

    print(f"\n--- COLLAPSE POINT ---")
    if rot["knee"] is not None:
        knee_steps = [s for s in steps if s["fill_pct"] >= rot["knee"]]
        if knee_steps:
            first_knee = knee_steps[0]
            print(f" Knee at {rot['knee']}% fill -> step {first_knee['step_num']}, "
                  f"cumulative {first_knee['cumulative_input']:,} tokens")
    else:
        collapse = None
        for j in range(5, len(steps)):
            before = steps[max(0, j-5):j]
            after = steps[j:j+5]
            if not before or not after: continue
            before_deg = sum(1 for s in before if s["degraded"])
            after_deg = sum(1 for s in after if s["degraded"])
            before_avg_in = sum(s["input_tokens"] for s in before) / len(before)
            after_avg_in = sum(s["input_tokens"] for s in after) / len(after)
            if after_deg > before_deg * 2 and after_avg_in > before_avg_in * 2 and after_deg >= 3:
                collapse = steps[j]
                break
        if collapse:
            print(f" Behavioral collapse at step {collapse['step_num']} "
                  f"(cumulative {collapse['cumulative_input']:,} tokens, fill {collapse['fill_pct']:.1f}%)")
        else:
            print(f" No collapse point detected.")

    return {"data": data, "rot": rot, "file": fname}


def cross_session_summary():
    """Cross-session rot summary using contextrot methodology."""
    files = su.session_jsonls()
    print(f"\n{'='*70}")
    print(f"CROSS-SESSION ROT SUMMARY ({len(files)} sessions)")
    print(f"Methodology: contextrot (Wilson CI bucketing + knee detection + 5 behavioral signals)")
    print(f"{'='*70}\n")

    all_data = []
    for f in files:
        entries = su.parse_session(f)
        data = su.extract_signals(entries)
        steps = data["steps"]
        if len(steps) < 3: continue
        rot = compute_rot_curve(steps)
        signal_counts = Counter()
        for s in steps:
            for sig in s["signals"]:
                signal_counts[sig] += 1
        knee_step = None
        if rot["knee"] is not None:
            knee_steps = [s for s in steps if s["fill_pct"] >= rot["knee"]]
            if knee_steps: knee_step = knee_steps[0]
        all_data.append({
            "file": os.path.basename(f), "steps": len(steps),
            "cum_input": data["cumulative_input"],
            "degraded_pct": sum(1 for s in steps if s["degraded"]) / len(steps),
            "tool_errors": signal_counts.get("tool_error", 0),
            "edit_failures": signal_counts.get("edit_failure", 0),
            "retries": signal_counts.get("retry", 0),
            "rereads": signal_counts.get("reread", 0),
            "self_corrections": signal_counts.get("self_correction", 0),
            "compactions": len(data["compactions"]),
            "model_swaps": len(data["model_changes"]),
            "verdict": rot["verdict"], "ratio": rot["degradation_ratio"],
            "knee": rot["knee"],
            "knee_step": knee_step["step_num"] if knee_step else None,
            "knee_tokens": knee_step["cumulative_input"] if knee_step else None,
        })

    print(f"{'Session':<45} {'Steps':>5} {'Degr%':>5} {'Ratio':>6} {'Knee':>5} {'KneeTok':>10} {'Verdict':>12}")
    print("-" * 95)
    for d in all_data:
        knee = f"{d['knee']}%" if d["knee"] is not None else "-"
        knee_tok = f"{d['knee_tokens']:,}" if d["knee_tokens"] else "-"
        print(f"{d['file'][:45]:<45} {d['steps']:>5} {d['degraded_pct']:>4.0%} {d['ratio']:>5.1f}x {knee:>5} {knee_tok:>10} {d['verdict']:>12}")

    print(f"\n--- AGGREGATE ---")
    rot_s = [d for d in all_data if d["verdict"] == "rot"]
    edge_s = [d for d in all_data if d["verdict"] == "edge"]
    clean_s = [d for d in all_data if d["verdict"] == "clean"]
    insuff = [d for d in all_data if d["verdict"] == "insufficient"]
    print(f" Rot: {len(rot_s)} | Edge: {len(edge_s)} | Clean: {len(clean_s)} | Insufficient: {len(insuff)}")

    knees = [d for d in all_data if d["knee"] is not None]
    if knees:
        avg_knee = sum(d["knee"] for d in knees) / len(knees)
        avg_knee_tokens = sum(d["knee_tokens"] for d in knees) / len(knees)
        avg_knee_step = sum(d["knee_step"] for d in knees) / len(knees)
        print(f" Sessions with knee: {len(knees)}/{len(all_data)}")
        print(f" Average knee: {avg_knee:.0f}% fill, step {avg_knee_step:.0f}, {avg_knee_tokens:.0f} cumulative tokens")
        print(f"\n YOUR SESSIONS ROT AT: ~{avg_knee:.0f}% context fill / step {avg_knee_step:.0f} / {avg_knee_tokens:.0f} tokens")
        print(f" -> Handoff BEFORE this point (~{max(20, avg_knee-15):.0f}% fill)")

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
        print(f" {sig:20s}: {count:4d} ({pct:.1f}% of {total_steps} steps)")


def live_monitor(filepath):
    """Tail-follow a session file for live rot monitoring."""
    print(f"Live monitoring: {filepath}")
    print(f"Watching for rot signals... (Ctrl+C to stop)\n")
    print(f" {'Turn':>4} {'Input':>8} {'Output':>6} {'Cumulative':>10} {'Fill%':>5} {'Signals':>30}")
    print(f" {'-'*75}")

    with open(filepath, "r") as f:
        f.seek(0, 2)
        cumulative = 0
        turn = 0
        step_signals = set()

        import time
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.5)
                continue
            try:
                e = json.loads(line)
            except Exception:
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
                        fill_pct = in_tok / su.DEFAULT_WINDOW * 100
                        sig_str = ", ".join(sorted(step_signals)) if step_signals else ""
                        bar = "#" * min(30, int(fill_pct / 3))
                        print(f" {turn:>4} {in_tok:>7,} {out_tok:>5,} {cumulative:>9,} {fill_pct:>4.1f}% {sig_str:<30} {bar}")
                        step_signals = set()
                        if fill_pct > 55:
                            print(f" {'':>4} WARNING: {fill_pct:.1f}% — approaching rot zone")
                        if fill_pct > 70:
                            print(f" {'':>4} ROT CRITICAL: {fill_pct:.1f}% — trigger handoff now")

                elif role == "toolResult":
                    text = ""
                    for c in content:
                        if isinstance(c, dict) and c.get("type") == "text":
                            text += c.get("text", "")
                    if su.is_error_result(text):
                        step_signals.add("tool_error")
                    if len(text) > 5000:
                        print(f" {'':>4} BLOAT: tool result = {len(text):,} chars")

            elif e.get("type") == "compaction":
                print(f" === COMPACTION at cumulative={cumulative:,} tokens ===")
                cumulative = 0
            elif e.get("type") == "model_change":
                print(f" --- MODEL CHANGE: {e.get('provider', '?')}/{e.get('modelId', '?')} ---")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Context-rot analysis for pi sessions")
    parser.add_argument("file", nargs="?", help="Specific session file to analyze")
    parser.add_argument("--all", action="store_true", help="Analyze all sessions")
    parser.add_argument("--summary", action="store_true", help="Cross-session summary only")
    parser.add_argument("--live", metavar="FILE", help="Live-monitor a session file")
    parser.add_argument("--window", type=int, default=su.DEFAULT_WINDOW, help="Context window size")
    args = parser.parse_args()

    if args.live:
        live_monitor(args.live)
    elif args.summary:
        cross_session_summary()
    elif args.file:
        analyze_session(args.file, context_window=args.window)
    elif args.all:
        for f in su.session_jsonls():
            analyze_session(f, context_window=args.window)
    else:
        cross_session_summary()
        for f in su.session_jsonls(limit=5):
            analyze_session(f, context_window=args.window)
