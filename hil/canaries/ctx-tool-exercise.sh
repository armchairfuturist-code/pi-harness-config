#!/usr/bin/env bash
# ctx-tool canary (HIL Iter 8 OPEN): prove the context-mode read/index/search
# tool family actually works in a variant home end-to-end.
#
# Runs `pi -p` through the capture proxy with a brief that forces one call per
# tool, then validates the capture shows all six invocations.
#
# Usage: bash hil/canaries/ctx-tool-exercise.sh
# Env:   PI_BENCH_LABEL (default: canary-ctx-tools)
#        PROBE_MODEL    (default: Lilac/zai-org/glm-5.2, same as probe.sh)
#
# Exit 0 = PASS, 1 = FAIL (tools missing / pi run failed), 2 = infra error.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODEL="${PROBE_MODEL:-Lilac/zai-org/glm-5.2}"
PORT="${PI_BENCH_PORT:-4599}"
LABEL="${PI_BENCH_LABEL:-canary-ctx-tools}"
CAPTURE_ROOT="${PI_BENCH_CAPTURE_DIR:-$ROOT/.scratch/captures}"
export PI_BENCH_PORT="$PORT" PI_BENCH_LABEL="$LABEL" PI_BENCH_CAPTURE_DIR="$CAPTURE_ROOT"

bash "$ROOT/bench/proxy.sh" ensure
WD=$(mktemp -d "${TMPDIR:-/tmp}/ctx-canary-ws.XXXXXX")
VAGENT="" VHOME=""
cleanup() {
  bash "$ROOT/bench/proxy.sh" stop >/dev/null 2>&1 || true
  rm -rf "$WD" ${VHOME:+"$VHOME"}
}
trap cleanup EXIT

VAGENT=$(bash "$ROOT/bench/build-variant.sh")
VHOME=$(cd "$VAGENT/../.." && pwd)
SESS="$VAGENT/sessions"

# Agent-facing prompt (operator-facing notes live in ctx-tool-exercise.md).
PROMPT='You are a canary for context-mode tools. Work against the existing directory /home/alex/pi-bench-ws (do not invent other paths). Perform exactly these steps, one tool call each:
1. ctx_ls: list /home/alex/pi-bench-ws
2. ctx_find: find *.txt files under /home/alex/pi-bench-ws
3. ctx_read: read one file found in /home/alex/pi-bench-ws
4. ctx_grep: search /home/alex/pi-bench-ws for the pattern bench
5. ctx_index: index the /home/alex/pi-bench-ws directory
6. ctx_search: search the index for benchmark
After step 6 reply with exactly: CANARY ctx-tools done'

echo "[ctx-canary] running pi -p via proxy (label=$LABEL model=$MODEL)..."
set +e
(cd "$WD" && HOME="$VHOME" PI_CODING_AGENT_DIR="$VAGENT" PI_CODING_AGENT_SESSION_DIR="$SESS" \
  PI_RUNTIME_DISCIPLINE_DISABLED=1 PI_COMPACT_CONTEXT_DISABLED=1 \
  PI_MODEL_CONTEXT_PRUNER_DISABLED=1 PI_AGENT_CONTEXT_PRUNER_DISABLED=1 \
  timeout 600 pi -p "$PROMPT" --model "$MODEL" \
  >"$ROOT/.scratch/ctx-canary-last.out" 2>"$ROOT/.scratch/ctx-canary-last.err")
rc=$?
set -e
if [[ $rc -ne 0 ]]; then
  echo "[ctx-canary] pi run failed rc=$rc; stderr tail:" >&2
  tail -10 "$ROOT/.scratch/ctx-canary-last.err" >&2 || true
  exit 1
fi

CAPDIR="$CAPTURE_ROOT/$LABEL"
if [[ ! -d "$CAPDIR" ]]; then
  echo "[ctx-canary] no capture dir at $CAPDIR" >&2
  exit 2
fi

node "$ROOT/bench/validate-ctx-canary.mjs" "$CAPDIR"
