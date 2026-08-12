#!/bin/bash
set -euo pipefail
ROOT=/home/alex/Projects/pi-harness-config
LIVE=/home/alex/.pi/agent

rm -rf "$ROOT/patches/auto-reasoning" "$ROOT/agent/patches/auto-reasoning"
rm -rf "$LIVE/patches/auto-reasoning"
rm -rf "$LIVE/npm/node_modules/@howaboua/pi-auto-reasoning-tool"

# leftover empty @howaboua dir is fine
echo '=== remaining tracked AR (repo, exclude research) ==='
cd "$ROOT"
git grep -n -I -e auto-reasoning -e pi-auto-reasoning -e PI_AUTO_REASONING -e change_reasoning -- ':!research/**' || echo NONE

echo '=== live settings/lock AR ==='
grep -n auto-reasoning "$LIVE/settings.json" "$LIVE/packages.lock.json" "$LIVE/scripts/apply-package-patches.sh" || echo live-config-NONE

echo '=== live package dir ==='
ls -d "$LIVE/npm/node_modules/@howaboua/pi-auto-reasoning-tool" 2>&1 || echo live-pkg-gone

echo '=== json parse ==='
node /home/alex/Projects/pi-harness-config/research/auto-routing-ecosystem-20260812/parse-json.js

echo '=== git restore unrelated ==='
git checkout -- research/autoresearch-terseness-20260729/build-variant.sh || true

echo done
