#!/bin/bash
set -euo pipefail
cd /home/alex/Projects/pi-harness-config

git add \
  settings.json packages.lock.json \
  agent/settings.json agent/packages.lock.json \
  scripts/apply-package-patches.sh agent/scripts/apply-package-patches.sh \
  install.sh README.md hil/ledger.md \
  patches/auto-reasoning agent/patches/auto-reasoning

git status --short
git diff --cached --stat

git commit -m "remove: drop pi-auto-reasoning-tool and raise-only harness patch" \
  -m "Thinking stays on defaultThinkingLevel + model-thinking.json + /think." \
  -m "The package could only raise and switched cache lanes. grok-4-6 Phase 1: medium cheapest; low cost more."

git status -sb
git push origin master
git log -1 --oneline
git status -sb
