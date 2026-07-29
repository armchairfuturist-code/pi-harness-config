#!/bin/bash
# build-variant.sh — materialize a candidate pi agent dir for the terseness
# campaign. Base = LIVE ~/.pi/agent (that's what we optimize); the ONLY mutated
# file is candidates/APPEND_SYSTEM.md from the campaign working tree.
# Live ~/.pi/** is never touched. Prints variant agent dir on last line.
set -euo pipefail
CAMPAIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIVE_AGENT="$HOME/.pi/agent"
VROOT="/tmp/pi-terseness-variant"
VAGENT="$VROOT/agent"

rm -rf "$VROOT"
mkdir -p "$VAGENT/extensions/pi-lean-ctx" "$VAGENT/sessions"

# --- config under test ---
cp "$CAMPAIGN/candidates/APPEND_SYSTEM.md" "$VAGENT/APPEND_SYSTEM.md"

# --- invariant config (from live) ---
cp "$LIVE_AGENT/settings.json" "$VAGENT/settings.json"
cp "$HOME/.pi/tscg.json" "$VROOT/tscg.json"
ln -s "$LIVE_AGENT/skills" "$VAGENT/skills"
cp "$LIVE_AGENT/extensions/pi-lean-ctx/config.json" "$VAGENT/extensions/pi-lean-ctx/config.json"
for f in "$LIVE_AGENT"/extensions/*.ts; do
  base="$(basename "$f")"
  [ "$base" = "session-index.ts" ] && continue   # keep variant summaries out of live memory
  ln -s "$f" "$VAGENT/extensions/$base"
done

# --- secrets / packages (symlinked, invariant); models.json patched to proxy ---
jq '.providers.Lilac.baseUrl="http://127.0.0.1:4599/v1"' \
  "$LIVE_AGENT/models.json" > "$VAGENT/models.json"
ln -s "$LIVE_AGENT/auth.json" "$VAGENT/auth.json"
ln -s "$LIVE_AGENT/npm" "$VAGENT/npm"

# WORKAROUND (upstream pi-lean-ctx bug #930): with PI_CODING_AGENT_DIR set,
# pi-lean-ctx resolves config as $DIR/agent/extensions/... (doubled "agent").
# Missing file there => defaults => tool surface explodes (+~16k tok).
mkdir -p "$VAGENT/agent/extensions/pi-lean-ctx"
cp "$LIVE_AGENT/extensions/pi-lean-ctx/config.json" "$VAGENT/agent/extensions/pi-lean-ctx/config.json"

echo "$VAGENT"
