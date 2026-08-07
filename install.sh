#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOME_DIR="${HOME:?HOME not set}"
AGENT="$HOME_DIR/.pi/agent"
CHECK=false
SETTINGS=false
SKIP_PACKAGES=false
for arg in "$@"; do
  case "$arg" in
    --check)          CHECK=true;;
    --settings)       SETTINGS=true;;
    --skip-packages)  SKIP_PACKAGES=true;;
    *) echo "usage: $0 [--check] [--settings] [--skip-packages]" >&2; exit 2;;
  esac
done

# --- Install pinned npm packages from packages.lock.json -------------------
if ! $CHECK && ! $SKIP_PACKAGES; then
  if ! command -v pi >/dev/null 2>&1; then
    echo "[FAIL] pi not found on PATH — install pi first" >&2; exit 1
  fi
  PACKS=$(jq -r 'to_entries[] | "npm:\(.key)@\(.value)"' "$ROOT/packages.lock.json" | tr '\n' ' ')
  if [[ -z "$PACKS" ]]; then
    echo "[FAIL] packages.lock.json is empty" >&2; exit 1
  fi
  echo "[ .. ] installing $(echo "$PACKS" | wc -w) pinned packages…"
  pi install $PACKS
  echo "[ OK ] packages installed"
elif $CHECK && ! $SKIP_PACKAGES; then
  PI_AGENT_HOME="$AGENT" node "$ROOT/scripts/verify-package-lock.mjs" >/dev/null 2>&1 \
    && echo "[ OK ] package versions" \
    || { echo "[DIFF] package versions — run: ./install.sh"; fail=1; }
fi

