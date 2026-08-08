#!/usr/bin/env bash
# Unattended multi-generation pi supervisor (rot-marker aware).
# See scripts/unattended-loop.mjs for full docs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/scripts/unattended-loop.mjs" "$@"
