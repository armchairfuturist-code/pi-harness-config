#!/bin/bash
cd /home/alex/Projects/pi-harness-config
{
  echo '=== packages.lock.json ==='
  git diff packages.lock.json
  echo '=== agent/packages.lock.json ==='
  git diff agent/packages.lock.json
  echo '=== settings.json ==='
  git diff settings.json
  echo '=== agent/settings.json ==='
  git diff agent/settings.json
} > /home/alex/Projects/pi-harness-config/research/auto-routing-ecosystem-20260812/lock-diff.txt
echo wrote
