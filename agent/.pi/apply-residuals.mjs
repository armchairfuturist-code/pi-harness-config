#!/usr/bin/env node
/**
 * Apply residual harness improvements (post-P0 re-audit).
 * last30days: on-demand skill — enable it; do not treat SKILL.md size as always-on tokens.
 */
import fs from "fs";
import path from "path";
import { execFileSync, spawnSync } from "child_process";

const AGENT = "/home/alex/.pi/agent";
const ROOT = "/home/alex/.pi";

function write(p, s) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s.endsWith("\n") ? s : s + "\n");
  console.log("wrote", p, Buffer.byteLength(s));
}

// --- 1) settings: enable all skills; wire local extensions ---
const settingsPath = path.join(AGENT, "settings.json");
const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

// On-demand skills are not always-on context — remove denylist entirely
delete settings.skills;

const wantExt = [
  "~/.pi/agent/npm/node_modules/@samfp/pi-essentials/src/auto-session-name.ts",
  "~/.pi/agent/npm/node_modules/@samfp/pi-essentials/src/auto-title.ts",
  "~/.pi/agent/npm/node_modules/@samfp/pi-essentials/src/clipboard-image.ts",
  "~/.pi/agent/npm/node_modules/@samfp/pi-essentials/src/compact-header.ts",
  "~/.pi/agent/npm/node_modules/@samfp/pi-essentials/src/image-context-pruner.ts",
  "~/.pi/agent/npm/node_modules/@samfp/pi-essentials/src/markdown-viewer.ts",
  "~/.pi/agent/extensions/transcript-pruner.ts",
  "~/.pi/agent/extensions/tool-trimmer.ts",
  "~/.pi/agent/extensions/session-index.ts",
  "~/.pi/agent/extensions/invest-tools.ts",
];
// pi-lean-ctx is a package + dir; only add if single entry .ts exists
const leanCtxCandidates = [
  path.join(AGENT, "extensions/pi-lean-ctx/index.ts"),
  path.join(AGENT, "extensions/pi-lean-ctx/extension.ts"),
  path.join(AGENT, "extensions/pi-lean-ctx.ts"),
];
for (const c of leanCtxCandidates) {
  if (fs.existsSync(c)) {
    wantExt.push(c.replace(AGENT, "~/.pi/agent"));
    break;
  }
}
settings.extensions = wantExt;
write(settingsPath, JSON.stringify(settings, null, 2));

