#!/bin/bash
OUT=/home/alex/Projects/pi-harness-config/research/auto-routing-ecosystem-20260812/after.txt
{
  echo '=== repo settings AR? ==='
  grep -n auto-reasoning /home/alex/Projects/pi-harness-config/settings.json || echo NONE
  grep -n -A20 '"packages"' /home/alex/Projects/pi-harness-config/settings.json | head -20
  echo '=== live settings AR? ==='
  grep -n auto-reasoning /home/alex/.pi/agent/settings.json || echo NONE
  grep -n -A25 '"packages"' /home/alex/.pi/agent/settings.json | head -25
  echo '=== agent settings AR? ==='
  grep -n auto-reasoning /home/alex/Projects/pi-harness-config/agent/settings.json || echo NONE
  grep -n -A25 '"packages"' /home/alex/Projects/pi-harness-config/agent/settings.json | head -25
  echo '=== locks AR? ==='
  grep -n auto-reasoning /home/alex/Projects/pi-harness-config/packages.lock.json || echo repo-lock-NONE
  grep -n auto-reasoning /home/alex/.pi/agent/packages.lock.json || echo live-lock-NONE
  grep -n auto-reasoning /home/alex/Projects/pi-harness-config/agent/packages.lock.json || echo agent-lock-NONE
  echo '=== apply patches AR? ==='
  grep -n auto-reasoning /home/alex/Projects/pi-harness-config/scripts/apply-package-patches.sh || echo repo-apply-NONE
  grep -n auto-reasoning /home/alex/Projects/pi-harness-config/agent/scripts/apply-package-patches.sh || echo agent-apply-NONE
  grep -n auto-reasoning /home/alex/.pi/agent/scripts/apply-package-patches.sh || echo live-apply-NONE
  echo '=== install AR? ==='
  grep -n auto-reasoning /home/alex/Projects/pi-harness-config/install.sh || echo install-NONE
} > "$OUT"
echo wrote
