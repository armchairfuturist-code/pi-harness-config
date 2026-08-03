#!/bin/bash
# Re-apply context-mode admin-tool removal patches after context-mode upgrade.
# These patches remove 5 admin/diagnostic tool schemas (ctx_stats, ctx_doctor,
# ctx_upgrade, ctx_purge, ctx_insight) from the API request when CTX_MODE_ADMIN_TOOLS=0.
# Measured savings: 4,118 → 3,851 = −267 tokens (−6.5%) per request.
# A/B verified 2026-08-03 via bench/probe.sh through capture proxy.
set -euo pipefail
CM_DIR="$HOME/.pi/agent/npm/node_modules/context-mode/build/adapters/pi"
[ -f "$CM_DIR/mcp-bridge.js" ] || { echo "context-mode not found"; exit 1; }

# Patch mcp-bridge.js: filter admin tools from MCP listTools registration
if ! grep -q 'CTX_MODE_ADMIN_TOOLS' "$CM_DIR/mcp-bridge.js"; then
  sed -i '855a\  // Patched: skip admin/diagnostic tools when CTX_MODE_ADMIN_TOOLS=0\n  const _adminTools = new Set(["ctx_stats","ctx_doctor","ctx_upgrade","ctx_purge","ctx_insight"]);\n  const _filtered = process.env.CTX_MODE_ADMIN_TOOLS === "0" ? tools.filter(t => !_adminTools.has(t.name)) : tools;' "$CM_DIR/mcp-bridge.js"
  sed -i 's|for (const tool of tools) {|for (const tool of _filtered) {|' "$CM_DIR/mcp-bridge.js"
  echo "Patched mcp-bridge.js"
fi

# Patch extension.js: remove admin tool references from routing anchor
if ! grep -q 'CTX_MODE_ADMIN_TOOLS' "$CM_DIR/extension.js"; then
  sed -i 's|"Stats → ctx_stats. Doctor → ctx_doctor. Upgrade → ctx_upgrade. Purge → ctx_purge.");|(process.env.CTX_MODE_ADMIN_TOOLS === "0" ? "" : " Stats → ctx_stats. Doctor → ctx_doctor. Upgrade → ctx_upgrade. Purge → ctx_purge."));|' "$CM_DIR/extension.js"
  echo "Patched extension.js"
fi

echo "Done. CTX_MODE_ADMIN_TOOLS=0 must be set in environment (fish: set -x CTX_MODE_ADMIN_TOOLS 0)"
