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
  if ! command -v pi >/dev/null 2>&1; then echo "[FAIL] pi not found on PATH — install pi first" >&2; exit 1; fi
  mapfile -t PACKS < <(jq -r 'to_entries[] | "npm:\(.key)@\(.value)"' "$ROOT/packages.lock.json")
  if [[ ${#PACKS[@]} -eq 0 ]]; then echo "[FAIL] packages.lock.json is empty" >&2; exit 1; fi
  echo "[.. ] installing ${#PACKS[@]} pinned packages (one at a time)…"
  # pi install accepts a single source per invocation.
  for src in "${PACKS[@]}"; do
    echo "  -> $src"
    pi install "$src"
  done
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
  jq -s '.[0] as $repo |.[1] as $live | $repo
  | if ($live.defaultProvider // null) != null then.defaultProvider=$live.defaultProvider else. end
  | if ($live.defaultModel // null) != null then.defaultModel=$live.defaultModel else. end
  | if ($live.defaultThinkingLevel // null) != null then.defaultThinkingLevel=$live.defaultThinkingLevel else. end
  | if ($live.enabledModels // null) != null then.enabledModels=$live.enabledModels else. end
  | if ($live.packages // null) != null then.packages=$live.packages else. end' \
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
scripts/skillopt-sleep-nightly.sh|__AGENT__/scripts/skillopt-sleep-nightly.sh|
scripts/validate-live-settings.mjs|__AGENT__/scripts/validate-live-settings.mjs|
scripts/validate-manifest.mjs|__AGENT__/scripts/validate-manifest.mjs|
scripts/verify-package-lock.mjs|__AGENT__/scripts/verify-package-lock.mjs|
scripts/apply-package-patches.sh|__AGENT__/scripts/apply-package-patches.sh|
scripts/tickets-to-workflow.mjs|__AGENT__/scripts/tickets-to-workflow.mjs|
scripts/profile.sh|__AGENT__/scripts/profile.sh|
scripts/mcp-toggle.sh|__AGENT__/scripts/mcp-toggle.sh|executable
scripts/fix-embeddings.sh|__AGENT__/scripts/fix-embeddings.sh|executable
scripts/check-extension-updates.sh|__AGENT__/scripts/check-extension-updates.sh|executable
scripts/enforce-tool-profile.sh|__AGENT__/scripts/enforce-tool-profile.sh|executable
scripts/ensure-btw-model.mjs|__AGENT__/scripts/ensure-btw-model.mjs|executable
scripts/_gh-release-body.js|__AGENT__/scripts/_gh-release-body.js|
patches/context-mode/apply-patches.mjs|__AGENT__/patches/context-mode/apply-patches.mjs|
patches/tscg/apply-patches.mjs|__AGENT__/patches/tscg/apply-patches.mjs|
patches/dynamic-workflows/apply-patches.mjs|__AGENT__/patches/dynamic-workflows/apply-patches.mjs|
tscg.json|__PI_HOME__/tscg.json|
extensions/session-index.ts|__AGENT__/extensions/session-index.ts|
extensions/transcript-pruner.ts|__AGENT__/extensions/transcript-pruner.ts|
extensions/lib/prune-core.mjs|__AGENT__/extensions/lib/prune-core.mjs|
extensions/rot-sentinel.ts|__AGENT__/extensions/rot-sentinel.ts|
extensions/runtime-discipline.ts|__AGENT__/extensions/runtime-discipline.ts|
extensions/ce-lite-preload.ts|__AGENT__/extensions/ce-lite-preload.ts|
extensions/enforce-tool-profile.ts|__AGENT__/extensions/enforce-tool-profile.ts|
lean-ctx/pi-config.json|__AGENT__/extensions/pi-lean-ctx/config.json|
lean-ctx/config.toml|__LEAN_HOME__/config.toml|
lean-ctx/config.toml|__AGENT__/lean-ctx/config.toml|
lean-ctx/env.tuning.sh|__LEAN_HOME__/env.tuning.sh|
workflows/model-tiers.json|__PI_HOME__/workflows/model-tiers.json|preserve
workflows/saved/memory-consolidate.json|__PI_HOME__/workflows/saved/memory-consolidate.json|
workflows/saved/gather-judge-split.js|__PI_HOME__/workflows/saved/gather-judge-split.js|
workflows/saved/review-fix-graph.js|__PI_HOME__/workflows/saved/review-fix-graph.js|
memory/consolidated.md|__AGENT__/memory/consolidated.md|
memory/harnesses.md|__AGENT__/memory/harnesses.md|
memory/user-shell.md|__AGENT__/memory/user-shell.md|
model-thinking.json|__AGENT__/model-thinking.json|preserve
bundled-skills/ce-lite|__AGENT__/skills/ce-lite|dir
bundled-skills/harness-doctor|__AGENT__/skills/harness-doctor|dir
bundled-skills/context-rot-forensics|__AGENT__/skills/context-rot-forensics|dir
bundled-skills/graph-engineering|__AGENT__/skills/graph-engineering|dir
bundled-skills/shard-security|__AGENT__/skills/shard-security|dir
bundled-skills/smart-read|__AGENT__/skills/smart-read|dir
scripts/base64_bench.py|__PI_HOME__/scripts/base64_bench.py|
scripts/base64_bench_providers.json|__PI_HOME__/scripts/base64_bench_providers.json|
EOF
MANIFEST="${MANIFEST//__AGENT__/$AGENT}"
MANIFEST="${MANIFEST//__PI_HOME__/$HOME_DIR/.pi}"
MANIFEST="${MANIFEST//__LEAN_HOME__/$HOME_DIR/.config/lean-ctx}"
fail=${fail_settings:-0}; ok=0; skip=0
while IFS='|' read -r src dest flags; do
  [[ -z "$src" ]] && continue
  if [[ ! -e "$ROOT/$src" ]] && [[ "$flags" != *preserve* ]]; then echo "[FAIL] source missing: $src"; fail=$((fail+1)); continue; fi
  # Repo cloned at ~/.pi: __PI_HOME__/__AGENT__ targets may resolve to the same
  # files/dirs as ROOT. Skip the no-op copy so install stays idempotent here.
  if [[ -e "$dest" ]] && [[ "$ROOT/$src" -ef "$dest" ]]; then echo "[SAME] $src (repo==target)"; skip=$((skip+1)); continue; fi
  # preserve flag = machine-local provider/model map (thinking/tiers):
  # only deploy if destination absent, so monthly provider rotation survives reinstall.
  if [[ "$flags" == *preserve* ]] && [[ -e "$dest" ]]; then echo "[KEEP] live $dest (preserve)"; skip=$((skip+1)); continue; fi
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
    "$AGENT/model-agents.json"
  "$AGENT/AGENTS_full.md"
  "$AGENT/AGENTS_terse.md"
  "$HOME_DIR/.pi/workflows/saved/investment-gather-judge.json"
)
for path in "${OBSOLETE[@]}"; do
  if $CHECK; then [[ ! -e "$path" ]] || { echo "[STALE] $path"; fail=$((fail+1)); }
  else rm -f "$path"; fi
done

# Prune harness skill names from $HOME/.pi/skills so they cannot shadow
# ~/.pi/agent/skills when cwd is $HOME (Pi loads <cwd>/.pi/skills as "project").
# Happens if this repo was cloned at ~/.pi while source still lived at skills/.
HARNESS_SKILLS=(ce-lite harness-doctor context-rot-forensics graph-engineering shard-security smart-read)
PROJECT_SKILLS_DIR="$HOME_DIR/.pi/skills"
if ! $CHECK; then
  for name in "${HARNESS_SKILLS[@]}"; do
    path="$PROJECT_SKILLS_DIR/$name"
    [[ -e "$path" ]] || continue
    # Do not delete live install source (bundled-skills/ or legacy skills/).
    resolved="$(readlink -f "$path" 2>/dev/null || printf '%s' "$path")"
    src_new="$(readlink -f "$ROOT/bundled-skills/$name" 2>/dev/null || true)"
    src_old="$(readlink -f "$ROOT/skills/$name" 2>/dev/null || true)"
    if [[ -n "$src_new" && "$resolved" == "$src_new" ]] || [[ -n "$src_old" && "$resolved" == "$src_old" ]]; then
      echo "[WARN] $path is install source; not pruning (clone outside ~/.pi, or keep using agent/skills only)"
      continue
    fi
    rm -rf "$path"
    echo "[ OK ] pruned project skill shadow: $path"
  done
  if [[ -d "$PROJECT_SKILLS_DIR" ]] && [[ -z "$(ls -A "$PROJECT_SKILLS_DIR" 2>/dev/null || true)" ]]; then
    rmdir "$PROJECT_SKILLS_DIR" 2>/dev/null || true
  fi
else
  for name in "${HARNESS_SKILLS[@]}"; do
    path="$PROJECT_SKILLS_DIR/$name"
    if [[ -e "$path" ]]; then
      echo "[STALE] project skill shadow $path (collides with agent/skills/$name)"
      fail=$((fail+1))
    fi
  done
fi

if ! $CHECK; then
  PI_AGENT_HOME="$AGENT" bash "$AGENT/scripts/apply-package-patches.sh"
fi
# Active lean-ctx tool-profile enforcement: snap runtime back to the repo pin
# (config.toml's tool_profile only accepts minimal|standard|power, so a "lean"
# pin there is ignored by the runtime and drifts to power silently). In check
# mode report-only; otherwise enforce.
if $CHECK; then
  "$ROOT/scripts/enforce-tool-profile.sh" --check >/dev/null 2>&1 \
    && echo "[ OK ] lean-ctx tool profile pinned" \
    || { echo "[DIFF] lean-ctx tool profile drift — run: ./install.sh"; fail=$((fail+1)); }
else
  "$ROOT/scripts/enforce-tool-profile.sh" 2>&1 | sed 's/^/[enforce] /' || fail=$((fail+1))
fi
# /btw (pi-smart-btw) model guard: the upstream default is hardcoded to
# openai-codex/gpt-5.6-luna, which fails with "No API key found for
# openai-codex" when the machine has no such key. Assign /btw a cheap model
# from the machine's own registry (provider-agnostic). Check mode reports.
if $CHECK; then
  node "$ROOT/scripts/ensure-btw-model.mjs" --check >/dev/null 2>&1 \
    && echo "[ OK ] /btw cheap model configured" \
    || { echo "[DIFF] /btw uses non-working default model — run: ./install.sh"; fail=$((fail+1)); }
else
  node "$ROOT/scripts/ensure-btw-model.mjs" 2>&1 | sed 's/^/[btw] /' || fail=$((fail+1))
fi
# OS-level backstop: install + start a user systemd timer that re-enforces the
# profile every 5 min, so "always lean" holds even when pi runs in a mode that
# does not load extensions (e.g. -ne) and independent of any single session.
# Copy units into ~/.config/systemd/user — never `systemctl link` from $ROOT.
# A /tmp or worktree checkout leaves dangling units (LoadState=bad) after the
# path disappears; reboot or daemon-reload then kills the timer.
# Guard: systemd user sessions available? (not whether the unit already exists).
ENFORCE_UNITS=(enforce-tool-profile.service enforce-tool-profile.timer)
UNIT_DIR="$HOME_DIR/.config/systemd/user"
if systemctl --user is-system-running >/dev/null 2>&1; then
  if $CHECK; then
    frag=$(systemctl --user show -p FragmentPath --value enforce-tool-profile.timer 2>/dev/null || true)
    load=$(systemctl --user show -p LoadState --value enforce-tool-profile.timer 2>/dev/null || true)
    if ! systemctl --user is-active enforce-tool-profile.timer >/dev/null 2>&1; then
      echo "[DIFF] lean-ctx enforce timer not active — run: ./install.sh"
      fail=$((fail+1))
    elif [[ "$load" == "bad" || "$load" == "not-found" ]]; then
      echo "[DIFF] lean-ctx enforce timer LoadState=$load — run: ./install.sh"
      fail=$((fail+1))
    elif [[ "$frag" != "$UNIT_DIR/enforce-tool-profile.timer" ]]; then
      echo "[DIFF] lean-ctx enforce timer FragmentPath=$frag (want $UNIT_DIR/...) — run: ./install.sh"
      fail=$((fail+1))
    else
      echo "[ OK ] lean-ctx enforce timer active"
    fi
  else
    mkdir -p "$UNIT_DIR"
    for u in "${ENFORCE_UNITS[@]}"; do
      rm -f "$UNIT_DIR/$u"
      install -m 644 "$ROOT/lean-ctx/$u" "$UNIT_DIR/$u"
    done
    systemctl --user daemon-reload >/dev/null 2>&1
    systemctl --user enable --now enforce-tool-profile.timer >/dev/null 2>&1
    echo "[ OK ] lean-ctx enforce timer installed + started"
  fi
else
  echo "[skip] systemd user sessions unavailable — rely on extension + preflight only"
fi
# Wire repo git hooks (secret guard pre-commit + pre-push preflight)
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" config core.hooksPath .githooks
  echo "[ok] git core.hooksPath -> .githooks"
fi

printf 'OK=%d FAIL=%d SKIP=%d\n' "$ok" "$fail" "$skip"
[[ "$fail" -eq 0 ]] || exit 1
