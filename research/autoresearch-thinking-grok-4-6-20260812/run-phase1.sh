#!/bin/bash
# Phase 1: low / medium / high with auto-reasoning off. Sequential (shared port 4599).
set -uo pipefail
CAMPAIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PI_AUTO_REASONING_DISABLE=1
LOG=/tmp/think-g46-phase1.log
: > "$LOG"
echo "phase1 start $(date -Is)" | tee -a "$LOG"
for THINK in low medium high; do
  export THINK
  echo "===== THINK=$THINK AR=off $(date -Is) =====" | tee -a "$LOG"
  bash "$CAMPAIGN/run-measure.sh" 2>&1 | tee -a "$LOG"
  echo "===== end THINK=$THINK rc=${PIPESTATUS[0]} =====" | tee -a "$LOG"
done
echo "phase1 done $(date -Is)" | tee -a "$LOG"
echo "log=$LOG"
