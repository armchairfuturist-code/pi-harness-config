#!/usr/bin/env bash
# approach-diversity.sh — before.sh hook
# Detects when the agent is thrashing on variations of the same approach.
# Analyzes recent ASI hypothesis fields for semantic overlap and suggests
# a structural pivot when too many similar hypotheses have been discarded.
#
# Anti-overfitting: prevents the agent from overfitting to one optimization
# strategy by forcing structural diversity in the search space.
set -euo pipefail

readonly WINDOW=5
readonly SIMILAR_THRESHOLD=4
readonly JSONL=".auto/log.jsonl"

input="$(cat)"
workdir="$(jq -r '.cwd' <<<"$input")"
jsonl="$workdir/$JSONL"

[ -f "$jsonl" ] || exit 0

# Get the last N discard/crash entries with hypotheses
recent=$(jq -s '
  map(select(.type != "config" and .type != "hook"))
  | .[-'"$WINDOW"':]
  | map(select(.status == "discard" or .status == "crash"))
  | map(.asi.hypothesis // .description // "unknown")
' "$jsonl" 2>/dev/null) || exit 0

discard_count=$(echo "$recent" | jq 'length')
[ "$discard_count" -ge "$SIMILAR_THRESHOLD" ] || exit 0

# Extract key terms from each hypothesis for overlap detection
# Simple approach: check if the same keywords appear across hypotheses
keywords=$(echo "$recent" | jq -r '.[]' | tr '[:upper:]' '[:lower:]' | \
  grep -oP '\b[a-z]{4,}\b' | \
  sort | uniq -c | sort -rn | head -10)

# Count how many hypotheses share the top 3 keywords
top3=$(echo "$keywords" | head -3 | awk '{print $2}')
if [ -z "$top3" ]; then
  exit 0
fi

shared=0
for kw in $top3; do
  count=$(echo "$recent" | jq -r '.[]' | tr '[:upper:]' '[:lower:]' | grep -c "$kw" || true)
  [ "$count" -ge "$SIMILAR_THRESHOLD" ] && shared=$((shared + 1))
done

if [ "$shared" -ge 2 ]; then
  cat <<EOF
🔄 Approach diversity alert: ${discard_count} recent discards share core keywords (${top3}).
You may be thrashing on variations of the same idea. Consider a structural pivot:
- Try a fundamentally different algorithm, data structure, or architectural approach
- Re-read the source files with fresh eyes — look for bottlenecks you haven't considered
- Check .auto/ideas.md for untried approaches
- If you've exhausted the current optimization axis, move to a different one (e.g., from algorithmic to memory, from compute to I/O)
EOF
fi
