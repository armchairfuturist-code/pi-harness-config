#!/usr/bin/env bash
# Live KEEP A/B gate (extension context path, no LLM). Iteration 9b.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT_DIR="${PI_DET_OUT:-$ROOT/bench/out}"
mkdir -p "$OUT_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/live-keep-$TS.json"
node "$ROOT/bench/live-keep-ab.mjs" --json "$@" | tee "$OUT"
echo "wrote $OUT"
