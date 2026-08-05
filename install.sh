#!/usr/bin/env bash
#
# install.sh — error-proof harness config deployment
#
# Usage:
#   ./install.sh             # copy all vendored files to live locations, verify, report
#   ./install.sh --check     # verify only (no writes) — reports drift
#   ./install.sh --settings  # include settings.json (excluded by default — provider/model differ per machine)
#
# The manifest below is the SINGLE SOURCE OF TRUTH for what gets installed.
# To add a file to the repo's deployment: add it to the MANIFEST, commit, push.
# Never rely on README prose to track what needs copying.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOME_DIR="${HOME:?HOME not set}"
PI_AGENT="$HOME_DIR/.pi/agent"
CHECK_ONLY=false
INCLUDE_SETTINGS=false
FAIL=0
OK=0
SKIPPED=0

for arg in "$@"; do
  case "$arg" in
    --check)    CHECK_ONLY=true ;;
    --settings) INCLUDE_SETTINGS=true ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

# ── Manifest ──────────────────────────────────────────────────────────────────
# Format: source_relative|dest_absolute|flags
# Flags: dir = recursive directory, opt = optional (skipped unless --settings)
# ──────────────────────────────────────────────────────────────────────────────
read -r -d '' MANIFEST <<'MANIFEST_EOF' || true
APPEND_SYSTEM.md|PI_AGENT/APPEND_SYSTEM.md|
HARNESS.md|PI_AGENT/HARNESS.md|
scripts/harness-preflight.sh|PI_AGENT/scripts/harness-preflight.sh|
tscg.json|PI_HOME/tscg.json|
extensions/session-index.ts|PI_AGENT/extensions/session-index.ts|
extensions/transcript-pruner.ts|PI_AGENT/extensions/transcript-pruner.ts|
lean-ctx/pi-config.json|PI_AGENT/extensions/pi-lean-ctx/config.json|
lean-ctx/config.toml|LEANCTX_HOME/config.toml|
workflows/model-tiers.json|PI_HOME/workflows/model-tiers.json|
workflows/saved/memory-consolidate.json|PI_HOME/workflows/saved/memory-consolidate.json|
workflows/saved/gather-judge-split.js|PI_HOME/workflows/saved/gather-judge-split.js|
workflows/saved/review-fix-graph.js|PI_HOME/workflows/saved/review-fix-graph.js|
memory/consolidated.md|PI_AGENT/memory/consolidated.md|
memory/harnesses.md|PI_AGENT/memory/harnesses.md|
memory/user-shell.md|PI_AGENT/memory/user-shell.md|
model-thinking.json|PI_AGENT/model-thinking.json|
skills/ce-lite|PI_AGENT/skills/ce-lite|dir
skills/harness-doctor|PI_AGENT/skills/harness-doctor|dir
skills/context-rot-forensics|PI_AGENT/skills/context-rot-forensics|dir
skills/graph-engineering|PI_AGENT/skills/graph-engineering|dir
skills/poor-mans-distill|PI_AGENT/skills/poor-mans-distill|dir
skills/shard-security|PI_AGENT/skills/shard-security|dir
skills/workflow-authoring|PI_AGENT/npm/node_modules/@quintinshaw/pi-dynamic-workflows/skills/workflow-authoring|dir
scripts/base64_bench.py|PI_HOME/scripts/base64_bench.py|
scripts/base64_bench_providers.json|PI_HOME/scripts/base64_bench_providers.json|
settings.json|PI_AGENT/settings.json|opt
MANIFEST_EOF

# Substitute path variables
MANIFEST="${MANIFEST//PI_AGENT/$PI_AGENT}"
MANIFEST="${MANIFEST//PI_HOME/$HOME_DIR/.pi}"
MANIFEST="${MANIFEST//LEANCTX_HOME/$HOME_DIR/.config/lean-ctx}"

