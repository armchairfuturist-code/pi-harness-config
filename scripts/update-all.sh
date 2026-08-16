#!/usr/bin/env bash
# update-all.sh — Unified update for pi, extensions, lean-ctx binary, and skills.
#
# PROBLEM: `pi update --all` updates pi + npm extensions (including pi-lean-ctx
# npm package) but does NOT update the lean-ctx Rust binary at ~/.local/bin/lean-ctx.
# The binary has its own `lean-ctx update` command. When versions drift
# (extension 3.9.18, binary 3.9.15), MCP bridge errors spike — 495 errors across
# 121 sessions (July-Aug 2026), including 118 in a single day.
#
# This script closes the gap by running all update channels in sequence and
# verifying version sync at the end.
#
# Usage:
#   scripts/update-all.sh              # full update: pi + extensions + lean-ctx binary + skills
#   scripts/update-all.sh --check      # version-sync check only (no updates, exit 1 on drift)
#   scripts/update-all.sh --no-skills  # skip skills update
#   scripts/update-all.sh --no-lean    # skip lean-ctx binary update
#
# Exit codes:
#   0 = all current or updated successfully
#   1 = version drift detected (with --check) or update failed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK_ONLY=0
DO_SKILLS=1
DO_LEAN=1

for a in "$@"; do
  case "$a" in
    --check)    CHECK_ONLY=1;;
    --no-skills) DO_SKILLS=0;;
    --no-lean)  DO_LEAN=0;;
    --help|-h)
      echo "Usage: update-all.sh [--check] [--no-skills] [--no-lean]"
      echo "  --check       Version-sync check only, no updates"
      echo "  --no-skills   Skip npx skills@latest update"
      echo "  --no-lean     Skip lean-ctx binary update"
      exit 0;;
  esac
done

# ── Version helpers ────────────────────────────────────────────────────

get_lean_binary_version() {
  lean-ctx --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
}

get_lean_npm_version() {
  node -e "console.log(require('$ROOT/agent/npm/node_modules/pi-lean-ctx/package.json').version)" 2>/dev/null || echo "?"
}

get_lean_lock_version() {
  node -e "console.log(require('$ROOT/packages.lock.json')['pi-lean-ctx'] || '?')" 2>/dev/null || echo "?"
}

# ── Check mode: report drift only ──────────────────────────────────────

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  echo "Version sync check ($(date +%F))"
  echo "=================================================="
  BIN_VER=$(get_lean_binary_version)
  NPM_VER=$(get_lean_npm_version)
  LOCK_VER=$(get_lean_lock_version)
  DRIFT=0

  printf "  lean-ctx binary:   %s\n" "$BIN_VER"
  printf "  pi-lean-ctx npm:   %s\n" "$NPM_VER"
  printf "  packages.lock:     %s\n" "$LOCK_VER"

  if [[ "$BIN_VER" != "$NPM_VER" ]]; then
    echo "  ⚠️  DRIFT: binary ($BIN_VER) != npm ($NPM_VER)"
    echo "      Fix: lean-ctx update  (or run this script without --check)"
    DRIFT=1
  fi
  if [[ "$LOCK_VER" != "?" && "$LOCK_VER" != "$NPM_VER" ]]; then
    echo "  ⚠️  DRIFT: packages.lock ($LOCK_VER) != npm ($NPM_VER)"
    echo "      Fix: pi update --extensions"
    DRIFT=1
  fi
  if [[ "$DRIFT" -eq 0 ]]; then
    echo "  ✓ all lean-ctx versions in sync ($BIN_VER)"
  fi
  echo "=================================================="
  exit $DRIFT
fi

# ── Full update ────────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Unified Update — pi + extensions + lean-ctx + skills   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo

# 1. Pi self-update + extensions
echo "── 1/4: pi update --all ──────────────────────────────────"
pi update --all
echo

# 2. lean-ctx binary update
if [[ "$DO_LEAN" -eq 1 ]]; then
  echo "── 2/4: lean-ctx binary update ──────────────────────────"
  BIN_BEFORE=$(get_lean_binary_version)
  lean-ctx update 2>&1 || echo "  (lean-ctx update failed or already current)"
  BIN_AFTER=$(get_lean_binary_version)
  if [[ "$BIN_BEFORE" != "$BIN_AFTER" ]]; then
    echo "  ✓ binary updated: $BIN_BEFORE → $BIN_AFTER"
  else
    echo "  ✓ binary current ($BIN_AFTER)"
  fi
  echo
else
  echo "── 2/4: lean-ctx binary update [skipped] ────────────────"
  echo
fi

# 3. Skills update
if [[ "$DO_SKILLS" -eq 1 ]]; then
  echo "── 3/4: skills update ───────────────────────────────────"
  npx --yes skills@latest update --global --yes 2>&1 || echo "  (skills update failed or nothing to update)"
  echo
else
  echo "── 3/4: skills update [skipped] ─────────────────────────"
  echo
fi

# 4. Version sync verification
echo "── 4/4: version sync check ──────────────────────────────"
BIN_VER=$(get_lean_binary_version)
NPM_VER=$(get_lean_npm_version)
LOCK_VER=$(get_lean_lock_version)

printf "  lean-ctx binary:   %s\n" "$BIN_VER"
printf "  pi-lean-ctx npm:   %s\n" "$NPM_VER"
printf "  packages.lock:     %s\n" "$LOCK_VER"

SYNC_OK=1
if [[ "$BIN_VER" != "$NPM_VER" ]]; then
  echo "  ⚠️  DRIFT: binary ($BIN_VER) != npm ($NPM_VER)"
  echo "      Run: lean-ctx update"
  SYNC_OK=0
fi
if [[ "$LOCK_VER" != "?" && "$LOCK_VER" != "$NPM_VER" ]]; then
  echo "  ⚠️  DRIFT: packages.lock ($LOCK_VER) != npm ($NPM_VER)"
  echo "      Run: pi update --extensions"
  SYNC_OK=0
fi
if [[ "$SYNC_OK" -eq 1 ]]; then
  echo "  ✓ all lean-ctx versions in sync ($BIN_VER)"
fi

echo
echo "═══════════════════════════════════════════════════════════"
echo "  Update complete. Restart pi and your shell to activate."
echo "═══════════════════════════════════════════════════════════"
exit $((1 - SYNC_OK))
