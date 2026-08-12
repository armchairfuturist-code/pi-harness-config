#!/usr/bin/env bash
# enforce-tool-profile.sh — active lean-ctx tool-profile enforcement.
#
# WHY: lean-ctx's config.toml `tool_profile` key only accepts
# minimal|standard|power; the "lean"/"auto" profiles are internal-to-state
# only. As a result, a config.toml pin of `tool_profile = "lean"` is IGNORED
# by the runtime, and the ACTIVE profile can silently drift to `power`
# (82 tool schemas / ~+12.7k tok per turn) with no on-disk trace — the
# passive preflight only blocks pushes; it never snaps the runtime back.
#
# This script makes the repo pin authoritative at runtime: it reads the same
# WANT_PROFILE as harness-preflight.sh and, in fix mode (`--fix`, the
# default), re-applies `lean-ctx tools <WANT_PROFILE>` whenever the live
# runtime disagrees. In check mode (`--check`) it only reports drift.
#
# "Always lean unless specifically changed" = change the pin in
# lean-ctx/config.toml (and lean-ctx/pi-config.json if present); this script
# enforces whatever the repo pins.
#
# Usage:
#   enforce-tool-profile.sh [--check] [--quiet]
#   hook into: install.sh (deploy) and/or shell rc / agent startup.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Find the repo pin regardless of install location: when deployed via install.sh
# the script lands in $HOME/.pi/agent/scripts while the pin stays in the repo
# ($HOME/.config/lean-ctx/config.toml, $HOME/.pi/lean-ctx/config.toml, or the
# deploying checkout). Prefer an explicit ENFORCE_TOOL_PROFILE_CONFIG override,
# else the live harness pin, else walk up to a repo lean-ctx/config.toml sibling.
# lean-ctx may rewrite ~/.config/lean-ctx/config.toml and drop the pin; a JSON
# fallback reads extensions/pi-lean-ctx/config.json toolProfile in that case.
CONFIG="${ENFORCE_TOOL_PROFILE_CONFIG:-}"
if [[ -z "$CONFIG" ]]; then
  for cand in \
    "$HOME/.config/lean-ctx/config.toml" \
    "$HOME/.pi/lean-ctx/config.toml" \
    "$SCRIPT_DIR/../lean-ctx/config.toml" \
    "$SCRIPT_DIR/../../lean-ctx/config.toml"; do
    if [[ -f "$cand" ]] && grep -qE '^tool_profile' "$cand" 2>/dev/null; then
      CONFIG="$cand"; break
    fi
  done
fi
# lean-ctx rewrites ~/.config/lean-ctx/config.toml and may drop the pin.
# pi-config.json is harness-owned and is not overwritten by that rewrite.
JSON_PIN="${HOME}/.pi/agent/extensions/pi-lean-ctx/config.json"
if [[ -z "$CONFIG" && -f "$JSON_PIN" ]] && grep -qE '"toolProfile"' "$JSON_PIN"; then
  CONFIG="$JSON_PIN"
fi
CHECK=false
QUIET=false
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=true ;;
    --quiet) QUIET=true ;;
  esac
done
say() { $QUIET && return 0; echo "$*"; }
err() { echo "[enforce-tool-profile] $*" >&2; }

if ! command -v lean-ctx >/dev/null 2>&1; then
  err "lean-ctx CLI not found — cannot enforce tool profile"
  exit 2
fi

# Same WANT_PROFILE derivation as harness-preflight.sh (repo is source of truth).
if [[ -z "$CONFIG" ]]; then
  err "no lean-ctx/config.toml with a tool_profile pin found (set ENFORCE_TOOL_PROFILE_CONFIG)"
  exit 2
fi
if [[ "$CONFIG" == *.json ]]; then
  WANT_PROFILE=$(sed -nE 's/.*"toolProfile"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$CONFIG" | head -1)
else
  WANT_PROFILE=$(grep -E '^tool_profile' "$CONFIG" 2>/dev/null | sed -E 's/.*"([^"]+)".*/\1/')
fi
if [[ -z "$WANT_PROFILE" ]]; then
  err "repo tool_profile not pinned in $CONFIG — refusing to guess"
  exit 2
fi

RUNTIME_PROFILE=$(lean-ctx tools show 2>/dev/null | sed -nE 's/^Tool Profile: ([a-z]+).*/\1/p' | head -1)
if [[ -z "$RUNTIME_PROFILE" ]]; then
  err "could not read lean-ctx runtime tool profile"
  exit 2
fi

if [[ "$RUNTIME_PROFILE" == "$WANT_PROFILE" ]]; then
  say "tool profile OK: repo=$WANT_PROFILE runtime=$RUNTIME_PROFILE"
  exit 0
fi

if $CHECK; then
  err "tool profile drift: runtime=$RUNTIME_PROFILE repo=$WANT_PROFILE — run 'lean-ctx tools $WANT_PROFILE' or enforce-tool-profile.sh"
  exit 1
fi

err "tool profile drift (runtime=$RUNTIME_PROFILE repo=$WANT_PROFILE) — enforcing 'lean-ctx tools $WANT_PROFILE'"
OUT=$(lean-ctx tools "$WANT_PROFILE" 2>&1)
RC=$?
if [[ $RC -ne 0 ]]; then
  err "enforce failed (rc=$RC): $OUT"
  exit 1
fi
say "enforced tool profile: $WANT_PROFILE"
exit 0
