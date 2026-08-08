#!/bin/bash
# Long-session canary for context lifecycle policy.
# Drives a tool-heavy, read→edit→re-read workload that exercises the
# transcript-pruner's DEDUP/STALE/CLEAR passes on non-trivial file sizes,
# so compaction/pruning levers (PI_PRUNE_KEEP, reserveTokens) become
# measurable. Reports totalInputTokens + checks + prune-log activity.
#
# Usage: PI_PRUNE_KEEP=4 bash bench/workload-long.sh [RUNS]
set -uo pipefail
RUNS="${1:-1}"
BENCH_DIR="/home/alex/pi-bench-ws-long"
SESSIONS_DIR="/home/alex/.pi/agent/sessions"
PRUNE_LOG="/tmp/pi-prune-long.$$.log"

setup_workspace() {
  rm -rf "$BENCH_DIR"; mkdir -p "$BENCH_DIR"
  # ~6KB article
  { echo "# The quick brown fox"; for i in $(seq 1 90); do echo "The quick brown fox jumps over the lazy dog. Pangram line $i for testing typefaces and keyboards."; done; } >"$BENCH_DIR/article.md"
  printf '{"name":"bench","version":"1.0.0","files":["article.md","data.json","notes.txt","script.py"]}\n' >"$BENCH_DIR/data.json"
  { for i in $(seq 1 80); do echo "TODO item $i: sample task line for the long canary workload."; done; } >"$BENCH_DIR/notes.txt"
  printf 'def greet(name):\n    return f"hello {name}"\n\nif __name__ == "__main__":\n    print(greet("world"))\n' >"$BENCH_DIR/script.py"
}

find_session() {
  local marker="$1" cand best="" best_ts=0
  while IFS= read -r cand; do
    [ "$cand" -nt "$marker" ] || continue
    local cwd; cwd=$(head -1 "$cand" | jq -r '.cwd // empty' 2>/dev/null)
    [ "$cwd" = "$BENCH_DIR" ] || continue
    local ts; ts=$(stat -c %Y "$cand" 2>/dev/null || echo 0)
    if [ "$ts" -gt "$best_ts" ]; then best="$cand"; best_ts="$ts"; fi
  done < <(find "$SESSIONS_DIR" -name '*.jsonl' -type f 2>/dev/null)
  printf '%s' "$best"
}

compute_metric() {
  jq -s '[.[] | select(.message.usage) | (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))] | {total: add, requests: length}' "$1"
}

run_checks() {
  local sess="$1" pass=1 reasons=""
  grep -q 'article.md' "$sess" 2>/dev/null || { pass=0; reasons="${reasons}article not referenced; "; }
  grep -Eqi 'ctx_edit|"edit"|ctx_shell.*append|>>' "$sess" 2>/dev/null || { pass=0; reasons="${reasons}no edit; "; }
  # pruner must have fired (stale or dup or pointer)
  local prune_hits; prune_hits=$(grep -c 'pruned' "$PRUNE_LOG" 2>/dev/null || echo 0)
  [ "$prune_hits" -ge 1 ] || { pass=0; reasons="${reasons}pruner silent($prune_hits); "; }
  grep -Eqi 'unhandled|panic|fatal error' "$sess" 2>/dev/null && { pass=0; reasons="${reasons}error markers; "; }
  printf '%s|%s' "$pass" "$reasons"
}

PROMPT='Read the files article.md, data.json, notes.txt, and script.py one by one and give a one-sentence summary of each. Then append a new line containing exactly DONE to article.md and to notes.txt (use an edit tool, not a full rewrite). Then re-read all four files to confirm their current contents. Finally, report a one-line confirmation. Do not skip any step.'

declare -a totals
for i in $(seq 1 "$RUNS"); do
  setup_workspace
  : >"$PRUNE_LOG"
  marker=$(mktemp)
  ( cd "$BENCH_DIR" && PI_PRUNE_LOG="$PRUNE_LOG" timeout 300 pi -p "$PROMPT" ) >/tmp/pi-long-out.$$.log 2>&1
  rc=$?; rm -f /tmp/pi-long-out.$$.log
  sess=$(find_session "$marker"); rm -f "$marker"
  [ -n "$sess" ] || { echo "RUN $i: no session (rc=$rc)" >&2; continue; }
  total=$(compute_metric "$sess" | jq -r '.total // "null"')
  reqs=$(compute_metric "$sess" | jq -r '.requests // 0')
  chk=$(run_checks "$sess"); cpass="${chk%%|*}"; creasons="${chk#*|}"
  pstale=$(grep -o 'stale' "$PRUNE_LOG" 2>/dev/null | wc -l | tr -d ' ')
  pdup=$(grep -o 'dup' "$PRUNE_LOG" 2>/dev/null | wc -l | tr -d ' ')
  pclear=$(grep -o 'clear' "$PRUNE_LOG" 2>/dev/null | wc -l | tr -d ' ')
  pruned_lines=$(grep -c 'pruned' "$PRUNE_LOG" 2>/dev/null || echo 0)
  echo "RUN $i: total=$total reqs=$reqs checks=$cpass [$creasons] prune(lines=$pruned_lines stale=$pstale dup=$pdup clear=$pclear) rc=$rc" >&2
  [ "$total" != "null" ] && totals+=("$total")
done

if [ ${#totals[@]} -eq 0 ]; then echo "METRIC totalInputTokens=0"; echo "METRIC checks_pass=0"; exit 1; fi
median=$(printf '%s\n' "${totals[@]}" | sort -n | awk '{a[NR]=$1} END {if(NR%2==1) print a[(NR+1)/2]; else print (a[NR/2]+a[NR/2+1])/2}')
echo "METRIC totalInputTokens=$median"
echo "METRIC runs_completed=${#totals[@]}"
echo "METRIC run_totals=$( IFS=,; echo "${totals[*]}" )"
cp "$PRUNE_LOG" /tmp/pi-prune-long-last.log 2>/dev/null; rm -f "$PRUNE_LOG"
