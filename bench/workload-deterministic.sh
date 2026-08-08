#!/usr/bin/env bash
# Deterministic fixed-turn prune workload (Iteration 9).
# No LLM. Gates CLEAR/DEDUP/STALE path coverage + KEEP monotonicity.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

KEEP="${PI_PRUNE_KEEP_SWEEP:-2,3,4,6}"
SCENARIO="${PI_DET_SCENARIO:-all}"
JSON="${PI_DET_JSON:-0}"
OUT_DIR="${PI_DET_OUT:-$ROOT/bench/out}"
mkdir -p "$OUT_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_JSON="$OUT_DIR/det-$TS.json"

ARGS=(node "$ROOT/bench/workload-deterministic.mjs" --keep "$KEEP" --scenario "$SCENARIO")
if [[ "$JSON" == "1" || "$JSON" == "true" ]]; then
  ARGS+=(--json)
fi

set +e
"${ARGS[@]}" | tee "$OUT_JSON.tee"
rc=${PIPESTATUS[0]}
set -e

# Always also emit machine JSON alongside human tee when not already json mode
if [[ "$JSON" != "1" && "$JSON" != "true" ]]; then
  node "$ROOT/bench/workload-deterministic.mjs" --keep "$KEEP" --scenario "$SCENARIO" --json >"$OUT_JSON" || true
  echo "wrote $OUT_JSON (rc=$rc)"
else
  # tee already has json
  cp -f "$OUT_JSON.tee" "$OUT_JSON" 2>/dev/null || true
  echo "wrote $OUT_JSON (rc=$rc)"
fi

exit "$rc"
