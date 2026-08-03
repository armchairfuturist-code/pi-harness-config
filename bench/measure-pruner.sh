#!/bin/bash
# Pruner-exercising bench: workloads with duplicate reads (dedup) and
# read-then-edit (stale) patterns so transcript-pruner has something to prune.
# Reports totalInputTokens + request count per run.
set -uo pipefail
RUNS="${1:-3}"
BENCH_DIR="/home/alex/pi-bench-ws"
SESSIONS_DIR="/home/alex/.pi/agent/sessions"

setup_workspace() {
  rm -rf "$BENCH_DIR"; mkdir -p "$BENCH_DIR"
  cat >"$BENCH_DIR/article.md" <<'MD'
# The quick brown fox
The quick brown fox jumps over the lazy dog. This sentence is famous for
containing every letter of the English alphabet at least once, which makes it
useful for testing typefaces and keyboards.

## History
Pangrams have been used since the dawn of printing to display all the glyphs in
a font. The earliest known English pangram was published in 1885, though it was
considerably longer and far less elegant than the version we know today.

## Modern usage
Today, the fox pangram appears in countless contexts: font previews, typing
tutors, handwriting worksheets, and even in the default text of many word
processors. Its enduring popularity is a testament to its simplicity and
completeness.

## Other pangrams
There are many other pangrams in English and other languages. Some are short
and clever; others are long and contrived. The beauty of the fox sentence is
that it manages to be both complete and natural-sounding, which is rare.

## Conclusion
Pangrams remind us that language is a playground. A single sentence can serve
a practical purpose while also being a small work of art.
MD
  printf 'TODO: buy groceries\nTODO: call mom\nTODO: finish the report\n' >"$BENCH_DIR/notes.txt"
  printf 'def greet(name):\n    return f"hello {name}"\n' >"$BENCH_DIR/script.py"
  rm -f "$BENCH_DIR/hello.txt"
}

# Prompt designed to create duplicate reads and stale-read-before-edit:
#  1. List files (unique read)
#  2. Read article.md (first read)
#  3. Read article.md AGAIN (duplicate — dedup target)
#  4. Read notes.txt (unique read)
#  5. Read notes.txt AGAIN (duplicate — dedup target)
#  6. Edit notes.txt (makes earlier reads stale)
#  7. Read notes.txt after edit (fresh, not stale)
#  8. Create hello.txt
PROMPT='Do these steps in order:
1. List all files in the current directory.
2. Read the file article.md.
3. Read the file article.md again (yes, read it a second time).
4. Read the file notes.txt.
5. Read the file notes.txt again.
6. Edit notes.txt: add a new line at the end saying "TODO: test pruner".
7. Read notes.txt one more time to confirm the edit.
8. Create a new file hello.txt with content: hello world
Report a one-sentence summary of article.md when done.'

find_session() {
  local marker="$1" cand best="" best_ts=0
  while IFS= read -r cand; do
    [ "$cand" -nt "$marker" ] || continue
    local cwd; cwd=$(head -1 "$cand" | jq -r '.cwd // empty' 2>/dev/null)
    if [ "$cwd" = "$BENCH_DIR" ]; then
      local ts; ts=$(stat -c %Y "$cand" 2>/dev/null || echo 0)
      [ "$ts" -gt "$best_ts" ] && { best="$cand"; best_ts=$ts; }
    fi
  done < <(find "$SESSIONS_DIR" -name '*.jsonl' -type f 2>/dev/null)
  printf '%s' "$best"
}

compute_metric() {
  local sess="$1"
  jq -s '[.[] | select(.message.usage) | (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))] | {total: add, requests: length}' "$sess"
}

run_checks() {
  local sess="$1" pass=1 reasons=""
  if [ ! -f "$BENCH_DIR/hello.txt" ]; then pass=0; reasons="${reasons}hello.txt missing; "
  else
    local content; content=$(cat "$BENCH_DIR/hello.txt"); content="${content%$'\n'}"
    [ "$content" = "hello world" ] || { pass=0; reasons="${reasons}hello.txt content='$content'; "; }
  fi
  grep -q 'test pruner' "$BENCH_DIR/notes.txt" 2>/dev/null || { pass=0; reasons="${reasons}notes.txt not edited; "; }
  printf '%s|%s' "$pass" "$reasons"
}

declare -a totals
all_ok=1
for i in $(seq 1 "$RUNS"); do
  setup_workspace
  marker=$(mktemp)
  (cd "$BENCH_DIR" && timeout 300 pi -p "$PROMPT") >/tmp/pi-pruner-bench.$$.log 2>&1
  rc=$?; rm -f /tmp/pi-pruner-bench.$$.log
  sess=$(find_session "$marker"); rm -f "$marker"
  if [ -z "$sess" ]; then echo "RUN $i: no session jsonl found (rc=$rc)" >&2; all_ok=0; continue; fi
  m=$(compute_metric "$sess")
  total=$(printf '%s' "$m" | jq -r '.total // "null"')
  reqs=$(printf '%s' "$m" | jq -r '.requests // 0')
  chk=$(run_checks "$sess"); cpass="${chk%%|*}"; creasons="${chk#*|}"
  echo "RUN $i: totalInputTokens=$total requests=$reqs checks_pass=$cpass [$creasons] rc=$rc" >&2
  [ "$cpass" != "1" ] && all_ok=0
  [ "$total" != "null" ] && totals+=("$total")
done

if [ ${#totals[@]} -eq 0 ]; then echo "METRIC totalInputTokens=0"; echo "METRIC checks_pass=0"; echo "METRIC runs_completed=0"; exit 1; fi
median=$(printf '%s\n' "${totals[@]}" | sort -n | awk '{a[NR]=$1} END {if(NR%2==1) print a[(NR+1)/2]; else print (a[NR/2]+a[NR/2+1])/2}')
echo "METRIC totalInputTokens=$median"
echo "METRIC checks_pass=$all_ok"
echo "METRIC runs_completed=${#totals[@]}"
echo "METRIC run_totals=$( IFS=,; echo "${totals[*]}" )"
