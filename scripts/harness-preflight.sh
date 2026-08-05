#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${PI_AGENT_HOME:-$HOME/.pi/agent}"
ERR=0
ok() { printf 'OK %s\n' "$*"; }
bad() { printf 'BAD %s\n' "$*" >&2; ERR=1; }

if [[ -f "$ROOT/install.sh" ]]; then node "$ROOT/scripts/validate-manifest.mjs" && ok "repo manifest closes" || bad "repo manifest mismatch"; fi
PI_PACKAGE_LOCK="$AGENT/packages.lock.json" node "$ROOT/scripts/verify-package-lock.mjs" && ok "package versions pinned" || bad "package lock mismatch"
node "$ROOT/scripts/validate-live-settings.mjs" "$AGENT/settings.json" && ok "settings and extension paths resolve" || bad "settings/extension mismatch"
for file in HARNESS.md APPEND_SYSTEM.md AGENTS.md; do [[ -f "$AGENT/$file" ]] && ok "$file present" || bad "$file missing"; done

CM="$AGENT/npm/node_modules/context-mode/build/adapters/pi"
grep -q 'PI_HARNESS_ADMIN_TOOLS_REMOVED' "$CM/mcp-bridge.js" 2>/dev/null && ok "context-mode schema patch" || bad "context-mode schema patch missing"
grep -q 'PI_HARNESS_ADMIN_ROUTING_REMOVED' "$CM/extension.js" 2>/dev/null && ok "context-mode routing patch" || bad "context-mode routing patch missing"
grep -q 'PI_HARNESS_TSCG_DEEP' "$AGENT/npm/node_modules/pi-tscg/extensions/tscg.ts" 2>/dev/null && ok "TSCG recursive patch" || bad "TSCG recursive patch missing"

if grep -RqiE 'invest-tools|invest_pulse|invest_optimize|invest_risk|invest-optimizer' "$AGENT/settings.json" "$AGENT/APPEND_SYSTEM.md" "$AGENT/HARNESS.md" "$AGENT/extensions" 2>/dev/null; then bad "personal investment tooling present in active harness"; else ok "generic active harness"; fi

[[ "$ERR" -eq 0 ]] || { echo "preflight FAILED" >&2; exit 1; }
echo "preflight OK"
