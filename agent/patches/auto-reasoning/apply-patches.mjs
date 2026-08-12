#!/usr/bin/env node
// Idempotent patch against @howaboua/pi-auto-reasoning-tool@0.1.11.
//
// Two changes:
//  1. Extend the change_reasoning level enum (low|medium|high -> low|medium|
//     high|xhigh|max) so the agent can actually reach xhigh/max. Without this
//     the tool schema caps every request at "high"; xhigh/max are impossible.
//  2. Auto-escalate reasoning from the user's baseline based on prompt
//     complexity at agent_start. agent_settled already restores the baseline,
//     so cost stays proportional to query difficulty: trivial queries keep the
//     cheap baseline, genuinely hard queries get high/xhigh/max without a
//     manual tool call.
//
// Kill switch / tuning (env):
//   PI_AUTO_REASONING_DISABLE=1  -> no automatic escalation (agent-only again).
//   PI_AUTO_REASONING_MAX=high   -> cap automatic escalation (default: max).
//
// Sentinel-guarded: re-run after reinstalls/upgrades is a no-op.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const agent = process.env.PI_AGENT_HOME || join(process.env.HOME, ".pi", "agent");
const root = join(agent, "npm", "node_modules", "@howaboua", "pi-auto-reasoning-tool");
const pkgFile = join(root, "package.json");
const expected = "0.1.11";
if (!existsSync(pkgFile)) throw new Error(`@howaboua/pi-auto-reasoning-tool missing: ${pkgFile}`);
const version = JSON.parse(readFileSync(pkgFile, "utf8")).version;
if (version !== expected) throw new Error(`auto-reasoning patch supports ${expected}; found ${version}`);

const file = join(root, "src", "index.ts");
const code = readFileSync(file, "utf8");
const MARKER = "HARNESS_AUTO_REASONING_PATCHED";
if (code.includes(MARKER)) {
  console.log(`OK auto-reasoning ${version}: already patched (no-op)`);
  process.exit(0);
}

// --- 1. Extend the type + enum ---------------------------------------------
let patched = code;
const enumRe = /type ToolReasoningLevel = "low" \| "medium" \| "high";/;
if (!enumRe.test(patched)) throw new Error("auto-reasoning: ToolReasoningLevel anchor changed; refusing patch");
patched = patched.replace(
  enumRe,
  `type ToolReasoningLevel = "low" | "medium" | "high" | "xhigh" | "max"; /* ${MARKER} */`
);
// Extend the array literal (adds xhigh/max to whatever it currently holds).
const arrRe = /const TOOL_REASONING_LEVELS = \[([\s\S]*?)\] as const;/;
if (!arrRe.test(patched)) throw new Error("auto-reasoning: TOOL_REASONING_LEVELS anchor changed; refusing patch");
// Always replace the array literal with the full 5-level set (the tool schema
// reads THIS array; the type above is only compile-time). Run before any
// "xhigh" appears in the file so the guard can't self-match.
patched = patched.replace(arrRe, `const TOOL_REASONING_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;`);

