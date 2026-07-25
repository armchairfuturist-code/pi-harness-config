#!/bin/bash
# Autoresearch measure script.
# Runs the pi harness bench workload and reports totalInputTokens from the
# session jsonl (sum of input + cacheRead + cacheWrite across all requests).
#
# Workload: list files in a dir, read the largest file and summarize it,
# create a file with content 'hello world'.
#
# Usage: ./measure.sh [RUNS]   (RUNS default 3; median is reported)
set -uo pipefail

RUNS="${1:-3}"
MODEL="$(jq -r '.defaultModel' /home/alex/.pi/agent/settings.json)"
BENCH_DIR="/home/alex/pi-bench-ws"
SESSIONS_DIR="/home/alex/.pi/agent/sessions"
LOG="/dev/stderr"

# ---- regenerate a deterministic workspace fixture ----
setup_workspace() {
	rm -rf "$BENCH_DIR"
	mkdir -p "$BENCH_DIR"
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
	printf '{"name":"bench","version":"1.0.0","files":["article.md","data.json","notes.txt","script.py"]}\n' >"$BENCH_DIR/data.json"
	printf 'TODO: buy groceries\nTODO: call mom\nTODO: finish the report\n' >"$BENCH_DIR/notes.txt"
	printf 'def greet(name):\n    return f"hello {name}"\n\nif __name__ == "__main__":\n    print(greet("world"))\n' >"$BENCH_DIR/script.py"
}

PROMPT='List all files in the current directory. Then identify the largest file by size, read it, and summarize its contents in one sentence. Finally, create a new file named hello.txt with the exact content: hello world'

# Find the session jsonl for the just-finished run (cwd == BENCH_DIR, newest).
find_session() {
	local marker="$1"
	local cand best=""
	local best_ts=0
	while IFS= read -r cand; do
		# only files newer than marker
		[ "$cand" -nt "$marker" ] || continue
		local cwd
		cwd=$(head -1 "$cand" | jq -r '.cwd // empty' 2>/dev/null)
		if [ "$cwd" = "$BENCH_DIR" ]; then
			local ts
			ts=$(stat -c %Y "$cand" 2>/dev/null || echo 0)
			if [ "$ts" -gt "$best_ts" ]; then
				best="$cand"
				best_ts="$ts"
			fi
		fi
	done < <(find "$SESSIONS_DIR" -name '*.jsonl' -type f 2>/dev/null)
	printf '%s' "$best"
}

compute_metric() {
	local sess="$1"
	jq -s '[.[] | select(.message.usage) |
          (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))]
          | {total: add, requests: length}' "$sess"
}

# Correctness checks against the just-finished run.
run_checks() {
	local sess="$1"
	local pass=1
	local reasons=""
	# 1. hello.txt created with correct content
	if [ ! -f "$BENCH_DIR/hello.txt" ]; then
		pass=0
		reasons="${reasons}hello.txt missing; "
	else
		local content
		content=$(cat "$BENCH_DIR/hello.txt")
		# strip a single trailing newline for comparison
		content="${content%$'\n'}"
		if [ "$content" != "hello world" ]; then
			pass=0
			reasons="${reasons}hello.txt content='$content'; "
		fi
	fi
	# 2. largest file (article.md) was read by some tool
	if ! grep -q 'article.md' "$sess" 2>/dev/null; then
		pass=0
		reasons="${reasons}article.md not referenced; "
	fi
	# 3. a directory listing happened (ls/ctx_ls/find) or files enumerated
	if ! grep -Eqi 'ctx_ls|"ls"|ctx_find|ctx_shell|ctx_batch_execute' "$sess" 2>/dev/null; then
		pass=0
		reasons="${reasons}no listing tool call; "
	fi
	# 4. no crash markers
	if grep -Eqi 'unhandled|panic|fatal error|cannot read properties' "$sess" 2>/dev/null; then
		pass=0
		reasons="${reasons}error markers in session; "
	fi
	printf '%s|%s' "$pass" "$reasons"
}

# ---- run the bench RUNS times, collect totals ----
declare -a totals
all_ok=1
for i in $(seq 1 "$RUNS"); do
	setup_workspace
	marker=$(mktemp)
	(cd "$BENCH_DIR" && timeout 180 pi -p "$PROMPT") >/tmp/pi-bench-stdout.$$.log 2>&1
	rc=$?
	rm -f /tmp/pi-bench-stdout.$$.log
	sess=$(find_session "$marker")
	rm -f "$marker"
	if [ -z "$sess" ]; then
		echo "RUN $i: no session jsonl found (rc=$rc)" >&2
		all_ok=0
		continue
	fi
	m=$(compute_metric "$sess")
	total=$(printf '%s' "$m" | jq -r '.total // "null"')
	reqs=$(printf '%s' "$m" | jq -r '.requests // 0')
	chk=$(run_checks "$sess")
	cpass="${chk%%|*}"
	creasons="${chk#*|}"
	echo "RUN $i: totalInputTokens=$total requests=$reqs checks_pass=$cpass [$creasons] rc=$rc" >&2
	if [ "$cpass" != "1" ]; then all_ok=0; fi
	if [ "$total" != "null" ]; then totals+=("$total"); fi
done

# ---- median ----
if [ ${#totals[@]} -eq 0 ]; then
	echo "METRIC totalInputTokens=0"
	echo "METRIC checks_pass=0"
	echo "METRIC runs_completed=0"
	exit 1
fi
median=$(printf '%s\n' "${totals[@]}" | sort -n | awk '{a[NR]=$1} END {if(NR%2==1) print a[(NR+1)/2]; else print (a[NR/2]+a[NR/2+1])/2}')
echo "METRIC totalInputTokens=$median"
echo "METRIC checks_pass=$all_ok"
echo "METRIC runs_completed=${#totals[@]}"
echo "METRIC run_totals=$(
	IFS=,
	echo "${totals[*]}"
)"
