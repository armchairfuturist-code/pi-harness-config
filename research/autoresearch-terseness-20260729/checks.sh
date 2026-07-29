#!/bin/bash
# checks.sh — behavioral canaries on the rep workdirs. Any failure => exit 1
# (checks_failed => candidate cannot be kept).
set -uo pipefail
fail=0
for rep in 1 2; do
  f="/tmp/ters-t1-r${rep}/files.txt"
  { [ -f "$f" ] && [ "$(wc -l < "$f")" -ge 3 ] && grep -qi test1.txt "$f"; } || { echo "FAIL t1-r${rep}: files.txt"; fail=1; }
  s="/tmp/ters-t2-r${rep}/summary.md"
  { [ -f "$s" ] && [ "$(wc -c < "$s")" -ge 200 ]; } || { echo "FAIL t2-r${rep}: summary.md"; fail=1; }
  c="/tmp/ters-t3-r${rep}/calc.js"
  l="/tmp/ters-t3-r${rep}/changelog.txt"
  { [ -f "$c" ] && grep -q 'a \* b' "$c" && [ -f "$l" ] && [ "$(wc -l < "$l")" -ge 2 ]; } || { echo "FAIL t3-r${rep}: calc/changelog"; fail=1; }
done
[ "$fail" = 0 ] && echo "checks_pass=1" || echo "checks_failed=1"
exit "$fail"
