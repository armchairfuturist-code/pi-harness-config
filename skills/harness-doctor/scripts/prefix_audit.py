#!/usr/bin/env python3
"""Prefix-stability audit (survey §5.3): stable prefix = KV-cache reuse; Manus calls
hit rate "the single most important metric". Detects per-turn prefix variance from
proxy captures (system-prompt hash drift, embedded timestamps, key-order instability).

Reads /home/alex/bench-systima/captures/<lane>/*.json ({id, request, response}).
Usage: prefix_audit.py [--lane NAME] [--json]
"""
import argparse, glob, hashlib, json, os, re
from collections import defaultdict

CAP = "/home/alex/bench-systima/captures"


def extract_system(req):
    if not isinstance(req, dict):
        return ""
    src = req
    body = req.get("body")  # proxy captures: {method, url, body}
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except Exception:
            body = None
    if isinstance(body, dict):
        src = body
    if isinstance(src.get("system"), str):
        return src["system"]
    if isinstance(src.get("system"), list):
        return json.dumps(src["system"], sort_keys=True)
    msgs = src.get("messages") or []
    if msgs and isinstance(msgs[0], dict) and msgs[0].get("role") in ("system", "developer"):
        c = msgs[0].get("content")
        return c if isinstance(c, str) else json.dumps(c, sort_keys=True)
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lane")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    lanes = [args.lane] if args.lane else sorted(os.listdir(CAP)) if os.path.isdir(CAP) else []
    report = {}
    for lane in lanes:
        hashes = defaultdict(list)
        ts_hits = 0
        files = sorted(glob.glob(f"{CAP}/{lane}/*.json"))
        firsts = {}
        for fp in files:
            try:
                d = json.load(open(fp))
            except Exception:
                continue
            sys_txt = extract_system(d.get("request") or {})
            if not sys_txt:
                continue
            h = hashlib.md5(sys_txt.encode()).hexdigest()[:10]
            hashes[h].append(os.path.basename(fp))
            firsts.setdefault(h, sys_txt)
            if re.search(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}', sys_txt):
                ts_hits += 1
        variants = len(hashes)
        entry = {"requests": sum(len(v) for v in hashes.values()),
                 "distinct_prefix_hashes": variants,
                 "timestamped_prefix_requests": ts_hits}
        if variants >= 2:
            hs = list(hashes)
            a, b = firsts[hs[0]], firsts[hs[1]]
            i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), min(len(a), len(b)))
            entry["first_diff_at"] = i
            entry["diff_context"] = repr(a[max(0, i - 40):i + 60]) + " VS " + repr(b[max(0, i - 40):i + 60])
            entry["hash_groups"] = {h: len(v) for h, v in hashes.items()}
        report[lane] = entry

    if args.json:
        print(json.dumps(report, indent=2))
        return
    for lane, e in report.items():
        stable = "STABLE" if e["distinct_prefix_hashes"] == 1 and not e["timestamped_prefix_requests"] else "VARIANCE"
        print(f"{lane}: {stable} — {e['requests']} reqs, {e['distinct_prefix_hashes']} prefix hashes, "
              f"{e['timestamped_prefix_requests']} timestamped")
        if "diff_context" in e:
            print(f"  first diff @char {e['first_diff_at']}: {e['diff_context'][:200]}")


if __name__ == "__main__":
    main()
