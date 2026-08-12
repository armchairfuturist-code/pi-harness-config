#!/bin/bash
# Finish medium t3-r2, score medium, then run high. Quiet logs to avoid wrapper cap.
set -uo pipefail
CAMPAIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PI_AUTO_REASONING_DISABLE=1
LOG=/tmp/think-g46-phase1.log
{
  echo "resume start $(date -Is)"
  echo "===== THINK=medium remaining t3-r2 ====="
  bash "$CAMPAIGN/run-lane.sh" medium t3 2
  echo "===== THINK=medium score ====="
  THINK=medium node "$CAMPAIGN/think-aggregate.js" medium /tmp/think-g46-captures
  THINK=medium bash "$CAMPAIGN/think-checks.sh"
  echo "===== THINK=high ====="
  THINK=high bash "$CAMPAIGN/run-measure.sh"
  echo "resume done $(date -Is)"
} >> "$LOG" 2>&1
echo "log=$LOG"
tail -30 "$LOG"
