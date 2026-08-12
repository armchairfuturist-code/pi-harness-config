#!/bin/bash
OUT=/home/alex/Projects/pi-harness-config/research/auto-routing-ecosystem-20260812/locks.txt
{
  echo '=== repo lock ==='
  cat /home/alex/Projects/pi-harness-config/packages.lock.json
  echo '=== live lock ==='
  cat /home/alex/.pi/agent/packages.lock.json
  echo '=== agent lock ==='
  cat /home/alex/Projects/pi-harness-config/agent/packages.lock.json
} > "$OUT"
echo wrote
