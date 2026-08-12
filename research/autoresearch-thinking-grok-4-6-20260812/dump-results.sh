#!/bin/bash
set -uo pipefail
CAMPAIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$CAMPAIGN/phase1-raw.txt"
{
  echo "=== checks ==="
  for L in low medium high; do
    echo -n "$L "
    THINK=$L bash "$CAMPAIGN/think-checks.sh" || true
  done
  echo "=== metrics ==="
  for L in low medium high; do
    echo "-- $L --"
    node "$CAMPAIGN/think-aggregate.js" "$L" /tmp/think-g46-captures || true
  done
  echo "=== canary files ==="
  for L in low medium high; do
    for R in 1 2; do
      echo "-- $L t1-r$R files.txt --"
      cat "/tmp/think-g46-${L}-t1-r${R}/files.txt" 2>/dev/null || echo MISSING
      echo "-- $L t3-r$R calc.js --"
      cat "/tmp/think-g46-${L}-t3-r${R}/calc.js" 2>/dev/null || echo MISSING
      echo "-- $L t3-r$R changelog.txt --"
      cat "/tmp/think-g46-${L}-t3-r${R}/changelog.txt" 2>/dev/null || echo MISSING
    done
  done
} > "$OUT" 2>&1
echo "wrote $OUT"
wc -l "$OUT"
