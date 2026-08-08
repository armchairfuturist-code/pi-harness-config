#!/usr/bin/env bash
# HIL Phase 1: OBSERVE
# Runs the full measurement battery and captures a structured trace.
#
# Usage: hil/observe.sh [label] [suite?]
#   label  - trace label (default: "iter-unknown")
#   suite  - pass "suite" to also run the CE-lite canary suite (slow)
#
# Output: hil/traces/<timestamp>-<label>.json
#
# Captures:
#   1. Fixed overhead probe (probe_total tokens, tool count, schema chars)
#   2. Workload canary (totalInputTokens, checks_pass, requests)
#   3. CE-lite suite (optional, slow — 5 briefs × 2 reps)
#   4. Session manifest (packages, extensions, settings)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HIL_DIR="$ROOT/hil"
TRACES_DIR="$HIL_DIR/traces"

LABEL="${1:-iter-unknown}"
RUN_SUITE="${2:-no}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%S")
TRACE_FILE="$TRACES_DIR/${TIMESTAMP}-${LABEL}.json"

# --- Ensure proxy ---
echo "[hil-observe] Starting proxy..."
PI_BENCH_LABEL="hil-observe-$LABEL" bash "$ROOT/bench/proxy.sh" ensure
trap 'bash "$ROOT/bench/proxy.sh" stop 2>/dev/null || true' EXIT

# --- Phase 1: Fixed overhead probe ---
echo "[hil-observe] Phase 1: Fixed overhead probe..."
PROBE_LABEL="hil-probe-$LABEL"
PROBE_OUTPUT=$(cd "$ROOT" && PI_BENCH_LABEL="$PROBE_LABEL" bash bench/probe.sh 2>/dev/null || true)
PROBE_RESULT_FILE="$ROOT/.scratch/bench-results/${PROBE_LABEL}.json"
PROBE_MANIFEST_FILE="$ROOT/.scratch/bench-results/${PROBE_LABEL}.manifest.json"

# Extract detailed probe data from JSON result
if [[ -f "$PROBE_RESULT_FILE" ]]; then
  PROBE_TOTAL=$(jq -r '.usage.total // "null"' "$PROBE_RESULT_FILE" 2>/dev/null || echo "null")
  PROBE_INPUT=$(jq -r '.usage.input // "null"' "$PROBE_RESULT_FILE" 2>/dev/null || echo "null")
  PROBE_OUTPUT_TOK=$(jq -r '.usage.output // "null"' "$PROBE_RESULT_FILE" 2>/dev/null || echo "null")
  PROBE_TOOLS=$(jq -r '.toolCount // "null"' "$PROBE_RESULT_FILE" 2>/dev/null || echo "null")
  PROBE_SCHEMA_CHARS=$(jq -r '.toolSchemaChars // "null"' "$PROBE_RESULT_FILE" 2>/dev/null || echo "null")
  PROBE_SYSTEM_CHARS=$(jq -r '.systemChars // "null"' "$PROBE_RESULT_FILE" 2>/dev/null || echo "null")
  PROBE_MODEL=$(jq -r '.model // "null"' "$PROBE_RESULT_FILE" 2>/dev/null || echo "null")
  PROBE_TOOL_NAMES=$(jq -rc '.toolNames // []' "$PROBE_RESULT_FILE" 2>/dev/null || echo "[]")
else
  PROBE_TOTAL="null"; PROBE_INPUT="null"; PROBE_OUTPUT_TOK="null"; PROBE_TOOLS="null"
  PROBE_SCHEMA_CHARS="null"; PROBE_SYSTEM_CHARS="null"; PROBE_MODEL="null"; PROBE_TOOL_NAMES="[]"
fi

# --- Phase 2: Workload canary (measure.sh) ---
echo "[hil-observe] Phase 2: Workload canary (3 runs, median)..."
MEASURE_OUTPUT=$(cd "$ROOT" && bash bench/measure.sh 2>/dev/null || true)
WORKLOAD_TOTAL=$(echo "$MEASURE_OUTPUT" | grep '^METRIC totalInputTokens=' | grep -oP '=\K[0-9]+' || echo "null")
WORKLOAD_CHECKS=$(echo "$MEASURE_OUTPUT" | grep '^METRIC checks_pass=' | grep -oP '=\K[0-9]+' || echo "null")
WORKLOAD_RUNS=$(echo "$MEASURE_OUTPUT" | grep '^METRIC runs_completed=' | grep -oP '=\K[0-9]+' || echo "null")
WORKLOAD_RUN_TOTALS=$(echo "$MEASURE_OUTPUT" | grep '^METRIC run_totals=' | grep -oP '=\K[0-9,]+' || echo "null")

# --- Phase 2b: Deterministic prune workload (no LLM) ---
echo "[hil-observe] Phase 2b: Deterministic prune workload..."
DET_JSON="null"
DET_RAW_FILE="$HIL_DIR/.det-raw.json"
if [[ -f "$ROOT/bench/workload-deterministic.mjs" ]]; then
  if node "$ROOT/bench/workload-deterministic.mjs" --json >"$DET_RAW_FILE" 2>/dev/null; then
    DET_JSON=$(jq -c '{ok, deterministic, gate, scenarios: [.scenarios[] | {name, ok, savedChars, savedTokensEst, kinds}], keep_sweep: .keep_sweep.rows}' "$DET_RAW_FILE" 2>/dev/null || echo "null")
  else
    DET_JSON=$(jq -cn '{ok:false,error:"det_workload_failed"}' 2>/dev/null || echo '{"ok":false}')
  fi
