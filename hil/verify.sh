#!/usr/bin/env bash
# HIL Phase 5: VERIFY
# Runs the canary suite against the current (modified) harness and compares
# to a baseline trace. Rejects changes that break quality canaries.
#
# Usage: hil/verify.sh <baseline_trace> [label]
#
# Gate logic:
#   checks FAIL → REJECT (output: REVERT)
#   checks PASS AND tokens improved → ACCEPT
#   checks PASS AND tokens unchanged → NEUTRAL (promote if simpler)
#   checks PASS AND tokens worsened → COST-POSITIVE (promote if quality gain)
#
# Exit codes: 0 = pass, 1 = fail (revert), 2 = error

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HIL_DIR="$ROOT/hil"
TRACES_DIR="$HIL_DIR/traces"
VERIFICATIONS_DIR="$HIL_DIR/verifications"

BASELINE_TRACE="${1:?Usage: hil/verify.sh <baseline_trace> [label]}"
LABEL="${2:-verify-$(date -u +%Y%m%dT%H%M%S)}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%S")
RESULT_FILE="$VERIFICATIONS_DIR/${TIMESTAMP}-${LABEL}.json"

if [[ ! -f "$BASELINE_TRACE" ]]; then
  echo "ERROR: Baseline trace not found: $BASELINE_TRACE" >&2
  exit 2
fi

# --- Ensure proxy ---
echo "[hil-verify] Starting proxy..."
PI_BENCH_LABEL="hil-verify-$LABEL" bash "$ROOT/bench/proxy.sh" ensure
trap 'bash "$ROOT/bench/proxy.sh" stop 2>/dev/null || true' EXIT

# --- Run probe ---
echo "[hil-verify] Running probe..."
PROBE_LABEL="hil-vprobe-$LABEL"
(cd "$ROOT" && PI_BENCH_LABEL="$PROBE_LABEL" bash bench/probe.sh 2>/dev/null) || true
PROBE_RESULT_FILE="$ROOT/.scratch/bench-results/${PROBE_LABEL}.json"

if [[ -f "$PROBE_RESULT_FILE" ]]; then
  PROBE_TOTAL=$(jq -r '.usage.total // "null"' "$PROBE_RESULT_FILE" 2>/dev/null || echo "null")
  PROBE_TOOLS=$(jq -r '.toolCount // "null"' "$PROBE_RESULT_FILE" 2>/dev/null || echo "null")
else
  PROBE_TOTAL="null"; PROBE_TOOLS="null"
fi

# --- Run workload ---
echo "[hil-verify] Running workload canary..."
MEASURE_OUTPUT=$(cd "$ROOT" && bash bench/measure.sh 2>/dev/null || true)
WORKLOAD_TOTAL=$(echo "$MEASURE_OUTPUT" | grep '^METRIC totalInputTokens=' | grep -oP '=\K[0-9]+' || echo "null")
WORKLOAD_CHECKS=$(echo "$MEASURE_OUTPUT" | grep '^METRIC checks_pass=' | grep -oP '=\K[0-9]+' || echo "null")
WORKLOAD_RUNS=$(echo "$MEASURE_OUTPUT" | grep '^METRIC runs_completed=' | grep -oP '=\K[0-9]+' || echo "null")

# --- Extract baseline values ---
BASE_PROBE=$(python3 -c "import json; d=json.load(open('$BASELINE_TRACE')); print(d.get('probe',{}).get('total_tokens','null'))" 2>/dev/null || echo "null")
BASE_WORKLOAD=$(python3 -c "import json; d=json.load(open('$BASELINE_TRACE')); print(d.get('workload',{}).get('total_input_tokens_median','null'))" 2>/dev/null || echo "null")
BASE_CHECKS=$(python3 -c "import json; d=json.load(open('$BASELINE_TRACE')); print(d.get('workload',{}).get('checks_pass','null'))" 2>/dev/null || echo "null")
BASE_TOOLS=$(python3 -c "import json; d=json.load(open('$BASELINE_TRACE')); print(d.get('probe',{}).get('tool_count','null'))" 2>/dev/null || echo "null")

