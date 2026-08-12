#!/bin/bash
# Run one THINK level, then canary-check. Phase 1: export PI_AUTO_REASONING_DISABLE=1
set -uo pipefail
CAMPAIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export THINK="${THINK:-high}"
bash "$CAMPAIGN/think-measure.sh"
bash "$CAMPAIGN/think-checks.sh"
