#!/bin/bash
# proxy.sh — lifecycle for the bench-systima capture proxy that makes probe
# numbers deterministic. Direct Lilac probes are contaminated by provider-side
# prompt caching (warm prefix ⇒ raw usage undercounts: 2,356 vs 4,014 on an
# IDENTICAL payload, 2026-07-28). Through the proxy every request is counted
# at full cost and captured to bench-systima/captures/autoresearch/ for later
# payload inspection (great for asi annotations).
#
# Usage: proxy.sh ensure   (idempotent — safe to call before every bench)
#        proxy.sh stop     (at session finalize/cleanup)
set -euo pipefail

BENCH="/home/alex/bench-systima"
PORT=4599
PIDFILE="/tmp/pi-autoresearch-proxy.pid"

case "${1:-ensure}" in
  ensure)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then exit 0; fi
    pkill -TERM -f '[p]roxy-oi.mjs' 2>/dev/null || true  # bracket-safe: won't self-match
    sleep 1
    LABEL=autoresearch PROXY_PORT=$PORT CAPTURE_DIR="$BENCH/captures" \
      UPSTREAM_URL="https://api.getlilac.com/v1" \
      nohup node "$BENCH/rig/proxy-oi.mjs" >>"$BENCH/proxy.log" 2>&1 &
    echo $! > "$PIDFILE"
    for _ in $(seq 1 20); do
      if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then exit 0; fi
      sleep 0.5
    done
    echo "proxy failed to start on :$PORT — see $BENCH/proxy.log" >&2
    exit 1
    ;;
  stop)
    [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
    ;;
esac
