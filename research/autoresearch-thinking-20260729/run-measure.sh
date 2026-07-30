#!/bin/bash
# run-think-measure.sh — background-safe wrapper: measure + checks, logged.
cd "$(dirname "${BASH_SOURCE[0]}")"
rm -f measure.log
bash think-measure.sh > measure.log 2>&1
echo "MEASURE_EXIT=$?" >> measure.log
bash think-checks.sh >> measure.log 2>&1
