#!/bin/bash
# Fast 1-request probe: measures per-request fixed overhead (system prompt +
# tool schemas) with a trivial prompt. Used to quickly test config changes.
set -uo pipefail
MODEL="Lilac/zai-org/glm-5.2"
WD="/tmp/pi-probe-ws"
SESSIONS_DIR="/home/alex/.pi/agent/sessions"
rm -rf "$WD"
mkdir -p "$WD"
marker=$(mktemp)
(cd "$WD" && timeout 120 pi -p "Reply with exactly: OK" --model "$MODEL") >/tmp/pi-probe.out 2>&1
rc=$?
best=""
best_ts=0
while IFS= read -r cand; do
	[ "$cand" -nt "$marker" ] || continue
	cwd=$(head -1 "$cand" | jq -r '.cwd // empty' 2>/dev/null)
	if [ "$cwd" = "$WD" ]; then
		ts=$(stat -c %Y "$cand" 2>/dev/null || echo 0)
		[ "$ts" -gt "$best_ts" ] && {
			best="$cand"
			best_ts="$ts"
		}
	fi
done < <(find "$SESSIONS_DIR" -name '*.jsonl' -type f 2>/dev/null)
rm -f "$marker" /tmp/pi-probe.out
if [ -z "$best" ]; then
	echo "PROBE: no session (rc=$rc)"
	exit 1
fi
jq -s '[.[] | select(.message.usage) |
        (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))]
        | "PROBE total=" + (add|tostring) + " requests=" + (length|tostring)' "$best"
