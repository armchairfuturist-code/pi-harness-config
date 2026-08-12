#!/bin/bash
cd /home/alex/Projects/pi-harness-config
{
  echo '=== status ==='
  git status --short
  echo '=== diff stat ==='
  git diff --stat
  echo '=== settings packages ==='
  grep -n packages -A20 settings.json | head -22
  echo '=== agent settings packages ==='
  grep -n packages -A20 agent/settings.json | head -22
} > /home/alex/Projects/pi-harness-config/research/auto-routing-ecosystem-20260812/precommit.txt
echo wrote
