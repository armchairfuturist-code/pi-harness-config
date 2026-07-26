#!/bin/bash
# Autoresearch measure script — Pi prompt-quality (task-sharpening).
#
# Runs headless `pi -p` on a fixed suite of deliberately VAGUE coding tasks
# with `.auto/rule.md` injected via --append-system-prompt, then scores each
# trial with a strict objective verifier (stdlib asserts / exit codes — no LLM
# judge, so no lenient-judge cheating). Reports pass count + token cost.
#
# Empty rule.md  => no --append-system-prompt (true no-rule baseline).
#
# Usage: ./.auto/measure.sh [RUNS]   (RUNS default 2)
set -uo pipefail
RUNS="${1:-2}"
THINKING="${THINKING:-low}"   # constant; low models the cost-conscious case where Pi's thinness hurts most
PI_BIN="pi"
SESSIONS_ROOT="/home/alex/.pi/agent/sessions"
BENCH_ROOT="/home/alex/pi-pq-bench"
RULE_FILE="$(cd "$(dirname "$0")" && pwd)/rule.md"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Inject the rule only if non-empty (baseline = no injection).
RULE_ARGS=()
RULE_CHARS=0
if [ -s "$RULE_FILE" ]; then
  RULE_ARGS=(--append-system-prompt "$RULE_FILE")
  RULE_CHARS=$(wc -c < "$RULE_FILE")
fi
RULE_TOKENS=$(( RULE_CHARS / 4 ))

# ---- task definitions: setup (recreate fixture) + vague prompt + verify ----