fi
rm -f "$DET_RAW_FILE" 2>/dev/null || true

# --- Phase 2c: Live KEEP A/B (extension context handler, no LLM) ---
echo "[hil-observe] Phase 2c: Live KEEP A/B..."
LIVE_JSON="null"
LIVE_RAW="$HIL_DIR/.live-keep-raw.json"
if [[ -f "$ROOT/bench/live-keep-ab.mjs" ]]; then
  if node "$ROOT/bench/live-keep-ab.mjs" --json >"$LIVE_RAW" 2>/dev/null; then
    LIVE_JSON=$(jq -c '{ok, recommendation, reason, gate, rows: [.rows[] | {keep, savedChars, pointerKinds, sink}]}' "$LIVE_RAW" 2>/dev/null || echo "null")
  else
    LIVE_JSON=$(jq -cn '{ok:false,error:"live_keep_failed"}' 2>/dev/null || echo '{"ok":false}')
  fi
fi
rm -f "$LIVE_RAW" 2>/dev/null || true

# --- Phase 3: CE-lite suite (optional) ---
SUITE_JSON="null"
if [[ "$RUN_SUITE" == "suite" ]]; then
  echo "[hil-observe] Phase 3: CE-lite canary suite (slow)..."
  SUITE_DIR="$ROOT/research/autoresearch-celite-suite-20260730"
  if [[ -d "$SUITE_DIR" ]]; then
    (cd "$SUITE_DIR" && bash measure.sh 2>&1) > "$HIL_DIR/.suite-raw.log" 2>&1 || true
    SUITE_RAW=$(cat "$HIL_DIR/.suite-raw.log" 2>/dev/null || echo "")
    SUITE_TOTAL=$(echo "$SUITE_RAW" | grep -oP 'suite_total=\K[0-9]+' || echo "null")
    OUT_SUM=$(echo "$SUITE_RAW" | grep -oP 'out_sum=\K[0-9]+' || echo "null")
    REQ_SUM=$(echo "$SUITE_RAW" | grep -oP 'req_sum=\K[0-9]+' || echo "null")
    SUITE_JSON=$(cat <<INNEREOF
{"suite_total": ${SUITE_TOTAL:-null}, "out_sum": ${OUT_SUM:-null}, "req_sum": ${REQ_SUM:-null}}
INNEREOF
)
  fi
  rm -f "$HIL_DIR/.suite-raw.log" 2>/dev/null || true
fi

# --- Phase 4: Manifest (packages, settings) ---
echo "[hil-observe] Phase 4: Manifest..."
MANIFEST_JSON="null"
if [[ -f "$PROBE_MANIFEST_FILE" ]]; then
  MANIFEST_JSON=$(jq -c '.' "$PROBE_MANIFEST_FILE" 2>/dev/null || echo "null")
fi

# --- Assemble trace ---
echo "[hil-observe] Assembling trace..."
cat > "$TRACE_FILE" <<EOF
{
  "timestamp": "$(date -u +%FT%TZ)",
  "label": "$LABEL",
  "phase": "observe",
  "probe": {
    "total_tokens": ${PROBE_TOTAL:-null},
    "input_tokens": ${PROBE_INPUT:-null},
    "output_tokens": ${PROBE_OUTPUT_TOK:-null},
    "tool_count": ${PROBE_TOOLS:-null},
    "tool_schema_chars": ${PROBE_SCHEMA_CHARS:-null},
    "system_chars": ${PROBE_SYSTEM_CHARS:-null},
    "model": "${PROBE_MODEL:-null}",
    "tool_names": ${PROBE_TOOL_NAMES}
  },
  "workload": {
    "total_input_tokens_median": ${WORKLOAD_TOTAL:-null},
    "checks_pass": ${WORKLOAD_CHECKS:-null},
    "runs_completed": ${WORKLOAD_RUNS:-null},
    "run_totals": "${WORKLOAD_RUN_TOTALS}"
  },
  "det_pruner": ${DET_JSON},
 "live_keep": ${LIVE_JSON},
 "canary_suite": ${SUITE_JSON},
  "manifest": ${MANIFEST_JSON}
}
EOF

echo ""
echo "=========================================="
echo "HIL OBSERVE COMPLETE"
echo "=========================================="
echo "Trace: $TRACE_FILE"
echo "Probe total:     ${PROBE_TOTAL:-null} tokens (input=${PROBE_INPUT:-null}, output=${PROBE_OUTPUT_TOK:-null})"
echo "Tool count:      ${PROBE_TOOLS:-null} (schema=${PROBE_SCHEMA_CHARS:-null} chars, system=${PROBE_SYSTEM_CHARS:-null} chars)"
echo "Workload median: ${WORKLOAD_TOTAL:-null} tokens (checks=${WORKLOAD_CHECKS:-null}, runs=${WORKLOAD_RUNS:-null})"
DET_OK=$(echo "$DET_JSON" | jq -r '.ok // "null"' 2>/dev/null || echo "null")
echo "Det pruner gate: ${DET_OK}"
LIVE_OK=$(echo "$LIVE_JSON" | jq -r '.ok // "null"' 2>/dev/null || echo "null")
LIVE_REC=$(echo "$LIVE_JSON" | jq -r '.recommendation // "null"' 2>/dev/null || echo "null")
echo "Live KEEP gate: ${LIVE_OK} (rec=${LIVE_REC})"
echo "Model:           ${PROBE_MODEL:-null}"
echo "=========================================="
