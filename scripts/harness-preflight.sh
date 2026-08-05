#!/usr/bin/env bash
# harness-preflight — cheap gate for ~/.pi/agent harness intent
set -euo pipefail
AGENT="${PI_AGENT_HOME:-$HOME/.pi/agent}"
ERR=0
ok() { printf 'OK  %s\n' "$*"; }
bad() { printf 'BAD %s\n' "$*"; ERR=1; }

# settings.json
if [[ ! -f "$AGENT/settings.json" ]]; then
  bad "missing settings.json"
else
  if node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$AGENT/settings.json" 2>/dev/null; then
    ok "settings.json parses"
  else
    bad "settings.json invalid JSON"
  fi
  if node -e "
const s=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
const sk=s.skills;
if(Array.isArray(sk) && sk.some(x=>x==='!**'||x==='!***')) { console.error('blanket deny'); process.exit(2); }
" "$AGENT/settings.json" 2>/dev/null; then
    ok "skills filter has no blanket !**"
  else
    bad "skills filter contains blanket !** denylist"
  fi
fi

# contracts
for f in HARNESS.md APPEND_SYSTEM.md AGENTS.md; do
  if [[ -f "$AGENT/$f" ]]; then ok "$f present"; else bad "missing $f"; fi
done

# extensions resolve
if [[ -f "$AGENT/settings.json" ]]; then
  node -e "
const fs=require('fs'); const path=require('path'); const os=require('os');
const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const exts=s.extensions||[];
let bad=0;
for (const e of exts) {
  const p=e.replace(/^~/, os.homedir());
  if (!fs.existsSync(p)) { console.error('missing ext', e); bad++; }
}
process.exit(bad?2:0);
" "$AGENT/settings.json" && ok "extension paths resolve" || bad "one or more extension paths missing"
fi

# skills dir
if [[ -d "$AGENT/skills" ]]; then
  n=$(find "$AGENT/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  ok "skills dirs: $n"
else
  bad "skills/ missing"
fi

if [[ "$ERR" -ne 0 ]]; then
  echo "preflight FAILED" >&2
  exit 1
fi
echo "preflight OK"
