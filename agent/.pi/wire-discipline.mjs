import fs from "fs";
import path from "path";

const agent = "/home/alex/.pi/agent";
const settingsPath = path.join(agent, "settings.json");
const s = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

const ext = "~/.pi/agent/extensions/runtime-discipline.ts";
const list = Array.isArray(s.extensions) ? [...s.extensions] : [];
if (!list.includes(ext)) list.push(ext);
s.extensions = list;
fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2) + "\n");
console.log("extensions", s.extensions.length, "has discipline", list.includes(ext));

// Strengthen HARNESS sections without rewriting whole file if possible
const harnessPath = path.join(agent, "HARNESS.md");
let h = fs.readFileSync(harnessPath, "utf8");
if (!h.includes("runtime-discipline")) {
  h = h.replace(
    "## Extensions (enabled)",
    `## Runtime discipline (enforced)

Extension \`extensions/runtime-discipline.ts\` injects systemPrompt nudges when:

1. **Allowlist / interpreter block** — after lean-ctx permanent blocks (\`python -c\`, heredoc, etc.). Recovery: script file + ctx_* tools; never identical retry.
2. **Edit miss** — after edit/ctx_edit context failures. Recovery: re-read slice; never identical old_string retry; cheap verify after multi-file edits.
3. **Long session** — after 60 minutes, 24 user turns, or 3+ compactions: require status block (status/done_so_far/files/next/verify). On close: end checklist with verify artifact.

Disable: \`PI_RUNTIME_DISCIPLINE=0\`. Thresholds: \`PI_LONG_SESSION_MS\`, \`PI_LONG_SESSION_TURNS\`, \`PI_LONG_SESSION_COMPACTS\`.

## Extensions (enabled)`,
  );
  h = h.replace(
    "- local: transcript-pruner, tool-trimmer, session-index, invest-tools",
    "- local: transcript-pruner, tool-trimmer, session-index, invest-tools, **runtime-discipline**",
  );
  fs.writeFileSync(harnessPath, h.endsWith("\n") ? h : h + "\n");
  console.log("HARNESS updated");
}

// APPEND_SYSTEM — one line pointer to runtime-discipline
const appendPath = path.join(agent, "APPEND_SYSTEM.md");
let a = fs.readFileSync(appendPath, "utf8");
if (!a.includes("runtime-discipline")) {
  a = a.replace(
    "After first allowlist block, switch strategy.",
    "After first allowlist block, switch strategy. Runtime-discipline extension enforces allowlist/edit-miss recovery and long-session status/end checklists.",
  );
  fs.writeFileSync(appendPath, a.endsWith("\n") ? a : a + "\n");
  console.log("APPEND updated");
}

// preflight: ensure runtime-discipline path exists when listed
const pre = path.join(agent, "scripts/harness-preflight.sh");
console.log("preflight script exists", fs.existsSync(pre));
console.log("discipline file exists", fs.existsSync(path.join(agent, "extensions/runtime-discipline.ts")));
