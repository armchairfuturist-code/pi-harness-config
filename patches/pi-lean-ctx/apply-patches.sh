#!/bin/bash
# Re-apply pi-lean-ctx MCP bridge resilience patch after extension upgrade.
#
# PROBLEM: When the lean-ctx daemon returns an internal error ("lean-ctx internal
# error. The MCP server is still running. Please retry or use a different
# approach."), the MCP bridge throws it directly to the agent. The agent sees
# "Please retry" and does exactly that — creating retry+reread loops that inflate
# rot signals. 495 MCP errors across 121 sessions (Jul-Aug 2026).
#
# FIX (2 parts, both in mcp-bridge.ts callTool()):
#   1. Extend retry logic: catch "internal error" (not just timeouts),
#      force-reconnect + retry once before surfacing the error.
#   2. Strip "Please retry or use a different approach" from error messages
#      that reach the agent — prevents triggering agent retry loops.
#
# Patch is idempotent: checks for sentinel comment before applying.
set -euo pipefail
BRIDGE="$HOME/.pi/agent/npm/node_modules/pi-lean-ctx/extensions/mcp-bridge.ts"
[ -f "$BRIDGE" ] || { echo "pi-lean-ctx mcp-bridge.ts not found"; exit 1; }

SENTINEL="PATCHED: internal-error retry"
if grep -q "$SENTINEL" "$BRIDGE"; then
  echo "Already patched: $SENTINEL"
  exit 0
fi

python3 - "$BRIDGE" << 'PYEOF'
import sys, os

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

old = """      if (this.isTimeoutError(error) && isRetrySafeTool(name)) {
        this.lastRetry = {
          toolName: name,
          reason: "timeout",
          retried: true,
          timestamp: new Date().toISOString(),
        };
        await this.forceReconnect();
        const retried = await this.callToolWithTimeout(name, args, signal);
        this.lastError = undefined;
        return this.toTextBlocks(retried);
      }

      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;"""

new = """      // PATCHED: internal-error retry — extend retry to catch "lean-ctx
      // internal error" (not just timeouts). The daemon is alive but the
      // tool call failed internally; a forceReconnect + retry often heals it.
      const isInternalError = error instanceof Error &&
        /lean-ctx internal error|MCP server is still running/i.test(error.message);
      if ((this.isTimeoutError(error) && isRetrySafeTool(name)) || isInternalError) {
        this.lastRetry = {
          toolName: name,
          reason: isInternalError ? "internal-error" : "timeout",
          retried: true,
          timestamp: new Date().toISOString(),
        };
        try {
          await this.forceReconnect();
          const retried = await this.callToolWithTimeout(name, args, signal);
          this.lastError = undefined;
          return this.toTextBlocks(retried);
        } catch (retryError) {
          // Retry failed — fall through to throw a sanitized error
          error = retryError;
        }
      }

      // PATCHED: strip "Please retry" from error text to prevent agent
      // retry loops. The agent sees this instruction and follows it,
      // creating the exact retry+reread loops we measured.
      this.lastError = error instanceof Error ? error.message : String(error);
      if (/please retry|use a different approach/i.test(this.lastError)) {
        this.lastError = this.lastError
          .replace(/\\.?\\s*Please retry or use a different approach\\.?/gi, "")
          .replace(/\\.?\\s*Please retry\\.?/gi, "")
          .trim();
        throw new Error(this.lastError || `lean-ctx MCP tool "${name}" failed.`);
      }
      throw error;"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("  Patched callTool() retry logic")
else:
    print("  WARNING: callTool() pattern not found — extension may have changed")
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'isTimeoutError' in line and 'isRetrySafeTool' in line:
            print(f"  Found at line {i+1}: {line.strip()[:80]}")
            for j in range(i, min(i+20, len(lines))):
                print(f"    {j+1}: {lines[j].rstrip()[:100]}")
            break
    sys.exit(1)
PYEOF

echo "Applied: $SENTINEL"
echo "Restart pi to activate the patched MCP bridge."
echo "Verify: grep -c 'PATCHED: internal-error' \"$BRIDGE\""
