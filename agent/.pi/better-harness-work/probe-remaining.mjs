import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const agent = "/home/alex/.pi/agent";
const out = {};

// settings
const settings = JSON.parse(fs.readFileSync(path.join(agent, "settings.json"), "utf8"));
out.skillsFilter = settings.skills;
out.packages = (settings.packages || []).length;
out.extensionsSettings = (settings.extensions || []).length;
out.model = `${settings.defaultProvider}/${settings.defaultModel}`;

// skills on disk
const skillDirs = fs
  .readdirSync(path.join(agent, "skills"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
out.skillsOnDisk = skillDirs.length;
out.skills = skillDirs;
const l30 = path.join(agent, "skills/last30days/SKILL.md");
out.last30daysBytes = fs.existsSync(l30) ? fs.statSync(l30).size : null;

// guidance
out.has = {
  AGENTS: fs.existsSync(path.join(agent, "AGENTS.md")),
  HARNESS: fs.existsSync(path.join(agent, "HARNESS.md")),
  SYSTEM: fs.existsSync(path.join(agent, "SYSTEM.md")),
  APPEND: fs.existsSync(path.join(agent, "APPEND_SYSTEM.md")),
};
for (const k of ["AGENTS.md", "HARNESS.md", "APPEND_SYSTEM.md"]) {
  const p = path.join(agent, k);
  if (fs.existsSync(p)) out[`${k}_bytes`] = fs.statSync(p).size;
}

// extensions dual path
const extDir = path.join(agent, "extensions");
out.extDir = fs.existsSync(extDir)
  ? fs.readdirSync(extDir).filter((n) => !n.startsWith("."))
  : [];
out.extSettings = settings.extensions || [];

// agents
const agentsDir = path.join(agent, "agents");
out.agents = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir) : [];

// inventory age
const inv = path.join(agent, "harness-inventory.json");
if (fs.existsSync(inv)) {
  const j = JSON.parse(fs.readFileSync(inv, "utf8"));
  out.inventoryGenerated = j.generated || j.generatedAt || null;
}

// session independent sample
const sessionsRoot = path.join(agent, "sessions");
function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith(".jsonl")) acc.push(p);
  }
  return acc;
}
const files = walk(sessionsRoot)
  .map((p) => ({ p, m: fs.statSync(p).mtimeMs }))
  .sort((a, b) => b.m - a.m)
  .slice(0, 20);

let toolCalls = 0,
  toolResults = 0,
  isErr = 0,
  allow = 0,
  editMiss = 0;
const tools = {};
const afterFixCutoff = Date.parse("2026-08-05T06:56:00Z");
let sessionsAfterFix = 0;
let toolsAfterFix = 0;

for (const { p, m } of files) {
  const after = m >= afterFixCutoff;
  if (after) sessionsAfterFix++;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type !== "message") continue;
    const msg = o.message || {};
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c && c.type === "toolCall") {
          toolCalls++;
          if (after) toolsAfterFix++;
          tools[c.name || "?"] = (tools[c.name || "?"] || 0) + 1;
        }
      }
    }
    if (msg.role === "toolResult") {
      toolResults++;
      const text = Array.isArray(msg.content)
        ? msg.content.map((x) => x?.text || "").join(" ")
        : String(msg.content || "");
      const low = text.toLowerCase();
      if (msg.isError || msg.error) isErr++;
      if (low.includes("allowlist") || low.includes("blocked — do not retry") || low.includes("[blocked"))
        allow++;
      if (low.includes("could not find") || low.includes("edit") && low.includes("not find"))
        editMiss++;
    }
  }
}

out.sessionSample = {
  files: files.length,
  toolCalls,
  toolResults,
  isErr,
  allowBlocksApprox: allow,
  editMissApprox: editMiss,
  topTools: Object.entries(tools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12),
  sessionsAfterFix,
  toolsAfterFix,
};

// git
try {
  out.gitTrackedAgent = execSync("git -C /home/alex/.pi ls-files agent | wc -l", {
    encoding: "utf8",
  }).trim();
  out.gitRemote = execSync("git -C /home/alex/.pi remote -v", { encoding: "utf8" }).trim();
} catch (e) {
  out.gitError = String(e.message || e);
}

const work = fs.readFileSync("/home/alex/.pi/agent/.pi/better-harness-work/LATEST", "utf8").trim();
fs.writeFileSync(path.join(work, "probe-remaining.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
