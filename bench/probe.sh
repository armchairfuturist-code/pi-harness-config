#!/usr/bin/env bash
# Minimal live probe for pi harness token metrics.
# Usage: ./bench/probe.sh [label]
# Env: PI_BIN (default: pi), PROBE_PROMPT (default below), PI_BENCH_LABEL (from observe.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="${PI_BENCH_LABEL:-${1:-probe}}"
PI_BIN="${PI_BIN:-pi}"
PROMPT="${PROBE_PROMPT:-Reply with exactly: pong}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${ROOT}/bench/out"
BENCH_DIR="${ROOT}/.scratch/bench-results"
mkdir -p "$OUT_DIR" "$BENCH_DIR"
OUT_JSON="${OUT_DIR}/${STAMP}-${LABEL}.json"
OUT_MD="${OUT_DIR}/${STAMP}-${LABEL}.md"
BENCH_JSON="${BENCH_DIR}/${LABEL}.json"

set +e
# Use json NDJSON mode so usage (message_end) is emitted even when not on a TTY.
RAW="$("$PI_BIN" --mode json -p "$PROMPT" 2>&1)"
RC=$?
set -e

printf '%s\n' "$RAW" >"${OUT_JSON}.raw"

python3 - "$OUT_JSON" "$OUT_MD" "$BENCH_JSON" "$LABEL" "$STAMP" "$RC" "${OUT_JSON}.raw" <<'PY'
import json, re, sys, pathlib
out_json, out_md, bench_json, label, stamp, rc, raw_path = sys.argv[1:]
raw = pathlib.Path(raw_path).read_text(errors="replace")

usage = None
model = None
system_chars = 0

for line in raw.splitlines():
    line = line.strip()
    if not line:
        continue
    try:
        ev = json.loads(line)
    except Exception:
        continue
    et = ev.get("type", "")
    if et == "message_end":
        msg = ev.get("message", {})
        u = msg.get("usage", {})
        if u and u.get("input", 0) > 0:
            usage = u
            model = msg.get("model", model)
    if et == "message_start":
        msg = ev.get("message", {})
        if msg.get("role") == "system":
            content = msg.get("content", "")
            if isinstance(content, str):
                system_chars += len(content)

if usage is None:
    # Regex fallback for providers that emit flat token fields (non-NDJSON).
    usage = {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0}
    for key, alt in [("input", "input_tokens"), ("output", "output_tokens"),
                     ("cacheRead", "cache_read_tokens"), ("cacheWrite", "cache_write_tokens"),
                     ("reasoning", None), ("totalTokens", None)]:
        pats = [r'"%s"\s*:\s*(\d+)' % key]
        if alt:
            pats.append(r'"%s"\s*:\s*(\d+)' % alt)
        for pat in pats:
            m = re.search(pat, raw)
            if m:
                usage[key] = int(m.group(1))
                break

inp = usage.get("input", 0)
out_t = usage.get("output", 0)
crd = usage.get("cacheRead", 0)
cwr = usage.get("cacheWrite", 0)
reasoning = usage.get("reasoning", 0)
total = usage.get("totalTokens", inp + out_t + crd + cwr + reasoning)

denom = crd + inp
cache_hit_pct = round(100.0 * crd / denom, 2) if denom > 0 else None
prompt_side = crd + cwr + inp
cache_read_share_pct = round(100.0 * crd / prompt_side, 2) if prompt_side > 0 else None

result = {
    "stamp": stamp, "label": label, "exit_code": int(rc),
    "metrics": {"input": inp, "output": out_t, "cacheRead": crd, "cacheWrite": cwr, "reasoning": reasoning, "total": total},
    "cache_hit_pct": cache_hit_pct, "cache_read_share_pct": cache_read_share_pct,
    "cache_denom_input_plus_read": denom, "raw_bytes": len(raw), "model": model,
    "note": "parsed from pi NDJSON message_end usage; provider-agnostic regex fallback",
}
pathlib.Path(out_json).write_text(json.dumps(result, indent=2))

observe_result = {
    "usage": {"total": total, "input": inp, "output": out_t,
              "cacheRead": crd, "cacheWrite": cwr, "reasoning": reasoning},
    "model": model,
    "toolCount": 0,
    "toolSchemaChars": 0,
    "toolNames": [],
    "systemChars": system_chars if system_chars > 0 else None,
}
pathlib.Path(bench_json).write_text(json.dumps(observe_result, indent=2))

hit = "n/a" if cache_hit_pct is None else f"{cache_hit_pct}%"
md = f"""# Probe {stamp} ({label})

- exit: {rc}
- model: {model}
- input: {inp}
- output: {out_t}
- cacheRead: {crd}
- cacheWrite: {cwr}
- reasoning: {reasoning}
- totalTokens: {total}
- **cache_hit_pct** (read/(read+input)): {hit}
- raw_bytes: {len(raw)}
"""
pathlib.Path(out_md).write_text(md)
print(f"probe_total={total}")
PY
