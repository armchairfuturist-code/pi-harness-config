#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node "$ROOT/patches/context-mode/apply-patches.mjs"
node "$ROOT/patches/tscg/apply-patches.mjs"
node "$ROOT/patches/dynamic-workflows/apply-patches.mjs"
node "$ROOT/patches/auto-reasoning/apply-patches.mjs"
