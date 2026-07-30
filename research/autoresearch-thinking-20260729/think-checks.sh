#!/bin/bash
# think-checks.sh — canaries for T1+T3 at level $THINK (default xhigh).
set -uo pipefail
LEVEL="${THINK:-xhigh}"
fail=0
for rep in 1 2; do
  f="/tmp/think-${LEVEL}-t1-r${rep}/files.txt"
  { [ -f "$f" ] && [ "$(wc -l < "$f")" -ge 3 ] && grep -qi test1.txt "$f"; } || { echo "FAIL t1-r${rep}"; fail=1; }
  c="/tmp/think-${LEVEL}-t3-r${rep}/calc.js"
  l="/tmp/think-${LEVEL}-t3-r${rep}/changelog.txt"
  { [ -f "$c" ] && grep -q 'a \* b' "$c" && [ -f "$l" ] && [ "$(wc -l < "$l")" -ge 2 ]; } || { echo "FAIL t3-r${rep}"; fail=1; }
done
[ "$fail" = 0 ] && echo "checks_pass=1" || echo "checks_failed=1"
exit "$fail"
