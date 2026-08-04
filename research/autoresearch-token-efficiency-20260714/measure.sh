#!/bin/bash
set -euo pipefail

MODEL="opencode-zen/big-pickle"
STATS="/home/alex/.pi/agent/pi-cache-optimizer-stats.json"
BACKUP="/tmp/agents_backup.md"
TASK='Use a bash command to copy /home/alex/Projects/AGENTS.md to /tmp/agents_backup.md. Then read /tmp/agents_backup.md and report how many lines it contains.'

# Run 3 times to warm cache + reduce variance; report median delta.
deltas=()
success=0
for i in 1 2 3; do
  rm -f "$BACKUP"
  before=$(jq '[.totalsByModel[].totalInputTokens] | add // 0' "$STATS")
  pi -p -a --model "$MODEL" "$TASK" > /tmp/bench_out_$i.txt 2>&1
  sleep 5
  after=$(jq '[.totalsByModel[].totalInputTokens] | add // 0' "$STATS")
  # If stats still not flushed, wait more
  if [ "$after" -le "$before" ]; then
    sleep 5
    after=$(jq '[.totalsByModel[].totalInputTokens] | add // 0' "$STATS")
  fi
  deltas+=($((after - before)))
  if [ "$i" -eq 3 ] && [ -f "$BACKUP" ]; then
    success=1
  fi
done

# Median of deltas
sorted=($(printf '%s\n' "${deltas[@]}" | sort -n))
n=${#sorted[@]}
mid=$((n / 2))
if [ $((n % 2)) -eq 0 ]; then
  delta=$(( (sorted[mid-1] + sorted[mid]) / 2 ))
else
  delta=${sorted[mid]}
fi

echo "METRIC total_input_tokens=$delta"
echo "METRIC task_success=$success"
