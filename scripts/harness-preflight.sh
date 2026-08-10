#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${PI_AGENT_HOME:-$HOME/.pi/agent}"
ERR=0
ok() { printf 'OK %s\n' "$*"; }
bad() { printf 'BAD %s\n' "$*" >&2; ERR=1; }

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
HARNESS_SKILLS="ce-lite harness-doctor context-rot-forensics graph-engineering poor-mans-distill shard-security"
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

# Daemon-phantom watchdog (#930): a fresh lean-ctx daemon booting on defaults
# (tool_profile=power) balloons the tool surface ~12 -> ~82 schemas and adds
# ~10k tok/turn. Verify the live config matches the repo's pinned profile.
WANT_PROFILE=$(grep -E '^tool_profile' "$ROOT/lean-ctx/config.toml" 2>/dev/null | sed -E 's/.*"([^"]+)".*/\1/')
LIVE_TOML="$HOME/.config/lean-ctx/config.toml"
if [[ -z "$WANT_PROFILE" ]]; then bad "repo tool_profile not pinned in lean-ctx/config.toml"
elif [[ ! -f "$LIVE_TOML" ]]; then bad "live lean-ctx config.toml missing"
else GOT_PROFILE=$(grep -E '^tool_profile' "$LIVE_TOML" 2>/dev/null | sed -E 's/.*"([^"]+)".*/\1/')
  if [[ "$GOT_PROFILE" == "$WANT_PROFILE" ]]; then ok "tool profile pinned: $GOT_PROFILE"
  else bad "tool profile drift: live=$GOT_PROFILE repo=$WANT_PROFILE (daemon phantom #930)"
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
