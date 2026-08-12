#!/bin/bash
# think-measure.sh — T1+T3 × 2 reps on Venice/grok-4-6 at $THINK (default high).
# Prints METRIC lines. Does not edit live model-thinking.json.
set -uo pipefail
CAMPAIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$CAMPAIGN/../.." && pwd)"
TERS="$ROOT/research/autoresearch-terseness-20260729"
BENCH="$ROOT/bench"
CAP="${THINK_CAP:-/tmp/think-g46-captures}"
PORT="${PI_BENCH_PORT:-4599}"
LEVEL="${THINK:-high}"
MODEL="Venice/grok-4-6"

port_open() { (echo > /dev/tcp/127.0.0.1/"$PORT") 2>/dev/null; }
wait_free() { for _ in $(seq 1 20); do port_open || return 0; sleep 0.5; done; }
wait_listen() { for _ in $(seq 1 20); do port_open && return 0; sleep 0.5; done; return 1; }

chmod +x "$TERS/build-variant.sh" 2>/dev/null || true
VAGENT="$(bash "$TERS/build-variant.sh")"
jq --arg url "http://127.0.0.1:${PORT}/v1" '.providers.Venice.baseUrl=$url' \
  "$VAGENT/models.json" > "$VAGENT/models.json.tmp" && mv "$VAGENT/models.json.tmp" "$VAGENT/models.json"

P1="List all files in the current directory and write them to files.txt, one per line."
P3="calc.js has a bug: multiply(2,3) returns 5 instead of 6. Fix multiply in calc.js, then append one line describing the fix to changelog.txt."

mkdir -p "$CAP"
for tier in t1 t3; do
  for rep in 1 2; do
    label="think-g46-${LEVEL}-${tier}-r${rep}"
    wd="/tmp/think-g46-${LEVEL}-${tier}-r${rep}"
    rm -rf "$wd"
    mkdir -p "$wd"
    if [ "$tier" = t1 ]; then
      touch "$wd/test1.txt" "$wd/test2.py" "$wd/test3.md"
    else
      printf 'function add(a, b) { return a + b; }\nfunction multiply(a, b) { return a + b; }\nmodule.exports = { add, multiply };\n' > "$wd/calc.js"
      printf '# Changelog\n' > "$wd/changelog.txt"
    fi
    pkill -TERM -f 'proxy-oi.mjs' 2>/dev/null || true
    wait_free
    rm -rf "$CAP/$label"
    LABEL="$label" PROXY_PORT="$PORT" CAPTURE_DIR="$CAP" UPSTREAM_URL=https://api.venice.ai/api/v1 \
      node "$BENCH/proxy-oi.mjs" >> /tmp/think-g46-proxy.log 2>&1 &
    wait_listen || { echo "PROXY FAILED" >&2; exit 1; }
    if [ "$tier" = t1 ]; then prompt="$P1"; else prompt="$P3"; fi
    (cd "$wd" && PI_CODING_AGENT_DIR="$VAGENT" PI_AUTO_REASONING_DISABLE="${PI_AUTO_REASONING_DISABLE:-}" \
      timeout 180 pi -p "$prompt" --model "$MODEL" --thinking "$LEVEL" >/tmp/think-g46-${LEVEL}-${tier}-r${rep}.pi.log 2>&1) || true
    pkill -TERM -f 'proxy-oi.mjs' 2>/dev/null || true
    echo "lane $label done: $(ls "$CAP/$label" 2>/dev/null | wc -l) captures" >&2
  done
done
node "$CAMPAIGN/think-aggregate.js" "$LEVEL" "$CAP"
