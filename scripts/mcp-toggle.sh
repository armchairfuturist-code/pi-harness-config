#!/usr/bin/env bash
# Toggle the lean-ctx MCP expansion on or off.
#
# The "lean" toolProfile always provides a floor of ctx_* tools
# (ctx_read, ctx_grep, ctx_find, ctx_ls, ctx_edit, ctx_shell) at
# ~3,757 tokens/turn. Enabling MCP adds the expansion surface
# (ctx_search, ctx_fetch_and_index, ctx_batch_execute, ctx_execute,
# ctx_execute_file, ctx_index, ctx_knowledge) for ~+1,757 tokens/turn.
#
# Efficiency analysis (2026-08-10) shows the expansion is net-positive
# for sessions >5 turns or content >5K tokens/turn, driven by:
#   - Turn reduction via ctx_batch_execute (7 cmds → 1 call)
#   - Content compression via ctx_search (2KB results vs 20KB raw files)
#   - Web search unblock via ctx_fetch_and_index (no CLI equivalent)
#   - Sandbox execution via ctx_execute (Think-in-Code pattern)
#
# Usage: mcp-toggle.sh [on|off|status]
#   on     Enable MCP expansion (default for research/heavy sessions)
#   off    Disable MCP expansion (for quick <5-turn sessions)
#   status Show current state
set -euo pipefail

CONFIG="${PI_AGENT_HOME:-$HOME/.pi/agent}/extensions/pi-lean-ctx/config.json"

if [[ ! -f "$CONFIG" ]]; then
  echo "FAIL: config not found at $CONFIG" >&2
  exit 1
fi

ACTION="${1:-status}"

case "$ACTION" in
  on)
    jq '.enableMcp=true' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
    echo "MCP expansion: ON (+~1,757 tokens/turn)"
    echo "  ctx_search, ctx_fetch_and_index, ctx_batch_execute,"
    echo "  ctx_execute, ctx_execute_file, ctx_index, ctx_knowledge"
    echo "  — requires new Pi session to take effect"
    ;;
  off)
    jq '.enableMcp=false' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
    echo "MCP expansion: OFF (lean floor only, ~3,757 tokens/turn)"
    echo "  ctx_read, ctx_grep, ctx_find, ctx_ls, ctx_edit, ctx_shell"
    echo "  — requires new Pi session to take effect"
    ;;
  status)
    STATE=$(jq -r '.enableMcp' "$CONFIG")
    if [[ "$STATE" == "true" ]]; then
      echo "MCP expansion: ON (+~1,757 tokens/turn)"
    else
      echo "MCP expansion: OFF (lean floor only)"
    fi
    DISABLED=$(jq -r '.disableTools | join(", ")' "$CONFIG")
    echo "Disabled tools: ${DISABLED:-none}"
    ;;
  *)
    echo "Usage: mcp-toggle.sh [on|off|status]" >&2
    exit 1
    ;;
esac
