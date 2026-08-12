#!/bin/bash
OUT=/home/alex/Projects/pi-harness-config/research/auto-routing-ecosystem-20260812/snippets.txt
{
  echo '=== repo settings packages ==='
  grep -n -A20 '"packages"' /home/alex/Projects/pi-harness-config/settings.json | head -20
  echo '=== repo lock ==='
  grep -n -A6 'auto-reasoning' /home/alex/Projects/pi-harness-config/packages.lock.json
  echo '=== live settings packages ==='
  grep -n -A25 '"packages"' /home/alex/.pi/agent/settings.json | head -25
  echo '=== live lock ==='
  grep -n -A6 'auto-reasoning' /home/alex/.pi/agent/packages.lock.json
  echo '=== repo agent/settings packages ==='
  grep -n -A25 '"packages"' /home/alex/Projects/pi-harness-config/agent/settings.json | head -25
  echo '=== repo agent lock ==='
  grep -n -A6 'auto-reasoning' /home/alex/Projects/pi-harness-config/agent/packages.lock.json
  echo '=== apply-package-patches ==='
  cat /home/alex/Projects/pi-harness-config/scripts/apply-package-patches.sh
  echo '=== agent apply-package-patches ==='
  cat /home/alex/Projects/pi-harness-config/agent/scripts/apply-package-patches.sh
  echo '=== install mapping ==='
  grep -n auto-reasoning /home/alex/Projects/pi-harness-config/install.sh
} > "$OUT"
echo wrote
