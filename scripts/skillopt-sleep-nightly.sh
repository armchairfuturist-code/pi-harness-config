#!/usr/bin/env bash
# skillopt-sleep-nightly.sh — validation-gated skill-optimization compound stage.
#
# Runs SkillOpt-Sleep over pi session transcripts to mine recurring tasks,
# replay them through the configured backend, and stage a bounded, held-out-
# gated proposal for a HUMAN to review and adopt. Never auto-adopts.
#
# Supersedes the retired poor-mans-distill skill (manual, keyword-classifier).
#
# Default (safe, zero provider cost): dry-run + mock backend — checks plumbing,
# stages nothing. To run a real optimization cycle (uses your pi provider via
# `pi -p`, stages a proposal for review): SKILLOPT_SLEEP_REAL=1
#
# Data boundary: a real backend sends truncated transcript-derived prompts to
# your provider. For sensitive projects prefer the reviewed tasks-file flow:
#   <py> -m skillopt_sleep harvest --source pi --output tasks.json
#   (review + redact, set "reviewed": true)
#   SKILLOPT_SLEEP_TASKS_FILE=tasks.json SKILLOPT_SLEEP_REAL=1 <this script>
#
# Env:
#   SKILLOPT_HOME            checkout dir (default ~/Projects/skillopt)
#   SKILLOPT_PY              python (default $SKILLOPT_HOME/.venv/bin/python)
#   PI_HOME                  ~/.pi root (default ~/.pi)
#   SKILLOPT_SLEEP_PROJECT   project/transcript scope (default $PI_HOME/agent)
#   SKILLOPT_SLEEP_REAL      1 = real run + pi backend (default 0 = dry-run+mock)
#   SKILLOPT_SLEEP_MAX_SESSIONS   cap harvested sessions (default 300)
#   SKILLOPT_SLEEP_MAX_TASKS      cap mined tasks (default 80)
#   SKILLOPT_SLEEP_TASKS_FILE     reviewed tasks file (replaces harvesting)
set -euo pipefail

SKILLOPT_HOME="${SKILLOPT_HOME:-$HOME/Projects/skillopt}"
PY="${SKILLOPT_PY:-$SKILLOPT_HOME/.venv/bin/python}"
PI_HOME="${PI_HOME:-$HOME/.pi}"
AGENT_HOME="$PI_HOME/agent"
PROJECT="${SKILLOPT_SLEEP_PROJECT:-$AGENT_HOME}"
REAL="${SKILLOPT_SLEEP_REAL:-0}"
MAX_SESSIONS="${SKILLOPT_SLEEP_MAX_SESSIONS:-300}"
MAX_TASKS="${SKILLOPT_SLEEP_MAX_TASKS:-80}"
TASKS_FILE="${SKILLOPT_SLEEP_TASKS_FILE:-}"
TARGETS=(
  "$AGENT_HOME/skills/ce-lite/SKILL.md"
  "$AGENT_HOME/skills/smart-read/SKILL.md"
)

if [ ! -x "$PY" ]; then
  echo "[skillopt-sleep] missing $PY — set up with:" >&2
  echo "  cd $SKILLOPT_HOME && uv venv --python 3.12 .venv && uv pip install -e ." >&2
  exit 1
fi

MODE=dry-run
BACKEND=mock
if [ "$REAL" = "1" ]; then
  MODE=run
  BACKEND=pi
fi

base_args=(
  -m skillopt_sleep "$MODE"
  --source pi --pi-home "$PI_HOME"
  --project "$PROJECT"
  --backend "$BACKEND"
  --max-sessions "$MAX_SESSIONS" --max-tasks "$MAX_TASKS"
)
if [ -n "$TASKS_FILE" ]; then
  base_args+=(--tasks-file "$TASKS_FILE")
fi

for target in "${TARGETS[@]}"; do
  if [ ! -f "$target" ]; then
    echo "[skillopt-sleep] missing target $target — skipping" >&2
    continue
  fi
  echo "[skillopt-sleep] $MODE source=pi backend=$BACKEND target=$target"
  "$PY" "${base_args[@]}" --target-skill-path "$target" --progress     || echo "[skillopt-sleep] $target cycle failed (see above)" >&2
done

echo "[skillopt-sleep] review staged proposals:  $PY -m skillopt_sleep status --project $PROJECT"
echo "[skillopt-sleep] adopt after review:        $PY -m skillopt_sleep adopt --project $PROJECT"