# Always deploy/check the generic kernel. By default preserve machine-local
# provider/model routing; --settings requests the repo defaults verbatim.
EXPECTED_SETTINGS=$(mktemp)
trap 'rm -f "$EXPECTED_SETTINGS"' EXIT
if ! $SETTINGS && [[ -f "$AGENT/settings.json" ]]; then
  jq -s '.[0] as $repo | .[1] as $live | $repo
    | if ($live.defaultProvider // null) != null then .defaultProvider=$live.defaultProvider else . end
    | if ($live.defaultModel // null) != null then .defaultModel=$live.defaultModel else . end' \
    "$ROOT/settings.json" "$AGENT/settings.json" > "$EXPECTED_SETTINGS"
else
  cp "$ROOT/settings.json" "$EXPECTED_SETTINGS"
fi
if $CHECK; then
  if diff -q "$EXPECTED_SETTINGS" "$AGENT/settings.json" >/dev/null 2>&1; then echo "[ OK ] settings.json"; else echo "[DIFF] settings.json -> $AGENT/settings.json"; fail_settings=1; fi
else
  mkdir -p "$AGENT"; cp "$EXPECTED_SETTINGS" "$AGENT/settings.json"; echo "[ OK ] settings.json"
fi

read -r -d '' MANIFEST <<'EOF' || true
AGENTS.md|__AGENT__/AGENTS.md|
APPEND_SYSTEM.md|__AGENT__/APPEND_SYSTEM.md|
HARNESS.md|__AGENT__/HARNESS.md|
packages.lock.json|__AGENT__/packages.lock.json|
profiles|__AGENT__/profiles|dir
scripts/harness-preflight.sh|__AGENT__/scripts/harness-preflight.sh|
scripts/validate-live-settings.mjs|__AGENT__/scripts/validate-live-settings.mjs|
scripts/validate-manifest.mjs|__AGENT__/scripts/validate-manifest.mjs|
scripts/verify-package-lock.mjs|__AGENT__/scripts/verify-package-lock.mjs|
scripts/apply-package-patches.sh|__AGENT__/scripts/apply-package-patches.sh|
scripts/profile.sh|__AGENT__/scripts/profile.sh|
patches/context-mode/apply-patches.mjs|__AGENT__/patches/context-mode/apply-patches.mjs|
patches/tscg/apply-patches.mjs|__AGENT__/patches/tscg/apply-patches.mjs|
tscg.json|__PI_HOME__/tscg.json|
extensions/session-index.ts|__AGENT__/extensions/session-index.ts|
extensions/transcript-pruner.ts|__AGENT__/extensions/transcript-pruner.ts|
extensions/runtime-discipline.ts|__AGENT__/extensions/runtime-discipline.ts|
lean-ctx/pi-config.json|__AGENT__/extensions/pi-lean-ctx/config.json|
lean-ctx/config.toml|__LEAN_HOME__/config.toml|
workflows/model-tiers.json|__PI_HOME__/workflows/model-tiers.json|
workflows/saved/memory-consolidate.json|__PI_HOME__/workflows/saved/memory-consolidate.json|
workflows/saved/gather-judge-split.js|__PI_HOME__/workflows/saved/gather-judge-split.js|
workflows/saved/review-fix-graph.js|__PI_HOME__/workflows/saved/review-fix-graph.js|
memory/consolidated.md|__AGENT__/memory/consolidated.md|
memory/harnesses.md|__AGENT__/memory/harnesses.md|
memory/user-shell.md|__AGENT__/memory/user-shell.md|
model-thinking.json|__AGENT__/model-thinking.json|
skills/ce-lite|__AGENT__/skills/ce-lite|dir
skills/harness-doctor|__AGENT__/skills/harness-doctor|dir
skills/context-rot-forensics|__AGENT__/skills/context-rot-forensics|dir
skills/graph-engineering|__AGENT__/skills/graph-engineering|dir
skills/poor-mans-distill|__AGENT__/skills/poor-mans-distill|dir
skills/shard-security|__AGENT__/skills/shard-security|dir
scripts/base64_bench.py|__PI_HOME__/scripts/base64_bench.py|
scripts/base64_bench_providers.json|__PI_HOME__/scripts/base64_bench_providers.json|
EOF
MANIFEST="${MANIFEST//__AGENT__/$AGENT}"
MANIFEST="${MANIFEST//__PI_HOME__/$HOME_DIR/.pi}"
MANIFEST="${MANIFEST//__LEAN_HOME__/$HOME_DIR/.config/lean-ctx}"

fail=${fail_settings:-0}; ok=0; skip=0
while IFS='|' read -r src dest flags; do
  [[ -z "$src" ]] && continue
  [[ -e "$ROOT/$src" ]] || { echo "[FAIL] source missing: $src"; fail=$((fail+1)); continue; }
  if $CHECK; then
    same=false
    if [[ -d "$ROOT/$src" ]]; then diff -rq "$ROOT/$src" "$dest" >/dev/null 2>&1 && same=true
    else diff -q "$ROOT/$src" "$dest" >/dev/null 2>&1 && same=true; fi
    if $same; then echo "[ OK ] $src"; ok=$((ok+1)); else echo "[DIFF] $src -> $dest"; fail=$((fail+1)); fi
  else
    mkdir -p "$(dirname "$dest")"
    if [[ -d "$ROOT/$src" ]]; then rm -rf "$dest"; cp -a "$ROOT/$src" "$dest"
    else cp "$ROOT/$src" "$dest"; fi
    echo "[ OK ] $src"; ok=$((ok+1))
  fi
done <<< "$MANIFEST"

OBSOLETE=(
  "$AGENT/extensions/invest-tools.ts"
  "$AGENT/extensions/tool-trimmer.ts"
  "$AGENT/extensions/rot-sentinel.ts"
  "$AGENT/model-agents.json"
  "$AGENT/AGENTS_full.md"
  "$AGENT/AGENTS_terse.md"
  "$HOME_DIR/.pi/workflows/saved/investment-gather-judge.json"
)
for path in "${OBSOLETE[@]}"; do
  if $CHECK; then [[ ! -e "$path" ]] || { echo "[STALE] $path"; fail=$((fail+1)); }
  else rm -f "$path"; fi
done

if ! $CHECK; then
  PI_AGENT_HOME="$AGENT" bash "$AGENT/scripts/apply-package-patches.sh"
fi
printf 'OK=%d FAIL=%d SKIP=%d\n' "$ok" "$fail" "$skip"
[[ "$fail" -eq 0 ]] || exit 1
