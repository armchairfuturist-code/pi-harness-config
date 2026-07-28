#!/bin/bash
# Autoresearch measure script — Pi prompt-quality (task-sharpening).
#
# v4 SCOPING-FOCUSED suite: verifiers accept ANY valid rejection contract (raise
# OR return a falsy ok) and drop over-specified requirements (tax-as-percent,
# median) that tested AMBIGUITY, not scoping. This isolates the question the
# sharpening rule can actually address: does the model handle ALL the behaviors,
# or under-scope? Fair to both arms (baseline + rule) equally. Anti-overfit:
# rule.md stays GENERAL (no task names); verifiers test behavior specs only.
#
# Empty rule.md => no --append-system-prompt (true no-rule baseline).
# Usage: ./.auto/measure.sh [RUNS]   (RUNS default 2)
set -uo pipefail
RUNS="${1:-2}"
THINKING="${THINKING:-low}"
PI_BIN="pi"
SESSIONS_ROOT="/home/alex/.pi/agent/sessions"
BENCH_ROOT="/home/alex/pi-pq-bench"
RULE_FILE="$(cd "$(dirname "$0")" && pwd)/rule.md"

RULE_ARGS=()
RULE_CHARS=0
if [ -s "$RULE_FILE" ]; then
  RULE_ARGS=(--append-system-prompt "$RULE_FILE")
  RULE_CHARS=$(wc -c < "$RULE_FILE")
fi
RULE_TOKENS=$(( RULE_CHARS / 4 ))

# --- bug : BOTH money functions must be rounded to 2dp (scoping: fix both) ---
setup_bug() {
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/cart.py" <<'PY'
def total(prices):
    return sum(prices)

def tax(amount, rate):
    return amount * rate
PY
}
PROMPT_bug="Fix the money functions in cart.py — customers see ugly long decimals on both the totals and the tax."
verify_bug() {
  (cd "$1" && timeout 20 python3 - <<'PY'
import importlib.util
spec=importlib.util.spec_from_file_location("cart","cart.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
def clean(x): return round(x,2)==x
# total: correct + clean on float traps
assert abs(m.total([19.99,5.49,3.50])-28.98)<1e-9, m.total([19.99,5.49,3.50])
assert m.total([])==0
assert clean(m.total([0.1,0.2,0.3])), m.total([0.1,0.2,0.3])
assert clean(m.total([0.1]*3)), m.total([0.1]*3)
# tax: must ALSO be clean (2dp) — scoping check that BOTH functions were fixed
assert clean(m.tax(19.99,0.085)), m.tax(19.99,0.085)
assert clean(m.tax(100,0.085)), m.tax(100,0.085)
assert m.tax(0,0.07)==0
print("ok")
PY
  ) >/dev/null 2>&1
}

# --- parse : robust for real config files (comments, blanks, ws, = in value, inline comments) ---
setup_parse() {
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/config.py" <<'PY'
def parse(text):
    d = {}
    for line in text.split("\n"):
        k, v = line.split("=")
        d[k] = v
    return d
PY
}
PROMPT_parse="Make the config parser robust enough for real config files."
verify_parse() {
  (cd "$1" && timeout 20 python3 - <<'PY'
import importlib.util
spec=importlib.util.spec_from_file_location("config","config.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
p=m.parse
assert p("a=1\nb=2")=={"a":"1","b":"2"}
assert p("a = 1\n# c\n\nb=2 ")=={"a":"1","b":"2"}, "ws/comment/blank"
assert p("")=={}
assert p("# only\n")=={}
assert p("conn=host=db&port=5432")=={"conn":"host=db&port=5432"}, "= in value"
assert p("host=localhost # default")=={"host":"localhost"}, "inline comment"
assert p("  k  =  v  ")=={"k":"v"}
print("ok")
PY
  ) >/dev/null 2>&1
}

# --- stats : useful summary -> count,min,max,mean, empty-safe (canonical core) ---
setup_stats() {
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/stats.py" <<'PY'
def summarize(numbers):
    return sum(numbers)
PY
}
PROMPT_stats="Improve the summarize function to give a useful summary of a list of numbers."
verify_stats() {
  (cd "$1" && timeout 20 python3 - <<'PY'
import importlib.util
spec=importlib.util.spec_from_file_location("stats","stats.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
s=m.summarize
r=s([1,2,3,4])
assert hasattr(r,"__getitem__"), r
def g(k):
    try: return r[k]
    except Exception: return None
assert g("count")==4 and g("min")==1 and g("max")==4, dict(r) if hasattr(r,'items') else r
assert g("mean")==2.5, g("mean")
s([])  # must not crash
print("ok")
PY
  ) >/dev/null 2>&1
}

# --- validate : 4 fields; invalid rejected via RAISE or falsy ok (either contract) ---
setup_validate() {
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/order.py" <<'PY'
def place_order(item, qty, email, country):
    return {"ok": True}
PY
}
PROMPT_validate="Add validation to the place_order function in order.py."
verify_validate() {
  (cd "$1" && timeout 20 python3 - <<'PY'
import importlib.util
spec=importlib.util.spec_from_file_location("order","order.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
o=m.place_order
def rejected(*a):  # invalid iff it raises OR returns a falsy/non-True ok
    try:
        r=o(*a)
    except Exception:
        return True
    if isinstance(r,dict): return not r.get("ok",False)
    return not r
def accepted(*a):  # valid iff no raise AND truthy ok
    try:
        r=o(*a)
    except Exception:
        return False
    if isinstance(r,dict): return bool(r.get("ok",False))
    return bool(r)
assert accepted("widget",1,"a@b.com","US"), "valid rejected"
assert rejected("",1,"a@b.com","US"), "empty item accepted"
assert rejected(None,1,"a@b.com","US"), "None item accepted"
assert rejected("w",0,"a@b.com","US"), "qty 0 accepted"
assert rejected("w",-1,"a@b.com","US"), "neg qty accepted"
assert rejected("w","2","a@b.com","US"), "non-int qty accepted"
assert rejected("w",1,"noat","US"), "bad email accepted"
assert rejected("w",1,"a@b.com","USA"), "3-letter country accepted"
assert rejected("w",1,"a@b.com",""), "empty country accepted"
print("ok")
PY
  ) >/dev/null 2>&1
}

TASKS=(bug parse stats validate)

if [ "${BASH_SOURCE[0]:-$0}" != "$0" ]; then return 0 2>/dev/null || true; fi

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

tok_total() {
  jq -s '[.[] | select(.message.usage)
          | (.message.usage.input + (.message.usage.cacheRead//0) + (.message.usage.cacheWrite//0))]
         | add // 0' "$1" 2>/dev/null
}

passed=0; trials=0; tok_sum=0
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
    if [ -z "$sess" ]; then echo "  [$task r$r] no session (rc=$rc)" >&2; continue; fi
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
