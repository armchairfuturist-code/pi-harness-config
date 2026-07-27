#!/bin/bash
# Workload measure for an ALTERNATE agent dir (same workload + correctness
# checks as measure.sh). Usage: ./bench/measure-variant.sh <agent-dir> [RUNS]
set -uo pipefail
AGENT_DIR="$(cd "$1" && pwd)"
RUNS="${2:-1}"
MODEL="${PROBE_MODEL:-Lilac/zai-org/glm-5.2}"
BENCH_DIR="/tmp/pi-measure-variant-ws"
SESS="$AGENT_DIR/sessions"
mkdir -p "$SESS"

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
a font. The earliest known English pangram was published in 1885.
## Conclusion
Pangrams remind us that language is a playground.
MD
  printf '{"name":"bench","version":"1.0.0"}\n' >"$BENCH_DIR/data.json"
  printf 'TODO: buy groceries\nTODO: call mom\n' >"$BENCH_DIR/notes.txt"
  printf 'def greet(name):\n    return f"hello {name}"\n' >"$BENCH_DIR/script.py"
}

PROMPT='List all files in the current directory. Then identify the largest file by size, read it, and summarize its contents in one sentence. Finally, create a new file named hello.txt with the exact content: hello world'

declare -a totals
all_ok=1
for i in $(seq 1 "$RUNS"); do
  setup_workspace
  marker=$(mktemp)
  (cd "$BENCH_DIR" && PI_CODING_AGENT_DIR="$AGENT_DIR" PI_CODING_AGENT_SESSION_DIR="$SESS" \
    timeout 180 pi -p "$PROMPT" --model "$MODEL") >/tmp/pi-measure-variant.out 2>&1
  rc=$?
  sess=""
  best_ts=0
  while IFS= read -r cand; do
    [ "$cand" -nt "$marker" ] || continue
    ts=$(stat -c %Y "$cand" 2>/dev/null || echo 0)
    [ "$ts" -gt "$best_ts" ] && { sess="$cand"; best_ts=$ts; }
  done < <(find "$SESS" -name '*.jsonl' -type f 2>/dev/null)
  rm -f "$marker"
  if [ -z "$sess" ]; then echo "RUN $i: no session (rc=$rc)"; tail -3 /tmp/pi-measure-variant.out; all_ok=0; continue; fi
  total=$(jq -s '[.[] | select(.message.usage) | (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))] | add' "$sess")
  pass=1; reasons=""
  if [ ! -f "$BENCH_DIR/hello.txt" ]; then pass=0; reasons="${reasons}hello.txt missing; "
  else content=$(cat "$BENCH_DIR/hello.txt"); content="${content%$'\n'}"
    [ "$content" != "hello world" ] && { pass=0; reasons="${reasons}hello.txt content='$content'; "; }
  fi
  grep -q 'article.md' "$sess" 2>/dev/null || { pass=0; reasons="${reasons}article.md not read; "; }
  grep -Eqi 'ctx_ls|"ls"|ctx_find|ctx_shell|ctx_batch_execute|ls ' "$sess" 2>/dev/null || { pass=0; reasons="${reasons}no listing; "; }
  grep -Eqi 'unhandled|panic|fatal error|cannot read properties' "$sess" 2>/dev/null && { pass=0; reasons="${reasons}error markers; "; }
  echo "RUN $i: totalInputTokens=$total checks_pass=$pass [$reasons]"
  [ "$pass" != "1" ] && all_ok=0
  totals+=("$total")
done
rm -f /tmp/pi-measure-variant.out
echo "METRIC checks_pass=$all_ok"
echo "METRIC run_totals=$(IFS=,; echo "${totals[*]}")"
