#!/bin/bash
# build-variant.sh — materialize a candidate pi agent dir from the CURRENT repo
# working tree. Output: /tmp/pi-cfg-variant/{agent,tscg.json}, mirroring the
# ~/.pi/{agent,tscg.json} layout so pi-tscg resolves config identically.
#
# Secrets and installed packages are SYMLINKED from live (never copied, never
# in git). Everything the loop edits is COPIED from the repo working tree.
# Prints the variant agent dir path on stdout (last line).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_AGENT="$HOME/.pi/agent"
VROOT="/tmp/pi-cfg-variant"
VAGENT="$VROOT/agent"

rm -rf "$VROOT"
mkdir -p "$VAGENT/extensions/pi-lean-ctx" "$VAGENT/sessions"

# --- config under test (copied from repo working tree) ---
cp "$REPO/settings.json" "$VAGENT/settings.json"
cp "$REPO/APPEND_SYSTEM.md" "$VAGENT/APPEND_SYSTEM.md"
cp "$REPO/tscg.json" "$VROOT/tscg.json"   # sibling of agent/, mirrors ~/.pi/tscg.json
cp -r "$REPO/skills" "$VAGENT/skills"
cp "$REPO/lean-ctx/pi-config.json" "$VAGENT/extensions/pi-lean-ctx/config.json"

# --- identity / secrets / installed packages (symlinked from live, invariant) ---
# models.json: patched COPY, not symlink — routes the variant through the local
# capture proxy (.auto/proxy.sh) so token counts are full-cost and immune to
# provider prompt-cache undercounting. NEVER measure against direct Lilac.
jq '.providers.Lilac.baseUrl="http://127.0.0.1:4599/v1"' \
  "$LIVE_AGENT/models.json" > "$VAGENT/models.json"
ln -s "$LIVE_AGENT/auth.json"   "$VAGENT/auth.json"
ln -s "$LIVE_AGENT/npm"         "$VAGENT/npm"

# WORKAROUND (upstream pi-lean-ctx bug, #930 half-fix): when PI_CODING_AGENT_DIR
# is set, pi-lean-ctx resolves its config as $PI_CODING_AGENT_DIR/agent/extensions/...
# — note the DOUBLED "agent". Without a file there the bridge boots on defaults
# (no replace mode) and the tool surface explodes (+~16k tok, found 2026-07-28).
mkdir -p "$VAGENT/agent/extensions/pi-lean-ctx"
cp "$REPO/lean-ctx/pi-config.json" "$VAGENT/agent/extensions/pi-lean-ctx/config.json"

# rtk.ts (live-only loose extension) was measured INERT on 2026-07-28 and dropped
# from live: it hooks the `bash` tool, but context-mode `replace` removes `bash`
# (the agent routes shell through ctx_shell). 0 tok fixed overhead, 0 runtime
# effect (0 rtk rewrites in the workload session). A copy is preserved in
# extensions-disabled/rtk.ts. No variant symlink needed.

echo "$VAGENT"
