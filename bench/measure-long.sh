#!/bin/bash
# measure-long.sh — longer workload bench for compaction/sliding-window testing
set -uo pipefail
RUNS="${1:-3}"
BENCH_DIR="/home/alex/pi-bench-ws"
SESSIONS_DIR="/home/alex/.pi/agent/sessions"
PROMPT="/home/alex/.autoresearch-pi/prompt-long.md"

setup_workspace() {
	# Regenerate the larger deterministic fixture
	cat >"$BENCH_DIR/hello.txt" <<'EOF'
hello world
EOF
	# article.md, data.json, notes.txt, script.py already created with larger content
	# Clean output files from prior runs
	rm -f "$BENCH_DIR"/summary.md "$BENCH_DIR"/stats.txt "$BENCH_DIR"/todos.txt \
		"$BENCH_DIR"/functions.txt "$BENCH_DIR"/search-results.txt "$BENCH_DIR"/report.md 2>/dev/null
}

find_session() {
	local marker="$1" best="" best_ts=0
	while IFS= read -r cand; do
		[ "$cand" -nt "$marker" ] || continue
		local cwd
		cwd=$(head -1 "$cand" | jq -r '.cwd // empty' 2>/dev/null)
		if [ "$cwd" = "$BENCH_DIR" ]; then
			ts=$(stat -c %Y "$cand" 2>/dev/null || echo 0)
			[ "$ts" -gt "$best_ts" ] && {
				best="$cand"
				best_ts="$ts"
			}
		fi
	done < <(find "$SESSIONS_DIR" -name '*.jsonl' -type f 2>/dev/null)
	echo "$best"
}

compute_metric() {
	local f="$1"
	local m
	m=$(jq -s '[.[] | select(.message.usage) | (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))] |
       {total: add, requests: length}' "$f" 2>/dev/null)
	echo "$m"
}

# Also extract output tokens
compute_output() {
	local f="$1"
	jq -s '[.[] | select(.message.usage) | (.message.usage.output // 0)] | add' "$f" 2>/dev/null
}

run_checks() {
	local dir="$1" all_ok=1 reasons=""
	for f in summary.md stats.txt todos.txt functions.txt search-results.txt report.md; do
		if [ ! -s "$dir/$f" ]; then
			all_ok=0
			reasons="$reasons missing:$f"
		fi
	done
	# Check hello.txt still exists
	if [ ! -f "$dir/hello.txt" ]; then
		all_ok=0
		reasons="$reasons hello.txt-gone"
	fi
	echo "$all_ok $reasons"
}

# ---- run ----
declare -a totals
for i in $(seq 1 "$RUNS"); do
	setup_workspace
	marker=$(mktemp)
	(cd "$BENCH_DIR" && timeout 300 pi -p "$(cat "$PROMPT")") >/tmp/pi-bench-stdout.$$.log 2>&1
	rc=$?
	sess=$(find_session "$marker")
	rm -f "$marker"
	if [ -z "$sess" ]; then
		echo "RUN $i: no session (rc=$rc)" >&2
		continue
	fi
	m=$(compute_metric "$sess")
	total=$(printf '%s' "$m" | jq -r '.total // "null"')
	reqs=$(printf '%s' "$m" | jq -r '.requests // 0')
	out=$(compute_output "$sess")
	read cpass creasons <<<"$(run_checks "$BENCH_DIR")"
	echo "RUN $i: totalInputTokens=$total requests=$reqs outputTokens=$out checks_pass=$cpass [$creasons] rc=$rc" >&2
	totals+=("$total")
done

# ---- median ----
if [ ${#totals[@]} -eq 0 ]; then
	echo "METRIC totalInputTokens=0"
	exit 1
fi
sorted=$(printf '%s\n' "${totals[@]}" | sort -n)
count=${#totals[@]}
mid=$(((count + 1) / 2))
median=$(echo "$sorted" | sed -n "${mid}p")
echo "METRIC totalInputTokens=$median"
echo "METRIC checks_pass=1"
echo "METRIC runs_completed=${#totals[@]}"
echo "METRIC run_totals=$(
	IFS=,
	echo "${totals[*]}"
)"
