#!/bin/bash
# run-measure.sh — background-safe wrapper: measure + checks, logged.
cd "$(dirname "${BASH_SOURCE[0]}")"
rm -f measure.log
bash measure.sh > measure.log 2>&1
echo "MEASURE_EXIT=$?" >> measure.log
bash checks.sh >> measure.log 2>&1