deploy_one() {
  local src="$1" dest="$2" flags="$3"
  local is_dir=false is_opt=false
  [[ "$flags" == *"dir"* ]] && is_dir=true
  [[ "$flags" == *"opt"* ]] && is_opt=true

  # Skip optional unless --settings
  if $is_opt && ! $INCLUDE_SETTINGS; then
    printf "  [SKIP] %s (optional — use --settings to include)\n" "$(basename "$src")"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi

  # Source must exist in repo
  if [[ ! -e "$SCRIPT_DIR/$src" ]]; then
    printf "  [FAIL] %s — source missing in repo\n" "$src"
    FAIL=$((FAIL + 1))
    return 0
  fi

  # Create dest directory
  mkdir -p "$(dirname "$dest")"

  if $CHECK_ONLY; then
    # Verify only
    if [[ ! -e "$dest" ]]; then
      printf "  [MISS] %s → %s\n" "$src" "$dest"
      FAIL=$((FAIL + 1))
    elif $is_dir; then
      if diff -rq "$SCRIPT_DIR/$src" "$dest" >/dev/null 2>&1; then
        printf "  [ OK ] %s/\n" "$src"
        OK=$((OK + 1))
      else
        printf "  [DIFF] %s/ — contents differ from live\n" "$src"
        FAIL=$((FAIL + 1))
      fi
    else
      if diff -q "$SCRIPT_DIR/$src" "$dest" >/dev/null 2>&1; then
        printf "  [ OK ] %s\n" "$src"
        OK=$((OK + 1))
      else
        printf "  [DIFF] %s — differs from live\n" "$src"
        FAIL=$((FAIL + 1))
      fi
    fi
  else
    # Copy
    if $is_dir; then
      rm -rf "$dest"
      cp -r "$SCRIPT_DIR/$src" "$dest"
    else
      cp "$SCRIPT_DIR/$src" "$dest"
    fi
    # Verify copy
    if $is_dir; then
      if diff -rq "$SCRIPT_DIR/$src" "$dest" >/dev/null 2>&1; then
        printf "  [ OK ] %s/\n" "$src"
        OK=$((OK + 1))
      else
        printf "  [FAIL] %s/ — copy verification failed\n" "$src"
        FAIL=$((FAIL + 1))
      fi
    else
      if diff -q "$SCRIPT_DIR/$src" "$dest" >/dev/null 2>&1; then
        printf "  [ OK ] %s\n" "$src"
        OK=$((OK + 1))
      else
        printf "  [FAIL] %s — copy verification failed\n" "$src"
        FAIL=$((FAIL + 1))
      fi
    fi
  fi
}

echo "════════════════════════════════════════════════════════════════"
if $CHECK_ONLY; then
  echo "  Harness config — VERIFY (no writes)"
else
  echo "  Harness config — INSTALL"
fi
echo "  Repo: $SCRIPT_DIR"
echo "  Live: $PI_AGENT"
echo "════════════════════════════════════════════════════════════════"

while IFS='|' read -r src dest flags; do
  [[ -z "$src" || "$src" == \#* ]] && continue
  deploy_one "$src" "$dest" "$flags"
done <<< "$MANIFEST"

echo "──────────────────────────────────────────────────────────────────"
printf "  OK: %d  FAIL: %d  SKIPPED: %d\n" "$OK" "$FAIL" "$SKIPPED"
echo "──────────────────────────────────────────────────────────────────"

if [[ "$FAIL" -gt 0 ]]; then
  echo "  ⚠ $FAIL file(s) failed — see above."
  exit 1
else
  if $CHECK_ONLY; then
    echo "  ✓ All vendored files match live."
  else
    echo "  ✓ All files deployed and verified."
    echo ""
    echo "  Next steps:"
    echo "    1. Overlay settings.json manually if needed (./install.sh --settings)"
    echo "    2. Install npm packages (see README)"
    echo "    3. Patch workflow-authoring SKILL.md if npm update overwrote it"
    echo "    4. Re-apply context-mode local patch if context-mode was updated"
    echo "    5. Run ./install.sh --check to verify everything landed"
  fi
  exit 0
fi