// --- 2. Inject heuristic before export default ------------------------------
const heuristic = [
  `// === [auto-reasoning] harness heuristic start ===`,
  `let harness_lastPrompt: string | undefined;`,
  `function harness_scorePromptComplexity(prompt: string): number { let s = 0; if (!prompt) return 0; const t = prompt.trim(); if (t.length > 700) s += 1; if (t.length > 2200) s += 1; if ((t.match(/\`\`\`/g) || []).length >= 2) s += 1; const stronger = /(\\b(debug|trac(e|ing)|refactor|fix|optimiz|performance|security|race condition|deadlock|concurr|asyn|proof|prove|review|legacy|foreign|unfamiliar|complex|complicated|deduplicat|investigat|diagnos)\\b)/i; if (stronger.test(t)) s += 2; const subparts = (t.match(/[^\\n]{0,120}[?]\\s*$/gm) || []).length; if (subparts >= 3) s += 1; if (/^[-*\\d.]/m.test(t)) s += 1; return s; }`,
  `function harness_autoReasoningLevel(baselineLevel: AppliedReasoningLevel): AppliedReasoningLevel | undefined { if (process.env.PI_AUTO_REASONING_DISABLE === "1") return undefined; if (!harness_lastPrompt) return undefined; const s = harness_scorePromptComplexity(harness_lastPrompt); const want = s >= 6 ? "max" as AppliedReasoningLevel : s >= 4 ? "xhigh" as AppliedReasoningLevel : s >= 2 ? "high" as AppliedReasoningLevel : undefined; if (!want) return undefined; const cap = (process.env.PI_AUTO_REASONING_MAX || "max") as AppliedReasoningLevel; const capped = REASONING_LEVELS.indexOf(want) > REASONING_LEVELS.indexOf(cap) ? cap : want; return applyReasoningFloor(capped as ToolReasoningLevel, baselineLevel); }`,
  `// === [auto-reasoning] harness heuristic end ===`,
].join("\n");
const fnAnchor = `export default function autoReasoningSelector(pi: ExtensionAPI) {`;
if (!patched.includes(fnAnchor)) throw new Error("auto-reasoning: export default anchor changed; refusing patch");
// Replace the anchor text with a string (NOT via toSource/regex-to-string, which
// would inject a literal "/.../" and destroy the declaration).
patched = patched.replace(fnAnchor, heuristic + "\n\n" + fnAnchor);

// --- 3. before_agent_start captures prompt; agent_start escalates ------------
const beforeRe = /pi\.on\("before_agent_start", async \(\) => \{(\s*)turnBaselineReasoningLevel \?\?= pi\.getThinkingLevel\(\);(\s*)\}\);(\s*)pi\.on\("agent_start", async \(\) => \{(\s*)turnBaselineReasoningLevel \?\?= pi\.getThinkingLevel\(\);(\s*)\}\);(\s*)\};/;
// Fall back to a looser match for the compound handler pair.
let beforeBlock = /pi\.on\("before_agent_start", async \(\) => \{[\s\S]*?\}\);\s*pi\.on\("agent_start", async \(\) => \{[\s\S]*?\}\);/;
if (!beforeBlock.test(patched)) throw new Error("auto-reasoning: before_agent_start/agent_start anchors changed; refusing patch");
const beforeNew = [
  `pi.on("before_agent_start", async (event) => {`,
  `\tconst prompt = event?.prompt ?? (event?.task ?? "");`,
  `\tharness_lastPrompt = Array.isArray(prompt) ? prompt.map((p: any) => typeof p === "string" ? p : JSON.stringify(p)).join("\\n") : String(prompt ?? "");`,
  `\tturnBaselineReasoningLevel ??= pi.getThinkingLevel();`,
  `});`,
  `pi.on("agent_start", async () => {`,
  `\tturnBaselineReasoningLevel ??= pi.getThinkingLevel();`,
  `\tconst nl = harness_autoReasoningLevel(turnBaselineReasoningLevel ?? "low");`,
  `\tif (nl && nl !== pi.getThinkingLevel()) { pi.setThinkingLevel(nl); }`,
  `});`,
].join("\n");
patched = patched.replace(beforeBlock, beforeNew);

// --- 4. agent_settled: also clear transient prompt state ---------------------
const settledRe = /pi\.on\("agent_settled", async \(\) => \{([\s\S]*?)turnBaselineReasoningLevel = undefined;([\s\S]*?)pi\.setThinkingLevel\(levelToRestore\);([\s\S]*?)\}\);/;
if (!settledRe.test(patched)) throw new Error("auto-reasoning: agent_settled anchor changed; refusing patch");
patched = patched.replace(settledRe, (m, a, b, c) => {
  return `pi.on("agent_settled", async () => {${a}turnBaselineReasoningLevel = undefined;${b}harness_lastPrompt = undefined;${c}pi.setThinkingLevel(levelToRestore);});`;
});

writeFileSync(file, patched, "utf8");
console.log(`OK auto-reasoning ${version}: enum=>xhigh/max + prompt auto-escalation (kill: PI_AUTO_REASONING_DISABLE=1, cap: PI_AUTO_REASONING_MAX). Restart Pi to reload.`);
