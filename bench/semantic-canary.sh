#!/usr/bin/env bash
# Semantic canary: skill frontmatter + ctx canaries must stay meaningful.
# Optional efficiency: pass session JSONL as $1 or set CE_SESSION_JSONL.
# Exit non-zero on hard failure.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_HOME="${PI_AGENT_HOME:-$HOME/.pi/agent}"
FAIL=0

echo "== skill frontmatter =="
for skill in ce-lite harness-doctor; do
  f="$ROOT/bundled-skills/$skill/SKILL.md"
  if [[ ! -f "$f" ]]; then
    echo "MISSING $f"; FAIL=1; continue
  fi
  # description must exist and be > 20 chars (maxDescChars=20 KEEP floor)
  desc=$(awk '/^description:/{print; exit}' "$f" | sed 's/^description:[[:space:]]*//; s/^["'\'']//; s/["'\'']$//')
  if [[ ${#desc} -lt 20 ]]; then
    echo "FAIL $skill description too short (${#desc}): $desc"
    FAIL=1
  else
    echo "OK $skill description len=${#desc}"
  fi
done

echo "== ce-lite-preload H4 + heuristics =="
PRE_EXT="$ROOT/extensions/ce-lite-preload.ts"
TEST_JS="$ROOT/bench/test-ce-lite-preload.mjs"
if [[ ! -f "$PRE_EXT" ]]; then
  echo "FAIL missing $PRE_EXT"
  FAIL=1
elif [[ -f "$TEST_JS" ]] && command -v node >/dev/null 2>&1; then
  if ! node "$TEST_JS"; then
    echo "FAIL ce-lite-preload unit test"
    FAIL=1
  fi
else
  # Minimal static checks without node test file
  if grep -q 'systemPrompt\s*:' "$PRE_EXT"; then
    echo "FAIL ce-lite-preload must not mutate systemPrompt (H4)"
    FAIL=1
  elif ! grep -q 'customType: "ce-lite-preload"' "$PRE_EXT"; then
    echo "FAIL ce-lite-preload missing custom message injection"
    FAIL=1
  else
    echo "OK ce-lite-preload static H4 checks"
  fi
fi

echo "== ce-lite-shield =="
SHIELD_TEST="$ROOT/extensions/test-ce-lite-shield.mjs"
if [[ -f "$SHIELD_TEST" ]] && command -v node >/dev/null 2>&1; then
  if ! node "$SHIELD_TEST"; then
    echo "FAIL ce-lite-shield unit test"
    FAIL=1
  fi
else
  echo "SKIP ce-lite-shield (no node or test file)"
fi

echo "== ctx canaries (if present) =="
if [[ -x "$ROOT/scripts/ctx-canaries.sh" ]]; then
  if ! "$ROOT/scripts/ctx-canaries.sh"; then
    echo "FAIL ctx-canaries"
    FAIL=1
  fi
elif [[ -x "$AGENT_HOME/scripts/ctx-canaries.sh" ]]; then
  if ! "$AGENT_HOME/scripts/ctx-canaries.sh"; then
    echo "FAIL ctx-canaries (agent home)"
    FAIL=1
  fi
else
  echo "SKIP no ctx-canaries.sh"
fi

echo "== trajectory efficiency (optional) =="
SESSION_JSONL="${1:-${CE_SESSION_JSONL:-}}"
TM="$ROOT/bundled-skills/harness-doctor/scripts/trajectory_metrics.py"
if [[ -n "$SESSION_JSONL" && -f "$SESSION_JSONL" && -f "$TM" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    echo "session: $SESSION_JSONL"
    python3 "$TM" "$SESSION_JSONL" || true
    python3 - "$SESSION_JSONL" <<'PY' || true
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
turns = tools = errs = retries = 0
prev_err = False
for line in p.read_text(errors="replace").splitlines():
    line = line.strip()
    if not line:
        continue
    try:
        o = json.loads(line)
    except Exception:
        continue
    t = o.get("type") or o.get("role") or ""
    if t in ("assistant", "message") or o.get("role") == "assistant":
        turns += 1
    if "tool" in str(t).lower() or o.get("toolName") or o.get("name"):
        tools += 1
    body = json.dumps(o).lower()
    is_err = "error" in body and ("tool" in body or "fail" in body)
    if is_err:
        errs += 1
        if prev_err:
            retries += 1
        prev_err = True
    else:
        prev_err = False
print(
    f"efficiency: assistant_turns≈{turns} toolish_events≈{tools} "
    f"errorish≈{errs} retryish≈{retries}"
)
print("note: soft signal only — binary canary gates are skill/ctx checks above")
PY
  else
    echo "SKIP efficiency (no python3)"
  fi
else
  echo "SKIP efficiency (set CE_SESSION_JSONL or pass session jsonl as \$1)"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "semantic-canary: FAIL"
  exit 1
fi
echo "semantic-canary: PASS"
