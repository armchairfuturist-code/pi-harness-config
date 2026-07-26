#!/bin/bash
# Autoresearch measure script — Pi prompt-quality (task-sharpening).
#
# Runs headless `pi -p` on a fixed suite of deliberately VAGUE coding tasks
# with `.auto/rule.md` injected via --append-system-prompt, then scores each
# trial with a strict objective verifier (hidden input→expected-output batteries
# — no LLM judge, no implementation-shape checks, so no lenient-judge cheating
# and no way for a rule to "win" by naming things). Reports pass count + tokens.
#
# Empty rule.md => no --append-system-prompt (true no-rule baseline).
#
# Fairness / anti-overfit design:
#  - Verifiers test BEHAVIOR SPECIFICATIONS only (input→output), never call
#    shape, file names, or function names. A rule cannot game them.
#  - Tasks are vague the way real requests are vague (subjective adjectives:
#    "fix", "robust", "useful summary", "validate") with a CONVERGENT correct
#    interpretation any careful spec-writer would reach — not contrived gotchas.
#  - Thinking level held constant (low) across all arms; only rule.md varies.
#
# Usage: ./.auto/measure.sh [RUNS]   (RUNS default 2)
set -uo pipefail
RUNS="${1:-2}"
THINKING="${THINKING:-low}"   # constant; low models the cost-conscious case where Pi's thinness hurts most
PI_BIN="pi"
SESSIONS_ROOT="/home/alex/.pi/agent/sessions"
BENCH_ROOT="/home/alex/pi-pq-bench"
RULE_FILE="$(cd "$(dirname "$0")" && pwd)/rule.md"

# Inject the rule only if non-empty (baseline = no injection).
RULE_ARGS=()
RULE_CHARS=0
if [ -s "$RULE_FILE" ]; then
  RULE_ARGS=(--append-system-prompt "$RULE_FILE")
  RULE_CHARS=$(wc -c < "$RULE_FILE")
fi
RULE_TOKENS=$(( RULE_CHARS / 4 ))

# ============ TASK SUITE (harder, fair, spec-verified) ============
# Each: setup_<task> recreates a deterministic fixture; PROMPT_<task> is the
# vague request; verify_<task> runs a hidden behavior battery (pass/fail).

# --- A. bug : vague bug report -> currency-2dp fix ---
setup_bug() {
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/cart.py" <<'PY'
def total(prices):
    return sum(prices)
PY
}
PROMPT_bug="Customers report the order total sometimes shows long ugly decimals. Fix the total function in cart.py."
verify_bug() {
  (cd "$1" && timeout 20 python3 - <<'PY'
import importlib.util
spec=importlib.util.spec_from_file_location("cart","cart.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
t=m.total
def is_clean(x): return round(x,2)==x   # no float noise beyond 2 decimals
assert abs(t([19.99,5.49,3.50])-28.98)<1e-9, t([19.99,5.49,3.50])
assert t([])==0
assert t([10,20])==30
assert is_clean(t([19.99,5.49,3.50])), t([19.99,5.49,3.50])
assert is_clean(t([0.1,0.2,0.3])), t([0.1,0.2,0.3])
assert is_clean(t([0.1]*3)), t([0.1]*3)
print("ok")
PY
  ) >/dev/null 2>&1
}

# --- B. parse : "make it robust" -> handle comments/blanks/whitespace ---
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
PROMPT_parse="Make the config parser robust — it shouldn't crash on normal config files."
verify_parse() {
  (cd "$1" && timeout 20 python3 - <<'PY'
import importlib.util
spec=importlib.util.spec_from_file_location("config","config.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
p=m.parse
assert p("a=1\nb=2")=={"a":"1","b":"2"}, p("a=1\nb=2")
assert p("a = 1\n# comment\n\nb=2 ")=={"a":"1","b":"2"}, "comments/blanks/whitespace"
assert p("")=={}, "empty"
assert p("# only comment\n")=={}, "only comment"
assert p("  key  =  val  ")=={"key":"val"}, "outer whitespace"
assert p("a=1\na=2")=={"a":"2"}, "last wins (or both fine) — just must not crash"
print("ok")
PY
  ) >/dev/null 2>&1
}

# --- C. stats : "useful summary" -> canonical summary stats ---
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
# must be a mapping (dict-like) with canonical fields
assert hasattr(r,"__getitem__"), f"not a mapping: {r!r}"
def get(k):
    try: return r[k]
    except Exception: return None
assert get("mean")==2.5, f"mean wrong: {dict(r) if hasattr(r,'items') else r}"
assert get("max")==4, f"max wrong: {r}"
assert get("min")==1, f"min wrong: {r}"
assert get("count")==4, f"count wrong: {r}"
# empty list must not crash
s([])
print("ok")
PY
  ) >/dev/null 2>&1
}

# --- D. validate : "add validation" -> all 3 fields, each with sensible rules ---
setup_validate() {
  local d="$1"; rm -rf "$d"; mkdir -p "$d"
  cat >"$d/order.py" <<'PY'
def place_order(item, qty, email):
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
assert o("widget",1,"a@b.com")["ok"] is True, "valid rejected"
assert o("widget",0,"a@b.com")["ok"] is False, "qty 0 accepted"
assert o("widget",-1,"a@b.com")["ok"] is False, "neg qty accepted"
assert o("widget","two","a@b.com")["ok"] is False, "non-int qty accepted"
assert o("widget",1,"noatsign")["ok"] is False, "bad email accepted"
assert o("",1,"a@b.com")["ok"] is False, "empty item accepted"
assert o(None,1,"a@b.com")["ok"] is False, "None item accepted"
print("ok")
PY
  ) >/dev/null 2>&1
}

TASKS=(bug parse stats validate)

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