// --- 2) HARNESS.md SoT ---
const harness = `# Pi agent harness contract

Source of truth for **agent-home** behavior. Installed/live path: \`~/.pi/agent/HARNESS.md\`.
Project/workspace maps belong in \`AGENTS.md\` (short). \`APPEND_SYSTEM.md\` is a thin CE-lite strip only.

## Skills policy

| Class | Rule |
|-------|------|
| **Always available** | All on-disk skills under \`skills/\` may load when invoked / matched |
| **On-demand / manual** | Large skills (e.g. \`last30days\`) are **not always-on context**. They cost tokens only when the skill is actually loaded/used. Do not deny them solely for SKILL.md size. |
| **Denied** | None by default. Prefer slim entry files over denylists when a skill is truly always-injected. |

- CE-lite orchestrates triggers (\`APPEND_SYSTEM.md\`).
- \`last30days\` tools also ship via package; skill entry is OK to enable because load is manual/on-demand.
- Keep top-level \`SKILL.md\` files lean when practical; move bulk to \`references/\` for maintainability (not because idle size burns tokens).

### Skill triage (high level)

| Always useful | On-demand | Meta / audit |
|---------------|-----------|--------------|
| ce-lite, better-harness | last30days, invest-optimizer, research skills | harness-doctor, poor-mans-distill, context-rot-forensics, shard-security, graph-engineering |
| pi-dynamic-workflows (pkg) | domain skills under skills/ | codebase-audit via workflow tool |

## Tool execution policy

1. Prefer \`ctx_read\` / \`ctx_edit\` / \`ctx_execute\` / \`ctx_batch_execute\` / \`ctx_grep\` / \`ctx_find\` / \`ctx_ls\` over raw shell.
2. Never \`python -c\`, \`python3 -c\`, or shell heredoc into interpreters. Write a script file, then run it.
3. On edit "could not find": **never** retry identical text. Re-read the slice; or \`sed\`/\`perl\` via shell only when allowed.
4. After multi-file edits: cheap verify (search, JSON parse, targeted test) before done.
5. After first shell allowlist block: switch strategy; do not loop the same blocked shape.
6. \`lean-ctx allow\` only for rare audited commands.

## Extensions (enabled)

settings.extensions should include:

- pi-essentials: auto-session-name, auto-title, clipboard-image, compact-header, image-context-pruner, markdown-viewer
- local: transcript-pruner, tool-trimmer, session-index, invest-tools

If an extension is documented here, it must appear in \`settings.json\`. No half-wired paths.

## Session hygiene

- Sessions >60 minutes or 3+ compactions: mid-flight status + end checklist (done/blocked, files, verify).
- Do not claim completion without a verification artifact when changes were made.
- session-index writes extractive summaries under \`memory/sessions/\` on shutdown — keep that enabled.

## Git / versioning

Track harness **intent**, not runtime debris.

| Track | Ignore |
|-------|--------|
| settings.json, HARNESS.md, AGENTS.md, APPEND_SYSTEM.md | sessions/ |
| skills/** (text sources) | skills/**/assets/ (media binaries) |
| agents/**, extensions source/config | npm/, node_modules/, .pi/, agent/git/ |
| context-prune/** | .env*, logs, dist/build, __pycache__ |

## Preflight

Run before committing harness changes:

\`\`\`bash
~/.pi/agent/scripts/harness-preflight.sh
\`\`\`

Checks: settings.json parse, no blanket \`!**\` skills deny, HARNESS/APPEND present, extension paths resolve, skills dirs exist.

## Inventory

Regenerate after skill/extension/settings mutations:

\`\`\`bash
python3 ~/.pi/agent/skills/harness-doctor/scripts/inventory.py
\`\`\`

Writes \`harness-inventory.json\`. Optional — may be gitignored; command is the source of truth.
`;
write(path.join(AGENT, "HARNESS.md"), harness);

// --- 3) AGENTS.md short pointer (project map if needed elsewhere) ---
const agentsMd = `# Pi agent home

This is the Pi agent harness directory (\`~/.pi/agent\`).

**Harness contract (SoT):** [HARNESS.md](./HARNESS.md) — skills policy, tools, extensions, session hygiene, git, preflight.

**CE-lite strip:** [APPEND_SYSTEM.md](./APPEND_SYSTEM.md) — triggers only; do not duplicate tool policy here.

## Quick pointers

- Prefer \`ctx_*\` tools; never \`python -c\` / shell heredoc into interpreters.
- \`last30days\` is on-demand (not always-on tokens). Load only when researching recent discourse.
- Before commit: \`scripts/harness-preflight.sh\`
- After skill/ext changes: \`python3 skills/harness-doctor/scripts/inventory.py\`

## Custom agents

- \`agents/Explore.md\` — general explore path.
- Add specialized agents only with a clear tool allowlist and purpose.
`;
write(path.join(AGENT, "AGENTS.md"), agentsMd);

