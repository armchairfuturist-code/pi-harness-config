#!/usr/bin/env bash
# capture-live-tweak.sh — reverse of sync-live.sh: copy a tweak made on the
# LIVE agent (~/.pi/agent) back into this repo clone so you can commit, push,
# and apply it to other machines.
#
# Run from the canonical clone:
#   cd ~/Projects/pi-harness-config
#   ./scripts/capture-live-tweak.sh            # dry-run: show what differs
#   ./scripts/capture-live-tweak.sh --apply    # copy live -> repo
#   git add -A && git commit -m "..." && git push origin master
#   # on each other machine:
#   cd ~/Projects/pi-harness-config && git pull && ./install.sh && ./scripts/harness-doctor.sh
#
# Why: the repo source is the truth for other machines; the live agent holds
# the deployed copies. When you edit a script/extension/skill on this machine
# and want to ship it, use this instead of hand-copying (which is how CE-lite
# sessions end up looping on ad-hoc sync logic).
#
# Machine-local files are deliberately EXCLUDED — never captured to the repo:
#   settings.json (provider/model/thinking stay local), models.json,
#   model-thinking.json, pi-smart-btw.json, auth.json, sessions/, memory/,
#   npm/, tscg.json (HIL-locked).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${PI_AGENT_HOME:-$HOME/.pi/agent}"
APPLY="${1:-}"

if [[ "$ROOT" == "$HOME/.pi" || "$ROOT" == "$HOME/.pi/" ]]; then
  echo "ERROR: run this from the canonical clone (~/Projects/pi-harness-config)," >&2
  echo "       not from the live agent parent (~/.pi)." >&2
  exit 1
fi
if [[ "$APPLY" != "" && "$APPLY" != "--apply" ]]; then
  echo "usage: $0 [--apply]" >&2
  exit 2
fi

changed=0

# Extensions / scripts / patches: file-for-file from live agent -> repo source.
for rel in $(find "$ROOT/extensions" "$ROOT/scripts" "$ROOT/patches" -type f \
  \( -name '*.ts' -o -name '*.mjs' -o -name '*.sh' -o -name '*.js' -o -name '*.py' -o -name '*.json' \) 2>/dev/null | sed "s|$ROOT/||" | sort); do
  live="$AGENT/$rel"
  [[ -f "$live" ]] || continue
  if ! cmp -s "$live" "$ROOT/$rel"; then
    echo "[DIFF] $rel"
    changed=1
    if [[ "$APPLY" == "--apply" ]]; then
      cp "$live" "$ROOT/$rel"
      echo "  -> copied live -> repo"
    fi
  fi
done

# Bundled skills: whole dirs (live agent/skills/<name> -> bundled-skills/<name>).
for d in "$ROOT"/bundled-skills/*; do
  name="$(basename "$d")"
  [[ -d "$AGENT/skills/$name" ]] || continue
  if ! diff -rq "$d" "$AGENT/skills/$name" >/dev/null 2>&1; then
    echo "[DIFF] bundled-skills/$name (dir)"
    changed=1
    if [[ "$APPLY" == "--apply" ]]; then
      rm -rf "$d"
      cp -r "$AGENT/skills/$name" "$d"
      echo "  -> copied live -> repo"
    fi
  fi
done

# Top-level deployed files.
for f in HARNESS.md APPEND_SYSTEM.md AGENTS.md packages.lock.json; do
  if [[ -f "$AGENT/$f" ]] && ! cmp -s "$AGENT/$f" "$ROOT/$f"; then
    echo "[DIFF] $f"
    changed=1
    if [[ "$APPLY" == "--apply" ]]; then
      cp "$AGENT/$f" "$ROOT/$f"
      echo "  -> copied live -> repo"
    fi
  fi
done

if [[ "$changed" == "0" ]]; then
  echo "No repo-owned source differs between the live agent and this clone."
  echo "(Machine-local files — settings.json, models.json, model-thinking.json,"
  echo " pi-smart-btw.json, auth.json, memory/ — are intentionally not captured.)"
  exit 0
fi

if [[ "$APPLY" != "--apply" ]]; then
  echo
  echo "Re-run with --apply to copy live -> repo, then:"
  echo "  git add -A && git commit -m '<describe tweak>' && git push origin master"
  echo "  # then on each other machine:"
  echo "  cd ~/Projects/pi-harness-config && git pull && ./install.sh && ./scripts/harness-doctor.sh"
fi
