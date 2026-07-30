#!/bin/bash
# checks.sh — canaries for the 3 ce-lite suite briefs (both reps).
set -uo pipefail
fail=0
for rep in 1 2; do
  # --- s1: access_report.md with counts, citation, no Unknown in table ---
  f="/tmp/celite-s1-r${rep}/access_report.md"
  if [ -f "$f" ] && grep -qE "Engineering.*\b2\b" "$f" && grep -qE "Marketing.*\b1\b" "$f" \
     && grep -qF "[access.log:3]" "$f" && ! grep -q "| Unknown" "$f"; then
    :
  else
    echo "FAIL s1-r${rep}"; fail=1
  fi

  # --- s2: loader json.load, app dict keys, run() exact output ---
  d="/tmp/celite-s2-r${rep}"
  out="$(cd "$d" 2>/dev/null && python3 -c "from app import run; print(run())" 2>/dev/null)"
  if [ -f "$d/config/loader.py" ] && grep -qE "json\.loads?\(" "$d/config/loader.py" \
     && grep -qE "cfg\[['\"]db_host['\"]\]" "$d/app.py" && grep -qE "cfg\[['\"]db_port['\"]\]" "$d/app.py" \
     && [ "$out" = "Connecting to production-db.internal:5432" ]; then
    :
  else
    echo "FAIL s2-r${rep} (out='$out')"; fail=1
  fi

  # --- s3: verify.js exits 0, cloning pattern, verify.js unmodified ---
  d="/tmp/celite-s3-r${rep}"
  runout="$(cd "$d" 2>/dev/null && node verify.js 2>/dev/null)"
  rc=$?
  if [ "$rc" = 0 ] && echo "$runout" | grep -q PASSED \
     && grep -qE "structuredClone|Object\.assign|\.\.\.|JSON\.parse" "$d/state_store.js" \
     && grep -q "Counter mutated!" "$d/verify.js"; then
    :
  else
    echo "FAIL s3-r${rep} (rc=$rc)"; fail=1
  fi

  # --- s4: wayfinder map exists, decision-shaped, no deliverables built ---
  d="/tmp/celite-s4-r${rep}"
  qcount=$(grep -cE "\?$" "$d/wayfinder-map.md" 2>/dev/null || echo 0)
  newcode=$(find "$d" -name "*.py" -o -name "*.sql" 2>/dev/null | wc -l)
  newjs=$(find "$d" -name "*.js" ! -name store.js 2>/dev/null | wc -l)
  if [ -f "$d/wayfinder-map.md" ] && [ "$qcount" -ge 3 ] \
     && grep -qi "destination" "$d/wayfinder-map.md" \
     && [ "$newcode" = 0 ] && [ "$newjs" = 0 ]; then
    :
  else
    echo "FAIL s4-r${rep} (q=$qcount newcode=$newcode newjs=$newjs)"; fail=1
  fi

  # --- s5: counter module + handoff with model note ---
  d="/tmp/celite-s5-r${rep}"
  if [ -f "$d/counter.js" ] && grep -qE "inc|get" "$d/counter.js" \
     && [ -f "$d/handoff.md" ] && [ "$(wc -l < "$d/handoff.md")" -ge 5 ] \
     && grep -qiE "model note|next model|taking over|for the model" "$d/handoff.md"; then
    :
  else
    echo "FAIL s5-r${rep}"; fail=1
  fi
done
[ "$fail" = 0 ] && echo "checks_pass=1" || echo "checks_failed=1"
exit "$fail"
