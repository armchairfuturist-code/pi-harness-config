#!/bin/bash
# Variant probe: measure per-request fixed overhead for an ALTERNATE agent dir
# without touching live ~/.pi/agent.
#
# Usage: ./bench/probe-variant.sh <agent-dir>
#
# The agent dir must contain settings.json; models.json/auth.json/npm/skills/
# extensions may be symlinks into the live agent dir. Sessions are written to
# <agent-dir>/sessions (created if absent) via PI_CODING_AGENT_SESSION_DIR.
set -uo pipefail
AGENT_DIR="$(cd "$1" && pwd)"
MODEL="${PROBE_MODEL:-Venice/deepseek-v4-flash-0731}"
WD="/tmp/pi-probe-variant-ws"
SESS="$AGENT_DIR/sessions"
mkdir -p "$SESS"
rm -rf "$WD"
mkdir -p "$WD"
marker=$(mktemp)
(cd "$WD" && PI_CODING_AGENT_DIR="$AGENT_DIR" PI_CODING_AGENT_SESSION_DIR="$SESS" \
  timeout 120 pi -p "Reply with exactly: OK" --model "$MODEL") >/tmp/pi-probe-variant.out 2>&1
rc=$?
best=""
best_ts=0
while IFS= read -r cand; do
  [ "$cand" -nt "$marker" ] || continue
  ts=$(stat -c %Y "$cand" 2>/dev/null || echo 0)
  [ "$ts" -gt "$best_ts" ] && { best="$cand"; best_ts=$ts; }
done < <(find "$SESS" -name '*.jsonl' -type f 2>/dev/null)
rm -f "$marker"
if [ -z "$best" ]; then
  echo "PROBE: no session (rc=$rc) — see /tmp/pi-probe-variant.out"
  tail -5 /tmp/pi-probe-variant.out
  exit 1
fi
rm -f /tmp/pi-probe-variant.out
jq -s '[.[] | select(.message.usage) | (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))] | "PROBE total=" + (add|tostring) + " requests=" + (length|tostring)' "$best"