# --- Gate logic (improved: considers both probe and workload, with noise threshold) ---
GATE="UNKNOWN"
DELTA_PROBE="null"
DELTA_WORKLOAD="null"
NOISE_THRESHOLD=10  # tokens: delta below this is considered noise

if [[ "$BASE_PROBE" != "null" && "$PROBE_TOTAL" != "null" ]]; then
  DELTA_PROBE=$((PROBE_TOTAL - BASE_PROBE))
fi

if [[ "$BASE_WORKLOAD" != "null" && "$WORKLOAD_TOTAL" != "null" ]]; then
  DELTA_WORKLOAD=$((WORKLOAD_TOTAL - BASE_WORKLOAD))
fi

# checks_pass: 1 = pass, 0 = fail
if [[ "$WORKLOAD_CHECKS" == "1" || "$WORKLOAD_CHECKS" == "true" ]]; then
  PROBE_IMPROVED=false
  PROBE_NEUTRAL=false
  WORKLOAD_IMPROVED=false
  
  # Probe assessment (with noise threshold)
  if [[ "$DELTA_PROBE" != "null" ]]; then
    if [[ "$DELTA_PROBE" -lt $NOISE_THRESHOLD && "$DELTA_PROBE" -gt $((0 - NOISE_THRESHOLD)) ]]; then
      PROBE_NEUTRAL=true
    elif [[ "$DELTA_PROBE" -lt 0 ]]; then
      PROBE_IMPROVED=true
    fi
  fi
  
  # Workload assessment
  if [[ "$DELTA_WORKLOAD" != "null" && "$DELTA_WORKLOAD" -lt 0 ]]; then
    WORKLOAD_IMPROVED=true
  fi
  
  # Gate decision
  if $PROBE_IMPROVED || $WORKLOAD_IMPROVED; then
    GATE="ACCEPT"
  elif $PROBE_NEUTRAL; then
    GATE="NEUTRAL"
  else
    GATE="COST_POSITIVE"
  fi
else
  GATE="REJECT"
fi

# --- Write verification record ---
mkdir -p "$VERIFICATIONS_DIR"
cat > "$RESULT_FILE" <<EOF
{
  "timestamp": "$(date -u +%FT%TZ)",
  "label": "$LABEL",
  "baseline_trace": "$BASELINE_TRACE",
  "gate": "$GATE",
  "baseline": {
    "probe_total": ${BASE_PROBE:-null},
    "workload_total": ${BASE_WORKLOAD:-null},
    "checks": ${BASE_CHECKS:-null},
    "tool_count": ${BASE_TOOLS:-null}
  },
  "current": {
    "probe_total": ${PROBE_TOTAL:-null},
    "workload_total": ${WORKLOAD_TOTAL:-null},
    "checks": ${WORKLOAD_CHECKS:-null},
    "tool_count": ${PROBE_TOOLS:-null}
  },
  "delta": {
    "probe_total": ${DELTA_PROBE:-null},
    "workload_total": ${DELTA_WORKLOAD:-null}
  }
}
EOF

echo ""
echo "=========================================="
echo "HIL VERIFY GATE: $GATE"
echo "=========================================="
echo "Probe:   ${BASE_PROBE:-null} → ${PROBE_TOTAL:-null} (Δ ${DELTA_PROBE:-null})"
echo "Workload: ${BASE_WORKLOAD:-null} → ${WORKLOAD_TOTAL:-null} (Δ ${DELTA_WORKLOAD:-null})"
echo "Tools:   ${BASE_TOOLS:-null} → ${PROBE_TOOLS:-null}"
echo "Checks:  $WORKLOAD_CHECKS (baseline: $BASE_CHECKS)"
echo "=========================================="
echo "Verification: $RESULT_FILE"

if [[ "$GATE" == "REJECT" ]]; then
  echo ""
  echo "⚠️  CANARY FAILED — REVERT THE CHANGE"
  exit 1
fi

exit 0
