#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${PROBE_MODEL:-Lilac/zai-org/glm-5.2}"
PORT="${PI_BENCH_PORT:-4599}"
LABEL="semantic-$(date +%s)-$$"
export PI_BENCH_PORT="$PORT" PI_BENCH_LABEL="$LABEL" PI_BENCH_CAPTURE_DIR="${PI_BENCH_CAPTURE_DIR:-$ROOT/.scratch/captures}"
bash "$ROOT/bench/proxy.sh" ensure
VAGENT=$(bash "$ROOT/bench/build-variant.sh")
VHOME=$(cd "$VAGENT/../.." && pwd)
WD=$(mktemp -d "${TMPDIR:-/tmp}/pi-semantic.XXXXXX")
SESS="$VAGENT/sessions"
printf 'alpha needle omega\n' > "$WD/source.txt"

run_case() {
  local name=$1 prompt=$2
  local marker; marker=$(mktemp)
  set +e
  (cd "$WD" && HOME="$VHOME" PI_CODING_AGENT_DIR="$VAGENT" PI_CODING_AGENT_SESSION_DIR="$SESS" timeout 150 pi -p "$prompt" --model "$MODEL") >"$WD/$name.out" 2>&1
  local rc=$?
  set -e
  [[ "$rc" -eq 0 ]] || { echo "FAIL $name rc=$rc" >&2; return 1; }
  mapfile -t files < <(find "$SESS" -name '*.jsonl' -type f -newer "$marker")
  rm -f "$marker"
  [[ "${#files[@]}" -eq 1 ]] || { echo "FAIL $name session-count=${#files[@]}" >&2; return 1; }
  printf '%s\n' "${files[0]}"
}

read_session=$(run_case read 'Read source.txt and reply with exactly its contents.')
grep -Eq 'ctx_read|ctx_execute_file' "$read_session"
grep -q 'alpha needle omega' "$WD/read.out"

search_session=$(run_case search 'Find the file containing the exact word needle. Do not edit files. Reply with the path only.')
grep -Eq 'ctx_grep|ctx_search|ctx_find|ctx_shell' "$search_session"
grep -q 'source.txt' "$WD/search.out"

edit_session=$(run_case edit 'Change only the word omega to delta in source.txt, verify it, then reply exactly: DONE.')
grep -Eq 'ctx_edit|"name":"edit"|"name": "edit"' "$edit_session"
grep -q 'alpha needle delta' "$WD/source.txt"

if grep -RqiE 'invest_|last30days_|ctx_(stats|doctor|upgrade|purge|insight)' "$SESS"; then
  echo "FAIL forbidden tool surfaced" >&2; exit 1
fi
echo "SEMANTIC_CANARY pass model=$MODEL cases=3"
rm -rf "$WD" "$VHOME"
