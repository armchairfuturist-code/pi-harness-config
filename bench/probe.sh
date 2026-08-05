#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${PROBE_MODEL:-Lilac/zai-org/glm-5.2}"
PORT="${PI_BENCH_PORT:-4599}"
LABEL="${PI_BENCH_LABEL:-probe-$(date +%s)-$$}"
CAPTURE_ROOT="${PI_BENCH_CAPTURE_DIR:-$ROOT/.scratch/captures}"
export PI_BENCH_PORT="$PORT" PI_BENCH_LABEL="$LABEL" PI_BENCH_CAPTURE_DIR="$CAPTURE_ROOT"
bash "$ROOT/bench/proxy.sh" ensure
VAGENT=$(bash "$ROOT/bench/build-variant.sh")
VHOME=$(cd "$VAGENT/../.." && pwd)
WD=$(mktemp -d "${TMPDIR:-/tmp}/pi-probe-ws.XXXXXX")
SESS="$VAGENT/sessions"
marker=$(mktemp)
set +e
output=$(cd "$WD" && HOME="$VHOME" PI_CODING_AGENT_DIR="$VAGENT" PI_CODING_AGENT_SESSION_DIR="$SESS" timeout 120 pi -p "Reply with exactly: OK" --model "$MODEL" 2>&1)
rc=$?
set -e
[[ "$rc" -eq 0 && "$output" == *OK* ]] || { echo "probe failed rc=$rc output=$output" >&2; exit 1; }
mapfile -t sessions < <(find "$SESS" -name '*.jsonl' -type f -newer "$marker")
rm -f "$marker"
[[ "${#sessions[@]}" -eq 1 ]] || { echo "expected one session, found ${#sessions[@]}" >&2; exit 1; }
metric=$(jq -s '[.[]|select(.message.usage)|(.message.usage.input+(.message.usage.cacheRead//0)+(.message.usage.cacheWrite//0))] | {total:add,requests:length}' "${sessions[0]}")
[[ "$(jq -r .requests <<<"$metric")" -eq 1 ]] || { echo "expected one request: $metric" >&2; exit 1; }
mapfile -t captures < <(find "$CAPTURE_ROOT/$LABEL" -name '*.json' -type f 2>/dev/null)
[[ "${#captures[@]}" -eq 1 ]] || { echo "expected one capture, found ${#captures[@]}" >&2; exit 1; }
mkdir -p "$ROOT/.scratch/bench-results"
result="$ROOT/.scratch/bench-results/$LABEL.json"
validation=$(node "$ROOT/bench/validate-capture.mjs" "${captures[0]}" "$result")
cp "$VHOME/.pi/variant-manifest.json" "$ROOT/.scratch/bench-results/$LABEL.manifest.json"
echo "PROBE total=$(jq -r .total <<<"$metric") requests=1 tools=$(jq -r .toolCount <<<"$validation") result=$result"
rm -rf "$WD" "$VHOME"
