#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${PI_AGENT_HOME:-$HOME/.pi/agent}"
ERR=0
ok() { printf 'OK %s\n' "$*"; }
bad() { printf 'BAD %s\n' "$*" >&2; ERR=1; }

# Guard: the repo must not be checked out at ~/.pi — that directory is the live
# agent parent (agent/ + settings.json). Running git here (reset --hard, clean,
# checkout, branch switch) can delete or overwrite the live agent home, because
# origin/master does not track agent/ (it is deploy output, written by
# install.sh). The canonical clone lives elsewhere (e.g. ~/Projects/pi-harness-config);
# apply changes with: git pull && ./install.sh && ./scripts/harness-doctor.sh
# Only enforced on the git pre-push path (CI_PRE_PUSH=1), so install.sh --check
# and harness-doctor keep working when run from the live agent.
if [[ "${CI_PRE_PUSH:-0}" == "1" ]] && [[ "$ROOT" == "$HOME/.pi" || "$ROOT" == "$HOME/.pi/" ]]; then
  bad "repo checked out at live agent parent $ROOT — move clone to ~/Projects/pi-harness-config; never run git here"
fi

if [[ -f "$ROOT/install.sh" ]]; then node "$ROOT/scripts/validate-manifest.mjs" && ok "repo manifest closes" || bad "repo manifest mismatch"; fi
PI_PACKAGE_LOCK="$AGENT/packages.lock.json" node "$ROOT/scripts/verify-package-lock.mjs" && ok "package versions pinned" || bad "package lock mismatch"
node "$ROOT/scripts/validate-live-settings.mjs" "$AGENT/settings.json" && ok "settings and extension paths resolve" || bad "settings/extension mismatch"
for file in HARNESS.md APPEND_SYSTEM.md AGENTS.md; do [[ -f "$AGENT/$file" ]] && ok "$file present" || bad "$file missing"; done

CM="$AGENT/npm/node_modules/context-mode/build/adapters/pi"
grep -q 'PI_HARNESS_ADMIN_TOOLS_REMOVED' "$CM/mcp-bridge.js" 2>/dev/null && ok "context-mode schema patch" || bad "context-mode schema patch missing"
grep -q 'PI_HARNESS_ADMIN_ROUTING_REMOVED' "$CM/extension.js" 2>/dev/null && ok "context-mode routing patch" || bad "context-mode routing patch missing"
grep -q 'PI_HARNESS_TSCG_DEEP' "$AGENT/npm/node_modules/pi-tscg/extensions/tscg.ts" 2>/dev/null && ok "TSCG recursive patch" || bad "TSCG recursive patch missing"

# Harness skills must live only under agent/skills. When cwd=$HOME, Pi loads
# ~/.pi/skills as "project" skills and collides with agent copies.
HARNESS_SKILLS="harness-doctor context-rot-forensics graph-engineering shard-security"
for name in $HARNESS_SKILLS; do
  if [[ -e "$HOME/.pi/skills/$name" ]]; then
    bad "skill shadow $HOME/.pi/skills/$name (collides with agent/skills/$name)"
  else
    ok "no project skill shadow: $name"
  fi
  if [[ -f "$AGENT/skills/$name/SKILL.md" ]]; then
    ok "agent skill present: $name"
  else
    bad "agent skill missing: $name"
  fi
done

if grep -RqiE 'invest-tools|invest_pulse|invest_optimize|invest_risk|invest-optimizer' "$AGENT/settings.json" "$AGENT/APPEND_SYSTEM.md" "$AGENT/HARNESS.md" "$AGENT/extensions" 2>/dev/null; then bad "personal investment tooling present in active harness"; else ok "generic active harness"; fi

# Daemon-phantom watchdog (#930): the tool_profile controls how many tool
# schemas are injected per turn (power=82 schemas ~+12.7k tok; lean=12 ~+2.9k).
# lean-ctx persists the ACTIVE profile in its own state (not config.toml — the
# config.toml key only accepts minimal|standard|power, so "lean"/"auto" there
# would be ignored). The authoritative check is the runtime profile reported by
# a fresh 'lean-ctx tools show'. We verify (a) the repo pins a profile, and
# (b) the live runtime matches it.
WANT_PROFILE=$(grep -E '^tool_profile' "$ROOT/lean-ctx/config.toml" 2>/dev/null | sed -E 's/.*"([^"]+)".*/\1/')
if [[ -z "$WANT_PROFILE" ]]; then
  bad "repo tool_profile not pinned in lean-ctx/config.toml"
elif ! command -v lean-ctx >/dev/null 2>&1; then
  bad "lean-ctx CLI not found (cannot verify tool profile)"
else
  RUNTIME_PROFILE=$(lean-ctx tools show 2>/dev/null | sed -nE 's/^Tool Profile: ([a-z]+).*/\1/p' | head -1)
  if [[ -z "$RUNTIME_PROFILE" ]]; then
    bad "could not read lean-ctx runtime tool profile"
  elif [[ "$RUNTIME_PROFILE" == "$WANT_PROFILE" ]]; then
    ok "tool profile pinned (runtime): $RUNTIME_PROFILE"
  else
    bad "tool profile drift: runtime=$RUNTIME_PROFILE repo=$WANT_PROFILE — run 'lean-ctx tools $WANT_PROFILE'"
  fi
fi

# Extension drift (warn-only): surface available updates without blocking the
# build. Pinned packages are flagged by the script itself.
if command -v node >/dev/null 2>&1 && [[ -f "$ROOT/scripts/check-extension-updates.sh" ]]; then
  DRIFT=$("$ROOT/scripts/check-extension-updates.sh" --json 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);const u=r.filter(x=>x.status==='UPDATE');if(u.length)console.log(u.map(x=>x.pkg+'@'+x.latest).join(', '))}catch(e){}})" 2>/dev/null)
  [[ -n "$DRIFT" ]] && echo "note: extension updates available (warn-only): $DRIFT"
fi

[[ "$ERR" -eq 0 ]] || { echo "preflight FAILED" >&2; exit 1; }
echo "preflight OK"
