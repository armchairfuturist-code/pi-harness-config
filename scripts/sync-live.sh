#!/usr/bin/env bash
# sync-live.sh — push repo-owned config to the live agent home, report settings drift, verify.
#
# Why: bench/probe reads REPO tscg.json (via build-variant) but live sessions read
# ~/.pi/tscg.json. Editing one without the other silently desyncs (bit us in Iter 12).
# Run this after editing any repo config file. Config direction is repo -> live;
# memory/*.md is live-authored and is never overwritten here (consolidate back into
# the repo via commit instead).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${PI_AGENT_DIR:-$HOME/.pi/agent}"
PI_HOME="$(dirname "$AGENT")"

sync_one() {
  local src="$1" dest="$2"
  if cmp -s "$ROOT/$src" "$dest"; then
    echo "[same] $src"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$ROOT/$src" "$dest"
    echo "[SYNC] $src -> $dest"
  fi
}

sync_one tscg.json            "$PI_HOME/tscg.json"
sync_one AGENTS.md            "$AGENT/AGENTS.md"
sync_one HARNESS.md           "$AGENT/HARNESS.md"
sync_one APPEND_SYSTEM.md     "$AGENT/APPEND_SYSTEM.md"
sync_one packages.lock.json   "$AGENT/packages.lock.json"

# settings.json: report-only. Live keeps its own provider/model (install.sh policy);
# flag drift on harness-owned keys only.
if command -v jq >/dev/null 2>&1 && [[ -f "$AGENT/settings.json" ]]; then
  drift=$(jq -n \
    --slurpfile live "$AGENT/settings.json" \
    --slurpfile repo "$ROOT/settings.json" \
    '{compaction: ($live[0].compaction != $repo[0].compaction),
      pruning:   ($live[0].pruning   != $repo[0].pruning)}')
  echo "settings drift (harness keys): $drift"
fi

exec "$ROOT/scripts/harness-preflight.sh"
