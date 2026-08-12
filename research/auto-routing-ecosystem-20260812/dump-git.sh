#!/bin/bash
set -euo pipefail
cd /home/alex/Projects/pi-harness-config
{
  echo "=== branch ==="
  git branch -vv
  echo "=== remotes ==="
  git remote -v
  echo "=== status ==="
  git status
  echo "=== last 8 ==="
  git log -8 --oneline
} > /home/alex/Projects/pi-harness-config/research/auto-routing-ecosystem-20260812/git-status.txt
echo wrote
