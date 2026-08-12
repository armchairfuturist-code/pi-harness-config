#!/bin/bash
OUT=/home/alex/Projects/pi-harness-config/research/auto-routing-ecosystem-20260812/exact.txt
{
  echo '=== repo lock wc ==='
  wc -l /home/alex/Projects/pi-harness-config/packages.lock.json
  echo '=== repo lock ==='
  cat /home/alex/Projects/pi-harness-config/packages.lock.json
  echo
  echo '=== apply repo ==='
  cat -n /home/alex/Projects/pi-harness-config/scripts/apply-package-patches.sh
  echo '=== apply live ==='
  cat -n /home/alex/.pi/agent/scripts/apply-package-patches.sh
} > "$OUT"
echo wrote
