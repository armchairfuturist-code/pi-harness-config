#!/bin/bash
# Fast 1-request probe: measures per-request fixed overhead (system prompt +
# tool schemas) of the COMMITTED repo config, cold-gated through the capture
# proxy so provider-side prompt caching can't undercount. Direct Lilac probes
# false-green: 2,356 vs 4,014 on an identical payload (2026-07-28).
#
# Builds a variant agent dir from the repo working tree (bench/build-variant.sh),
# routes it through the bench-systima capture proxy (bench/proxy.sh), and runs a
# trivial prompt. The variant's models.json is patched by build-variant.sh to
# point Lilac at 127.0.0.1:4599, so `pi -p` against the variant auto-routes.
# Output: "PROBE total=<tok> requests=<n>".
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${PROBE_MODEL:-Lilac/zai-org/glm-5.2}"

bash "$REPO/bench/proxy.sh" ensure || { echo "PROBE: proxy ensure failed" >&2; exit 1; }
VAGENT="$(bash "$REPO/bench/build-variant.sh")" || { echo "PROBE: variant build failed" >&2; exit 1; }

WD="/tmp/pi-probe-ws"
SESS="$VAGENT/sessions"
rm -rf "$WD"; mkdir -p "$WD" "$SESS"
marker=$(mktemp)
( cd "$WD" && PI_CODING_AGENT_DIR="$VAGENT" PI_CODING_AGENT_SESSION_DIR="$SESS" \
    timeout 120 pi -p "Reply with exactly: OK" --model "$MODEL" ) >/tmp/pi-probe.out 2>&1
rc=$?

best=""; best_ts=0
while IFS= read -r cand; do
  [ "$cand" -nt "$marker" ] || continue
  ts=$(stat -c %Y "$cand" 2>/dev/null || echo 0)
  [ "$ts" -gt "$best_ts" ] && { best="$cand"; best_ts=$ts; }
done < <(find "$SESS" -name '*.jsonl' -type f 2>/dev/null)
rm -f "$marker"

if [ -z "$best" ]; then
  echo "PROBE: no session (rc=$rc)"; tail -5 /tmp/pi-probe.out 2>/dev/null; exit 1
fi
rm -f /tmp/pi-probe.out

jq -s '[.[] | select(.message.usage) | (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))] | "PROBE total=" + (add|tostring) + " requests=" + (length|tostring)' "$best"
