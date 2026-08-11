#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PI_BENCH_PORT:-4599}"
PIDFILE="${TMPDIR:-/tmp}/pi-harness-proxy-$PORT.pid"
CAPTURE_DIR="${PI_BENCH_CAPTURE_DIR:-$ROOT/.scratch/captures}"
UPSTREAM_URL="${PI_BENCH_UPSTREAM_URL:-https://api.venice.ai/api/v1}"
case "${1:-ensure}" in
  ensure)
    # Every run gets its requested label/environment; do not reuse a process
    # started by a prior benchmark with a different capture destination.
    if [[ -f "$PIDFILE" ]]; then kill "$(<"$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"; sleep 0.2; fi
    mkdir -p "$CAPTURE_DIR"
    LABEL="${PI_BENCH_LABEL:-probe}" PROXY_PORT="$PORT" CAPTURE_DIR="$CAPTURE_DIR" \
      UPSTREAM_URL="$UPSTREAM_URL" COLD_BUST=1 nohup node "$ROOT/bench/proxy-oi.mjs" \
      >"${TMPDIR:-/tmp}/pi-harness-proxy-$PORT.log" 2>&1 &
    echo $! > "$PIDFILE"
    for _ in $(seq 1 30); do (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && exit 0; sleep 0.2; done
    echo "proxy failed on $PORT" >&2; exit 1;;
  stop)
    [[ -f "$PIDFILE" ]] && kill "$(<"$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE";;
  *) echo "usage: $0 ensure|stop" >&2; exit 2;;
esac
