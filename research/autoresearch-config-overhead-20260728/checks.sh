#!/bin/bash
# checks.sh — correctness backpressure: a config that wins tokens but breaks
# the agent's actual behavior must NOT be kept. Runs the workload bench
# (bench/measure-variant.sh, 1 run) against the same variant build.
# Exit 0 = behavior intact. Exit 1 = regression (log as checks_failed).
# Output intentionally minimal — errors only, plus workload token total.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$REPO/.auto/proxy.sh" ensure   # same measurement path as measure.sh
VAGENT="$(bash "$REPO/.auto/build-variant.sh")"

out="$(bash "$REPO/bench/measure-variant.sh" "$VAGENT" 1 2>&1)" || true
line="$(echo "$out" | grep 'METRIC checks_pass=' | tail -1 || true)"

if [ "$line" != "METRIC checks_pass=1" ]; then
  echo "CHECKS FAILED — workload regression under this config:"
  echo "$out" | grep -E '^RUN |METRIC' | tail -10
  exit 1
fi
echo "$out" | grep -E 'METRIC run_totals=' | tail -1
echo "checks_pass=1"
