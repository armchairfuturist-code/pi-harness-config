#!/usr/bin/env bash
# Fix: lean-ctx knowledge base embeddings.
#
# Problem: Knowledge facts created before ONNX Runtime was provisioned
# have zero embedding vectors. Semantic and hybrid retrieval modes are
# blocked as a result. The CLI export/import path does NOT trigger
# embedding generation — only the "remember" path does, and the only
# way to bulk-reindex existing facts is the MCP action
# ctx_knowledge(action="embeddings_reindex").
#
# Prerequisite: MCP expansion must be enabled.
#   bash ~/.pi/agent/scripts/mcp-toggle.sh on
#   # Start a new Pi session, then run the reindex action.
#
# This script checks prerequisites and provides instructions.
# The actual reindex must be run inside a Pi session (it's an MCP
# tool action, not a CLI command).
set -euo pipefail

CONFIG="${PI_AGENT_HOME:-$HOME/.pi/agent}/extensions/pi-lean-ctx/config.json"

echo "=== lean-ctx Embeddings Fix ==="
echo ""

# Check if ONNX Runtime is provisioned
ONNX_STATUS=$(lean-ctx embeddings status 2>&1 || true)
if echo "$ONNX_STATUS" | grep -qi 'not.*provision\|missing\|absent'; then
  echo "[FAIL] ONNX Runtime not provisioned. Run: lean-ctx embeddings provision"
  exit 1
fi
echo "[ OK ] ONNX Runtime provisioned"

# Check current embedding vector count
LIFECYCLE=$(lean-ctx knowledge lifecycle 2>&1 || true)
VECTORS=$(echo "$LIFECYCLE" | grep -oP 'embeddings \K[0-9]+' || echo "unknown")
echo "[INFO] Knowledge base vectors: $VECTORS"

if [[ "$VECTORS" != "0" && "$VECTORS" != "unknown" ]]; then
  echo "[ OK ] Embeddings already present ($VECTORS vectors). No fix needed."
  exit 0
fi

echo ""
echo "[FIX] Embeddings missing (0 vectors). Reindex required."
echo ""
echo "The reindex is an MCP tool action, not a CLI command."
echo "Steps:"
echo "  1. Ensure MCP expansion is enabled:"
echo "       bash ~/.pi/agent/scripts/mcp-toggle.sh on"
echo "  2. Start a new Pi session"
echo "  3. Run the reindex action from within Pi:"
echo "       ctx_knowledge(action=\"embeddings_reindex\")"
echo "  4. Verify:"
echo "       lean-ctx knowledge lifecycle"
echo "       # Should show: embeddings N vector(s)"
echo ""
echo "All embedding generation is local (ONNX Runtime)."
echo "No API calls, no data leaves the machine."
