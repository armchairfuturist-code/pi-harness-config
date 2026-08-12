#!/usr/bin/env node
import fs from "fs";
import path from "path";

const skillsRoot = "/home/alex/.pi/agent/skills";
const dirs = fs
  .readdirSync(skillsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end < 0) return {};
  const block = text.slice(3, end).trim();
  const out = {};
  // simple yaml-ish: key: value / key: true
  let cur = null;
  let buf = [];
  const flush = () => {
    if (!cur) return;
    let v = buf.join("\n").trim();
    if (v === "true") v = true;
    else if (v === "false") v = false;
    else if (v.startsWith(">") || v.startsWith("|")) v = v.replace(/^[>|]-?\s*/, "").trim();
    else if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    out[cur] = v;
    cur = null;
    buf = [];
  };
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m && !line.startsWith(" ") && !line.startsWith("\t")) {
      flush();
      cur = m[1];
      buf = [m[2] ?? ""];
    } else if (cur) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

const modelInvocable = [];
const userOnly = [];
const missing = [];
const rows = [];

for (const name of dirs) {
  const p = path.join(skillsRoot, name, "SKILL.md");
  if (!fs.existsSync(p)) {
    missing.push(name);
    continue;
  }
  const text = fs.readFileSync(p, "utf8");
  const fm = parseFrontmatter(text);
  const dmi = fm["disable-model-invocation"];
  const desc = String(fm.description || "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  const bytes = fs.statSync(p).size;
  const modelCanInvoke = dmi !== true && dmi !== "true";
  rows.push({ name, dmi: dmi === true || dmi === "true", modelCanInvoke, bytes, desc });
  if (modelCanInvoke) modelInvocable.push(name);
  else userOnly.push(name);
}

const settings = JSON.parse(fs.readFileSync("/home/alex/.pi/agent/settings.json", "utf8"));

console.log(
  JSON.stringify(
    {
      settingsSkillsKey: settings.skills ?? null,
      settingsSkillsPresent: Object.prototype.hasOwnProperty.call(settings, "skills"),
      skillDirs: dirs.length,
      modelInvocableCount: modelInvocable.length,
      userOnlyCount: userOnly.length,
      missingSkillMd: missing,
      modelInvocable,
      userOnly,
      ceLite: rows.find((r) => r.name === "ce-lite") || null,
      betterHarness: rows.find((r) => r.name === "better-harness") || null,
      last30days: rows.find((r) => r.name === "last30days") || null,
      largestModelInvocable: rows
        .filter((r) => r.modelCanInvoke)
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 15)
        .map((r) => ({ name: r.name, bytes: r.bytes, desc: r.desc })),
    },
    null,
    2,
  ),
);
