#!/bin/bash
# One canary lane. Args: LEVEL TIER REP
set -uo pipefail
CAMPAIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$CAMPAIGN/../.." && pwd)"
TERS="$ROOT/research/autoresearch-terseness-20260729"
BENCH="$ROOT/bench"
CAP="${THINK_CAP:-/tmp/think-g46-captures}"
PORT="${PI_BENCH_PORT:-4599}"
LEVEL="${1:?level}"
TIER="${2:?tier}"
REP="${3:?rep}"
MODEL="Venice/grok-4-6"

port_open() { (echo > /dev/tcp/127.0.0.1/"$PORT") 2>/dev/null; }
wait_free() { for _ in $(seq 1 20); do port_open || return 0; sleep 0.5; done; }
wait_listen() { for _ in $(seq 1 20); do port_open && return 0; sleep 0.5; done; return 1; }

if [ -z "${VAGENT:-}" ]; then
  chmod +x "$TERS/build-variant.sh" 2>/dev/null || true
  VAGENT="$(bash "$TERS/build-variant.sh")"
  jq --arg url "http://127.0.0.1:${PORT}/v1" '.providers.Venice.baseUrl=$url' \
    "$VAGENT/models.json" > "$VAGENT/models.json.tmp" && mv "$VAGENT/models.json.tmp" "$VAGENT/models.json"
  export VAGENT
fi

P1="List all files in the current directory and write them to files.txt, one per line."
P3="calc.js has a bug: multiply(2,3) returns 5 instead of 6. Fix multiply in calc.js, then append one line describing the fix to changelog.txt."

label="think-g46-${LEVEL}-${TIER}-r${REP}"
wd="/tmp/think-g46-${LEVEL}-${TIER}-r${REP}"
rm -rf "$wd"
mkdir -p "$wd" "$CAP"
if [ "$TIER" = t1 ]; then
  touch "$wd/test1.txt" "$wd/test2.py" "$wd/test3.md"
  prompt="$P1"
else
  printf 'function add(a, b) { return a + b; }\nfunction multiply(a, b) { return a + b; }\nmodule.exports = { add, multiply };\n' > "$wd/calc.js"
  printf '# Changelog\n' > "$wd/changelog.txt"
  prompt="$P3"
fi
pkill -TERM -f 'proxy-oi.mjs' 2>/dev/null || true
wait_free
rm -rf "$CAP/$label"
LABEL="$label" PROXY_PORT="$PORT" CAPTURE_DIR="$CAP" UPSTREAM_URL=https://api.venice.ai/api/v1 \
  node "$BENCH/proxy-oi.mjs" >> /tmp/think-g46-proxy.log 2>&1 &
wait_listen || { echo "PROXY FAILED" >&2; exit 1; }
(cd "$wd" && PI_CODING_AGENT_DIR="$VAGENT" PI_AUTO_REASONING_DISABLE="${PI_AUTO_REASONING_DISABLE:-}" \
  timeout 180 pi -p "$prompt" --model "$MODEL" --thinking "$LEVEL" >/tmp/${label}.pi.log 2>&1) || true
pkill -TERM -f 'proxy-oi.mjs' 2>/dev/null || true
echo "lane $label done: $(ls "$CAP/$label" 2>/dev/null | wc -l) captures"