setup_validate() { # "add validation" — underspecified fields/rules/edges
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/form.py" <<'PY'
def submit(email, age):
    return {"ok": True}
PY
}
PROMPT_validate="Add validation to the submit function in this project."
verify_validate() { # pass iff email-format + non-negative int age both enforced
  (cd "$1" && timeout 20 python3 - <<'PY'
import importlib.util
spec=importlib.util.spec_from_file_location("form","form.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
s=m.submit
assert s("a@b.com",30)["ok"] is True, "valid rejected"
assert s("x",30)["ok"] is False, "bad email accepted"
assert s("a@b.com",-1)["ok"] is False, "negative age accepted"
assert s("a@b.com","thirty")["ok"] is False, "non-int age accepted"
print("ok")
PY
  ) >/dev/null 2>&1
}

setup_faster() { # "make it faster" — underspecified: order? how fast? big input?
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/dedup.py" <<'PY'
def unique(items):
    result = []
    for x in items:
        if x not in result:
            result.append(x)
    return result
PY
}
PROMPT_faster="Make the unique function faster, but don't change what it returns."
verify_faster() { # pass iff order-preserving + output correct + runs fast on big input
  (cd "$1" && timeout 12 python3 - <<'PY'
import importlib.util, time
spec=importlib.util.spec_from_file_location("dedup","dedup.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
big=list(range(150000))+list(range(150000))
t=time.time(); r=m.unique(big); dt=time.time()-t
assert dt < 6.0, f"too slow: {dt:.1f}s"
assert r==list(range(150000)), "wrong output or order"
print("ok")
PY
  ) >/dev/null 2>&1
}

setup_cli() { # "add a CLI" — underspecified: entry point, args, missing-file edge
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/words.py" <<'PY'
def count_words(text):
    return len(text.split())
PY
}
PROMPT_cli="Add a command-line interface to this project so I can run it on a file and see the word count."
verify_cli() { # pass iff entry prints exactly the count for a file AND handles missing file
  local d="$1"
  printf 'one two three four\n' >"$d/sample.txt"
  local entry=""
  if [ -f "$d/cli.py" ]; then entry="cli.py"
  elif [ -f "$d/words.py" ]; then entry="words.py"
  else return 1; fi
  local out digits
  out=$(cd "$d" && timeout 20 python3 "$entry" sample.txt 2>/dev/null) || return 1
  digits=$(printf '%s' "$out" | tr -cd 0-9)
  [ "$digits" = "4" ] || return 1
  # missing file must not succeed silently (nonzero exit = handled)
  (cd "$d" && timeout 20 python3 "$entry" nope.txt) >/dev/null 2>&1
  [ $? -ne 0 ] || return 1
  return 0
}

setup_errors() { # "handle errors better" — underspecified: which errors, exit vs msg
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/fetch.py" <<'PY'
import sys
def read(path):
    f = open(path)
    return f.read()

if __name__ == "__main__":
    print(read(sys.argv[1]))
PY
}
PROMPT_errors="This script crashes on bad input. Handle errors better."
verify_errors() { # pass iff good input prints content AND missing input is graceful (no traceback)
  local d="$1"
  printf 'hello\n' >"$d/data.txt"
  local out clean
  out=$(cd "$d" && timeout 20 python3 fetch.py data.txt 2>/dev/null) || return 1
  clean=$(printf '%s' "$out" | tr -d '[:space:]')
  [ "$clean" = "hello" ] || return 1
  (cd "$d" && timeout 20 python3 fetch.py nope.txt) >"$d/o.txt" 2>"$d/e.txt" || true
  if grep -qi traceback "$d/e.txt" "$d/o.txt" 2>/dev/null; then return 1; fi
  return 0
}

TASKS=(validate faster cli errors)

# Only run the main loop when executed directly, not when sourced (offline
# verifier testing). Sourcing returns before the loop.
if [ "${BASH_SOURCE[0]:-$0}" != "$0" ]; then return 0 2>/dev/null || true; fi

# ---- session discovery (newest jsonl matching a cwd, newer than marker) ----
find_session() {
  local cwd="$1" marker="$2" best="" best_ts=0 cand ts c
  while IFS= read -r cand; do
    [ "$cand" -nt "$marker" ] || continue
    c=$(head -1 "$cand" | jq -r '.cwd // empty' 2>/dev/null)
    [ "$c" = "$cwd" ] || continue
    ts=$(stat -c %Y "$cand" 2>/dev/null || echo 0)
    if [ "$ts" -gt "$best_ts" ]; then best="$cand"; best_ts=$ts; fi
  done < <(find "$SESSIONS_ROOT" -name '*.jsonl' -type f 2>/dev/null)
  printf '%s' "$best"
}

tok_total() { # sum input+cacheRead+cacheWrite across usage lines
  jq -s '[.[] | select(.message.usage)
          | (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))]
         | add // 0' "$1" 2>/dev/null
}

# ---- main loop ----
passed=0
trials=0
tok_sum=0
for task in "${TASKS[@]}"; do
  for r in $(seq 1 "$RUNS"); do
    taskdir="$BENCH_ROOT/$task"
    "setup_$task" "$taskdir"
    marker=$(mktemp)
    prompt="PROMPT_$task"; prompt="${!prompt}"
    ( cd "$taskdir" && timeout 150 "$PI_BIN" -p "$prompt" \
        --thinking "$THINKING" --no-prompt-templates \
        "${RULE_ARGS[@]}" ) >/tmp/pq-out.$$ 2>&1
    rc=$?
    sess=$(find_session "$taskdir" "$marker")
    rm -f "$marker" /tmp/pq-out.$$
    if [ -z "$sess" ]; then
      echo "  [$task r$r] no session (rc=$rc)" >&2
      continue
    fi
    trials=$((trials+1))
    t=$(tok_total "$sess" || echo 0)
    tok_sum=$((tok_sum + t))
    if "verify_$task" "$taskdir"; then
      passed=$((passed+1)); echo "  [$task r$r] PASS  tok=$t" >&2
    else
      echo "  [$task r$r] FAIL  tok=$t" >&2
    fi
  done
done

echo "METRIC tasks_passed=$passed"
echo "METRIC total_input_tokens=$tok_sum"
echo "METRIC rule_tokens=$RULE_TOKENS"
echo "METRIC trials=$trials"
echo "METRIC rule_chars=$RULE_CHARS"
