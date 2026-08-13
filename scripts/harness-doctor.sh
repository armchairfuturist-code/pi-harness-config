#!/usr/bin/env bash
# Catch the config errors this harness keeps hitting.
# Run after every pull:  ./install.sh && ./scripts/harness-doctor.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT="${PI_AGENT_DIR:-$HOME/.pi/agent}"
fail=0

ok() { echo "[ OK ] $*"; }
bad() { echo "[FAIL] $*"; fail=$((fail + 1)); }

# 1. models.json: input may only be "text" or "image"
MODELS="$AGENT/models.json"
if [[ ! -f "$MODELS" ]]; then
  bad "models.json missing at $MODELS"
else
  extra=$(jq -r '
    .providers // {}
    | to_entries[]
    | .key as $p
    | (.value.models // [])
    | to_entries[]
    | .key as $i
    | .value
    | (.input // [])
    | .[]
    | select(. != "text" and . != "image")
    | "\($p).models[\($i)].input=\(.)"
  ' "$MODELS" 2>/dev/null || true)
  if [[ -n "$extra" ]]; then
    bad "models.json schema: input must be text|image only"
    printf '%s\n' "$extra" | sed 's/^/       /'
  else
    ok "models.json input schema"
  fi
fi

# 2. live packages ⊆ repo allowlist (settings.json). git: specs skip the npm lock.
LOCK="$ROOT/packages.lock.json"
LIVE="$AGENT/settings.json"
REPO="$ROOT/settings.json"
if [[ -f "$LOCK" && -f "$LIVE" && -f "$REPO" ]]; then
  extras=$(jq -n --slurpfile repo "$REPO" --slurpfile live "$LIVE" '
    def name: sub("^npm:"; "") | sub("^git:"; "") | sub("@[0-9][^@]*$"; "");
    ($repo[0].packages // [] | map(name)) as $allow
    | ($live[0].packages // [])
    | map(name)
    | map(select(. as $n | ($allow | index($n) | not)))
    | .[]
  ')
  if [[ -n "$extras" ]]; then
    bad "extra packages (not in repo settings.json):"
    printf '%s\n' "$extras" | sed 's/^/       /'
  else
    ok "packages ⊆ repo allowlist"
  fi
else
  bad "need $LOCK and $LIVE and $REPO"
fi

# 3. repo vs live (skip package install)
if [[ -x "$ROOT/install.sh" ]]; then
  if (cd "$ROOT" && bash install.sh --check --skip-packages); then
    ok "install.sh --check"
  else
    bad "install.sh --check"
  fi
fi

# 4. runtime env
if [[ -x "$ROOT/scripts/harness-preflight.sh" ]]; then
  if bash "$ROOT/scripts/harness-preflight.sh"; then
    ok "harness-preflight"
  else
    bad "harness-preflight"
  fi
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "doctor: clean"
  exit 0
fi
echo "doctor: $fail check(s) failed"
exit 1
