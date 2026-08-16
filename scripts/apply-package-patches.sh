#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${PI_AGENT_HOME:-$HOME/.pi/agent}"

# npm package patches (node scripts)
node "$ROOT/patches/context-mode/apply-patches.mjs"
node "$ROOT/patches/tscg/apply-patches.mjs"
node "$ROOT/patches/dynamic-workflows/apply-patches.mjs"

# lean-ctx MCP bridge resilience patch (bash script, patches the .ts extension)
if [[ -f "$AGENT/patches/pi-lean-ctx/apply-patches.sh" ]]; then
    bash "$AGENT/patches/pi-lean-ctx/apply-patches.sh"
else
    echo "[WARN] pi-lean-ctx patch script not found at $AGENT/patches/pi-lean-ctx/apply-patches.sh"
fi
