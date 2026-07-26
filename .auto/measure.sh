#!/bin/bash
# Autoresearch measure script — Pi prompt-quality (task-sharpening).
#
# v3 HARDER suite: each vague prompt requires inferring MORE behaviors / fields,
# so under-scoping is more likely to surface a real vague-prompt gap. Verifiers
# remain spec-based hidden input->expected-output (no implementation-shape, no
# LLM judge). The rule under test (.auto/rule.md) is held GENERAL — never tuned
# to task names/fixtures (anti-overfit). Thinking held constant (low).
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

# --- bug2 : two money functions, both noisy -> round both to 2dp, tax from percent ---
setup_bug() {
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/cart.py" <<'PY'
def total(prices):
    return sum(prices)

def tax(amount, rate):
    return amount * rate
PY
}
PROMPT_bug="Fix the money functions in cart.py — customers see ugly long decimals on totals and the tax looks wrong."
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
# tax: rate is a PERCENT (8.5 means 8.5%), rounded to cents, clean
assert abs(m.tax(100,8.5)-8.5)<1e-9, m.tax(100,8.5)
assert abs(m.tax(19.99,10)-2.0)<1e-9, m.tax(19.99,10)
assert clean(m.tax(19.99,10)), m.tax(19.99,10)
assert m.tax(0,7)==0
print("ok")
PY
  ) >/dev/null 2>&1
}

# --- parse2 : robust for real config files (comments, blanks, ws, '=' in value, inline comments) ---
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
assert p("conn=host=db&port=5432")=={"conn":"host=db&port=5432"}, "= in value (split first =)"
assert p("host=localhost # default")=={"host":"localhost"}, "inline comment"
assert p("  k  =  v  ")=={"k":"v"}
print("ok")
PY
  ) >/dev/null 2>&1
}

# --- stats2 : useful summary -> count,min,max,mean,median, empty-safe ---
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
assert g("median")==2.5, g("median")    # extra field: median of [1,2,3,4] = 2.5
r2=s([1,2,3]); assert hasattr(r2,"__getitem__") and r2["median"]==2, r2   # median of [1,2,3]=2
s([])  # must not crash
print("ok")
PY
  ) >/dev/null 2>&1
}

# --- validate2 : 4 fields with varied rules (more under-scope surface) ---
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
assert o("widget",1,"a@b.com","US")["ok"] is True, "valid rejected"
# item: non-empty string
assert o("",1,"a@b.com","US")["ok"] is False
assert o(None,1,"a@b.com","US")["ok"] is False
# qty: positive int (bool excluded)
assert o("w",0,"a@b.com","US")["ok"] is False
assert o("w",-1,"a@b.com","US")["ok"] is False
assert o("w","2","a@b.com","US")["ok"] is False
assert o("w",True,"a@b.com","US")["ok"] is False
# email: contains @
assert o("w",1,"noat","US")["ok"] is False
# country: exactly 2 letters
assert o("w",1,"a@b.com","USA")["ok"] is False, "3-letter country accepted"
assert o("w",1,"a@b.com","us")["ok"] is True, "lowercase 2-letter rejected?"
assert o("w",1,"a@b.com","")["ok"] is False, "empty country accepted"
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
