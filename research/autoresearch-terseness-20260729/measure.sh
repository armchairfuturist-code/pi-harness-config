#!/bin/bash
# measure.sh — behavioral terseness suite: pi variant runs T1–T3 × 2 reps
# through the capture proxy; emits METRIC lines. ~2-3 min. Live never touched.
set -euo pipefail
CAMPAIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCH=/home/alex/bench-systima
PORT=4599

[ -s "$CAMPAIGN/candidates/APPEND_SYSTEM.md" ] || { echo "candidate APPEND_SYSTEM.md missing/empty"; exit 1; }

VAGENT="$(bash "$CAMPAIGN/build-variant.sh")"

declare -A PROMPTS=(
  [t1]="List all files in the current directory and write them to files.txt, one per line."
  [t2]="Read all .txt and .md files in this directory, then write summary.md combining their key points."
  [t3]="calc.js has a bug: multiply(2,3) returns 5 instead of 6. Fix multiply in calc.js, then append one line describing the fix to changelog.txt."
)

seed() {
  local tier="$1" wd="$2"
  rm -rf "$wd"; mkdir -p "$wd"
  case "$tier" in
    t1) touch "$wd/test1.txt" "$wd/test2.py" "$wd/test3.md" ;;
    t2)
      printf '# Project Alpha\n\nAlpha is a CLI for tracking habits.\nIt stores data in JSON files.\nMain features: add, list, streaks.\nStreaks reset at midnight local time.\nThe config lives in ~/.alpha.json.\n' > "$wd/alpha.md"
      printf 'Release notes v2.1\n- Fixed streak off-by-one\n- Added weekly rollup\n- Dropped XML export\n- Performance: list is 3x faster\n' > "$wd/notes.txt"
      printf '# Roadmap\n\nQ3: mobile sync design.\nQ4: plugin API v1.\nIdeas: social sharing, csv import.\nRisks: sync conflicts, storage growth.\n' > "$wd/roadmap.md" ;;
    t3)
      printf 'function add(a, b) { return a + b; }\nfunction multiply(a, b) { return a + b; }\nmodule.exports = { add, multiply };\n' > "$wd/calc.js"
      printf '# Changelog\n' > "$wd/changelog.txt" ;;
  esac
}

port_open() { (echo > /dev/tcp/127.0.0.1/$PORT) 2>/dev/null; }
wait_free() { for i in $(seq 1 20); do port_open || return 0; sleep 0.5; done; }
wait_listen() { for i in $(seq 1 20); do port_open && return 0; sleep 0.5; done; return 1; }

for tier in t1 t2 t3; do
  for rep in 1 2; do
    label="terseness-${tier}-r${rep}"
    wd="/tmp/ters-${tier}-r${rep}"
    pkill -TERM -f 'proxy-oi.mjs' 2>/dev/null || true
    wait_free
    rm -rf "$BENCH/captures/$label"
    LABEL="$label" PROXY_PORT=$PORT CAPTURE_DIR="$BENCH/captures" UPSTREAM_URL=https://api.getlilac.com/v1 \
      node "$BENCH/rig/proxy-oi.mjs" >> "$BENCH/proxy.log" 2>&1 &
    wait_listen || { echo "PROXY FAILED for $label" >&2; exit 1; }
    seed "$tier" "$wd"
    (cd "$wd" && PI_CODING_AGENT_DIR="$VAGENT" timeout 150 pi -p "${PROMPTS[$tier]}" --model "Lilac/zai-org/glm-5.2" >/dev/null 2>&1) || true
    sleep 1
    pkill -TERM -f 'proxy-oi.mjs' 2>/dev/null || true
    echo "lane $label done: $(ls "$BENCH/captures/$label" 2>/dev/null | wc -l) captures" >&2
  done
done

node "$CAMPAIGN/aggregate.js"
