#!/bin/bash
# Minimal probe: confirm transcript-pruner fires (writes PI_PRUNE_LOG).
set -uo pipefail
WS="/home/alex/pi-prune-probe"
LOG="/tmp/prune-probe.log"
rm -rf "$WS"; mkdir -p "$WS"
{ for i in $(seq 1 60); do echo "content line $i for the prune probe file a"; done; } >"$WS/a.txt"
{ for i in $(seq 1 60); do echo "content line $i for the prune probe file b"; done; } >"$WS/b.txt"
: >"$LOG"
cd "$WS" && PI_PRUNE_LOG="$LOG" PI_PRUNE_KEEP=2 timeout 180 pi -p "Read a.txt and summarize in one line. Read b.txt and summarize in one line. Then append exactly DONE to a.txt. Then re-read a.txt and b.txt to confirm. Then report done." >/tmp/prune-probe.out 2>&1
rc=$?
echo "=== rc=$rc ==="
echo "=== output (tail) ==="; tail -5 /tmp/prune-probe.out
echo "=== prune log (bytes: $(wc -c <"$LOG" 2>/dev/null || echo 0)) ==="
cat "$LOG" 2>/dev/null | head -30