// --- 4) APPEND_SYSTEM thin ---
const append = `CE-lite: answer simple questions directly; for non-trivial work read ~/.pi/agent/skills/ce-lite/SKILL.md and follow it. Harness SoT: ~/.pi/agent/HARNESS.md. Call the workflow tool proactively: \`name\` = built-in pattern (deep-research, adversarial-review, code-review, multi-perspective, codebase-audit); for custom scripts first read pi-dynamic-workflows' workflow-authoring skill. Be terse: no preamble, no recap, never restate the task, no markdown headers unless asked, no emoji. Answer in <=60 words unless the task requires more.
Minimize round-trips: batch independent tool calls; never re-read or re-verify what you just wrote; when the task is done, stop.
On edit-tool "could not find" failure: never retry identical text — fall back to sed/perl via ctx_shell immediately. Prefer ctx_* over raw shell. Never python -c or shell heredoc — write a script file, then run it. After first allowlist block, switch strategy.
Triggers:
- "check health"/"audit system" → harness-doctor
- "optimize"/"improve tokens" → poor-mans-distill
- "secure this"/"sandbox" → shard-security
- "why is context bad"/"rot" → context-rot-forensics
- "custom topology"/"DAG" → graph-engineering
- "audit this project"/"review architecture" → workflow: codebase-audit
- "last 30 days"/"what are people saying" → last30days (on-demand skill/tools; not always-on context)
`;
write(path.join(AGENT, "APPEND_SYSTEM.md"), append);

// --- 5) gitignore ---
const gi = `# Config repo: ignore everything by default, then whitelist harness intent.
*

# Allow directory traversal for nested un-ignores
!*/

# Root meta
!.gitignore
!README.md
!tscg.json

# Agent durable config
!agent/settings.json
!agent/AGENTS.md
!agent/HARNESS.md
!agent/APPEND_SYSTEM.md
!agent/SYSTEM.md
!agent/skills/**
!agent/agents/**
!agent/extensions/**
!agent/context-prune/**
!agent/scripts/**

# Ephemeral / heavy / secrets (re-ignore even under whitelists)
agent/sessions/
agent/npm/
agent/git/
agent/**/node_modules/
agent/.pi/
agent/**/.pi/
agent/**/dist/
agent/**/build/
agent/skills/**/assets/
agent/memory/
**/.env
**/.env.*
!**/.env.example
**/*.log
**/.DS_Store
**/__pycache__/
**/*.py[cod]
**/*.pyc

# better-harness work
**/.pi/better-harness/_run/
**/.pi/better-harness-work/
`;
write(path.join(ROOT, ".gitignore"), gi);

// --- 6) preflight script ---
const preflight = `#!/usr/bin/env bash
# harness-preflight — cheap gate for ~/.pi/agent harness intent
set -euo pipefail
AGENT="\${PI_AGENT_HOME:-$HOME/.pi/agent}"
ERR=0
ok() { printf 'OK  %s\\n' "$*"; }
bad() { printf 'BAD %s\\n' "$*"; ERR=1; }

# settings.json
if [[ ! -f "\$AGENT/settings.json" ]]; then
  bad "missing settings.json"
else
  if node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "\$AGENT/settings.json" 2>/dev/null; then
    ok "settings.json parses"
  else
    bad "settings.json invalid JSON"
  fi
  if node -e "
const s=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
const sk=s.skills;
if(Array.isArray(sk) && sk.some(x=>x==='!**'||x==='!***')) { console.error('blanket deny'); process.exit(2); }
" "\$AGENT/settings.json" 2>/dev/null; then
    ok "skills filter has no blanket !**"
  else
    bad "skills filter contains blanket !** denylist"
  fi
fi

# contracts
for f in HARNESS.md APPEND_SYSTEM.md AGENTS.md; do
  if [[ -f "\$AGENT/\$f" ]]; then ok "\$f present"; else bad "missing \$f"; fi
done

# extensions resolve
if [[ -f "\$AGENT/settings.json" ]]; then
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
" "\$AGENT/settings.json" && ok "extension paths resolve" || bad "one or more extension paths missing"
fi

# skills dir
if [[ -d "\$AGENT/skills" ]]; then
  n=\$(find "\$AGENT/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  ok "skills dirs: \$n"
else
  bad "skills/ missing"
fi

if [[ "\$ERR" -ne 0 ]]; then
  echo "preflight FAILED" >&2
  exit 1
fi
echo "preflight OK"
`;
write(path.join(AGENT, "scripts/harness-preflight.sh"), preflight);
fs.chmodSync(path.join(AGENT, "scripts/harness-preflight.sh"), 0o755);

console.log("apply-residuals content done");
