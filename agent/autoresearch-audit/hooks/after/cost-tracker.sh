#!/usr/bin/env bash
# cost-tracker.sh — after.sh hook
# Tracks cumulative experiment count and estimates token spend.
# Warns at configurable thresholds to prevent runaway costs.
#
# Token efficiency: gives the agent visibility into cumulative cost,
# encouraging it to be more selective about which experiments to run.
set -euo pipefail

readonly JSONL=".auto/log.jsonl"
readonly WARN_THRESHOLD=30
readonly HARD_THRESHOLD=50
readonly EST_TOKENS_PER_RUN=15000  # conservative estimate: tool schemas + I/O + reasoning

input="$(cat)"
workdir="$(jq -r '.cwd' <<<"$input")"
jsonl="$workdir/$JSONL"

[ -f "$jsonl" ] || exit 0

run_count=$(jq -s 'map(select(.type != "config" and .type != "hook")) | length' "$jsonl" 2>/dev/null) || exit 0
keep_count=$(jq -s 'map(select(.type != "config" and .type != "hook" and .status == "keep")) | length' "$jsonl" 2>/dev/null) || exit 0
discard_count=$(jq -s 'map(select(.type != "config" and .type != "hook" and (.status == "discard" or .status == "crash"))) | length' "$jsonl" 2>/dev/null) || exit 0

[ "$run_count" -eq 0 ] && exit 0

est_tokens=$((run_count * EST_TOKENS_PER_RUN))
est_tokens_k=$((est_tokens / 1000))
hit_rate="N/A"
if [ "$run_count" -gt 0 ]; then
  hit_rate=$(echo "scale=1; $keep_count * 100 / $run_count" | bc -l)
fi

# Only emit steer at thresholds
if [ "$run_count" -ge "$HARD_THRESHOLD" ]; then
  cat <<EOF
🛑 Cost alert: ${run_count} experiments (~${est_tokens_k}k tokens estimated). Keep rate: ${hit_rate}%.
This is a high experiment count. Strongly consider:
- Running /skill:autoresearch-finalize to preserve current wins as reviewable branches
- Setting maxIterations in .auto/config.json if this is runaway
- Being more selective: only run experiments with a clear hypothesis and expected mechanism
EOF
elif [ "$run_count" -ge "$WARN_THRESHOLD" ]; then
  echo "⚠️ Cost notice: ${run_count} experiments (~${est_tokens_k}k tokens). Keep rate: ${hit_rate}%. Be selective — prioritize high-impact experiments."
fi
