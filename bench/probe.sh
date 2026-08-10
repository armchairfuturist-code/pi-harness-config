#!/usr/bin/env bash
# Minimal live probe for pi harness token metrics.
# Usage: ./bench/probe.sh [label]
# Env: PI_BIN (default: pi), PROBE_PROMPT (default below)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="${1:-probe}"
PI_BIN="${PI_BIN:-pi}"
PROMPT="${PROBE_PROMPT:-Reply with exactly: pong}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${ROOT}/bench/out"
mkdir -p "$OUT_DIR"
OUT_JSON="${OUT_DIR}/${STAMP}-${LABEL}.json"
OUT_MD="${OUT_DIR}/${STAMP}-${LABEL}.md"

# Prefer JSONL print mode; fall back to plain.
set +e
if "$PI_BIN" --help 2>&1 | grep -q -- '--mode'; then
  RAW="$("$PI_BIN" --mode json -p "$PROMPT" 2>&1)"
  RC=$?
else
  RAW="$("$PI_BIN" -p "$PROMPT" 2>&1)"
  RC=$?
fi
set -e

printf '%s\n' "$RAW" >"${OUT_JSON}.raw"

# Best-effort token extraction from provider-ish JSON blobs in the stream.
# Looks for input_tokens / output_tokens / cache_* keys anywhere in the raw dump.
python3 - "$OUT_JSON" "$OUT_MD" "$LABEL" "$STAMP" "$RC" "${OUT_JSON}.raw" <<'PY'
import json, re, sys, pathlib
out_json, out_md, label, stamp, rc, raw_path = sys.argv[1:]
raw = pathlib.Path(raw_path).read_text(errors="replace")
nums = {
    "input_tokens": 0,
    "output_tokens": 0,
    "cache_read_tokens": 0,
    "cache_write_tokens": 0,
}
patterns = {
    "input_tokens": r'"input_tokens"\s*:\s*(\d+)',
    "output_tokens": r'"output_tokens"\s*:\s*(\d+)',
    "cache_read_tokens": r'"cache_read_input_tokens"\s*:\s*(\d+)|"cache_read_tokens"\s*:\s*(\d+)|"cacheRead"\s*:\s*(\d+)',
    "cache_write_tokens": r'"cache_creation_input_tokens"\s*:\s*(\d+)|"cache_write_tokens"\s*:\s*(\d+)|"cacheWrite"\s*:\s*(\d+)',
}
for k, pat in patterns.items():
    for m in re.finditer(pat, raw):
        val = next(g for g in m.groups() if g is not None)
        nums[k] += int(val)

inp = nums["input_tokens"]
crd = nums["cache_read_tokens"]
cwr = nums["cache_write_tokens"]
out_t = nums["output_tokens"]
# Hit rate among tokens that could be served from cache (read + uncached input).
denom = crd + inp
cache_hit_pct = round(100.0 * crd / denom, 2) if denom > 0 else None
# Share of total billed prompt-side tokens that were cache reads.
prompt_side = crd + cwr + inp
cache_read_share_pct = round(100.0 * crd / prompt_side, 2) if prompt_side > 0 else None

result = {
    "stamp": stamp,
    "label": label,
    "exit_code": int(rc),
    "metrics": nums,
    "cache_hit_pct": cache_hit_pct,
    "cache_read_share_pct": cache_read_share_pct,
    "cache_denom_input_plus_read": denom,
    "raw_bytes": len(raw),
    "note": "sums of all matching token fields found in raw output; best-effort",
}
pathlib.Path(out_json).write_text(json.dumps(result, indent=2))
hit = "n/a" if cache_hit_pct is None else f"{cache_hit_pct}%"
share = "n/a" if cache_read_share_pct is None else f"{cache_read_share_pct}%"
md = f"""# Probe {stamp} ({label})

- exit: {rc}
- input_tokens (sum): {inp}
- output_tokens (sum): {out_t}
- cache_read_tokens (sum): {crd}
- cache_write_tokens (sum): {cwr}
- **cache_hit_pct** (read/(read+input)): {hit}
- **cache_read_share_pct** (read/(read+write+input)): {share}
- raw_bytes: {len(raw)}

Ledger one-liner:
`cache_hit≈{hit} · cacheRead={crd} · cacheWrite={cwr} · input={inp} · output={out_t}`
"""
pathlib.Path(out_md).write_text(md)
print(md)
PY
