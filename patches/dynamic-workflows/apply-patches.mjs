#!/usr/bin/env node
// Idempotent patches against @quintinshaw/pi-dynamic-workflows/dist/workflow-tool.js.
// Slims the always-on `script` parameter description (~1,000 tokens) down to a
// compact pointer to the lazy-loaded workflow-authoring skill.
// Sentinel-guarded: safe to re-run after reinstalls/upgrades.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const agent = process.env.PI_AGENT_HOME || join(process.env.HOME, ".pi", "agent");
const root = join(agent, "npm", "node_modules", "@quintinshaw", "pi-dynamic-workflows");
const pkgFile = join(root, "package.json");
const expected = "3.5.1";

if (!existsSync(pkgFile)) throw new Error(`@quintinshaw/pi-dynamic-workflows missing: ${pkgFile}`);
const version = JSON.parse(readFileSync(pkgFile, "utf8")).version;
if (version !== expected) throw new Error(`dynamic-workflows patch supports ${expected}; found ${version}`);

const file = join(root, "dist", "workflow-tool.js");
let code = readFileSync(file, "utf8");
const MARKER = "SLIM_WORKFLOW_TOOL_PATCHED";

const COMPACT_DESCRIPTION = [
  "Raw JavaScript workflow script, with no Markdown fences. Required unless `name` is given.",
  "Must start with: export const meta = { name: 'short_snake_case', description: '...' }.",
  "Use agent(), parallel(), pipeline(), phase(), log(), budget, args, cwd. Plain JS only — no imports, require(), fs, Date.now(), Math.random(), or new Date(). Must call agent() at least once.",
  "Full authoring reference: read the workflow-authoring skill (and workflow-patterns for saved/built-in names).",
].join(" ");

// Newline-tolerant anchor: `script: Type.Optional(Type.String({` then `description: [ ...`
const START_OPEN = "script: Type.Optional(Type.String({";
const startOpenIdx = code.indexOf(START_OPEN);
if (startOpenIdx === -1) throw new Error("dynamic-workflows: script param anchor changed; refusing patch");

if (code.includes(MARKER)) {
  console.log(`OK dynamic-workflows ${version}: already slimmed (no-op)`);
  process.exit(0);
}

const startIdx = code.indexOf("description: [", startOpenIdx);
if (startIdx === -1 || startIdx > startOpenIdx + 80)
  throw new Error("dynamic-workflows: description array not found after script param; refusing patch");

const joinAnchor = '.join(" "),';
const endIdx = code.indexOf(joinAnchor, startIdx);
if (endIdx === -1) throw new Error("dynamic-workflows: joinAnchor not found; refusing patch");
const blockEnd = endIdx + joinAnchor.length;

const patched =
  code.slice(0, startIdx) +
  `description: ${JSON.stringify(COMPACT_DESCRIPTION)}, /* ${MARKER} */ ` +
  code.slice(blockEnd);

writeFileSync(file, patched, "utf8");
console.log(`OK dynamic-workflows ${version}: workflow tool script-description slimmed (~${Math.round((blockEnd - startIdx) / 4)} tokens reclaimed). Restart Pi to reload the tool schema.`);
