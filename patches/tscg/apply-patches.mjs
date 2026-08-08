#!/usr/bin/env node
// Idempotent patches against pi-tscg/extensions/tscg.ts.
// Each block is guarded by a sentinel so re-runs are safe.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const agent = process.env.PI_AGENT_HOME || join(process.env.HOME, ".pi", "agent");
const root = join(agent, "npm", "node_modules", "pi-tscg");
const pkgFile = join(root, "package.json");
const expected = "0.2.4";
if (!existsSync(pkgFile)) throw new Error(`pi-tscg missing: ${pkgFile}`);
const version = JSON.parse(readFileSync(pkgFile, "utf8")).version;
if (version !== expected)
  throw new Error(`pi-tscg patch supports ${expected}; found ${version}`);
const file = join(root, "extensions", "tscg.ts");
let code = readFileSync(file, "utf8");

// --- Step 1: deep recursive description truncation (existing) -------------
if (!code.includes("PI_HARNESS_TSCG_DEEP")) {
  const start = code.indexOf("function truncateLongDescriptions(");
  const stop = code.indexOf("\nfunction truncate(", start);
  if (start < 0 || stop < 0)
    throw new Error("pi-tscg function shape changed; refusing patch (step 1)");
  const replacement =
    "function truncateLongDescriptions(t: AnyToolDefinition, maxChars: number): AnyToolDefinition {\n" +
    "\t// PI_HARNESS_TSCG_DEEP: recursively truncate nested parameter descriptions.\n" +
    "\tfunction truncateDeep(obj: unknown): unknown {\n" +
    '\t\tif (obj === null || typeof obj !== "object") return obj;\n' +
    "\t\tif (Array.isArray(obj)) return obj.map(truncateDeep);\n" +
    "\t\tconst result: Record<string, unknown> = {};\n" +
    "\t\tfor (const [key, value] of Object.entries(obj as Record<string, unknown>)) {\n" +
    '\t\t\tresult[key] = key === "description" && typeof value === "string" ? truncate(value, maxChars) : truncateDeep(value);\n' +
    "\t\t}\n" +
    "\t\treturn result;\n" +
    "\t}\n" +
    "\tlet next = setDescription(t, truncate(getDescription(t), maxChars));\n" +
    "\tconst props = getParamProperties(next);\n" +
    "\tif (props) next = setParamProperties(next, truncateDeep(props) as Record<string, unknown>);\n" +
    "\treturn next;\n" +
    "}\n";
  code = code.slice(0, start) + replacement + code.slice(stop + 1);
  console.log("  step 1: deep truncateLongDescriptions applied");
}

// --- Step 2: interface field ---------------------------------------------
if (!code.includes("aggressiveStripParamDesc")) {
  const needle = "\taggressiveMaxDescChars: number;\n";
  const idx = code.indexOf(needle);
  if (idx < 0) throw new Error("pi-tscg interface shape changed (step 2)");
  code =
    code.slice(0, idx + needle.length) +
    "\t// Iter-6 lever: drop parameter descriptions entirely in aggressive mode.\n\taggressiveStripParamDesc: boolean;\n" +
    code.slice(idx + needle.length);
  console.log("  step 2: interface field added");
}

// --- Step 3: default value ------------------------------------------------
{
  const needle = "\taggressiveMaxDescChars: 150,\n";
  const idx = code.indexOf(needle);
  if (idx < 0) throw new Error("pi-tscg defaults shape changed (step 3)");
  if (!code.includes("aggressiveStripParamDesc: false,")) {
    code =
      code.slice(0, idx + needle.length) +
      "\taggressiveStripParamDesc: false,\n" +
      code.slice(idx + needle.length);
    console.log("  step 3: default added");
  }
}

// --- Step 4: stripParamDescriptions helper -------------------------------
if (!code.includes("PI_HARNESS_TSCG_STRIP")) {
  const anchor = "function truncateLongDescriptions(";
  const idx = code.indexOf(anchor);
  if (idx < 0) throw new Error("pi-tscg anchor missing (step 4)");
  const helper =
    "function stripParamDescriptions(t: AnyToolDefinition, maxChars: number): AnyToolDefinition {\n" +
    "\t// PI_HARNESS_TSCG_STRIP: drop every parameter description; keep top-level purpose (truncated).\n" +
    "\tfunction stripDeep(obj: unknown): unknown {\n" +
    '\t\tif (obj === null || typeof obj !== "object") return obj;\n' +
    "\t\tif (Array.isArray(obj)) return obj.map(stripDeep);\n" +
    "\t\tconst result: Record<string, unknown> = {};\n" +
    "\t\tfor (const [key, value] of Object.entries(obj as Record<string, unknown>)) {\n" +
    '\t\t\tif (key === "description") continue;\n' +
    "\t\t\tresult[key] = stripDeep(value);\n" +
    "\t\t}\n" +
    "\t\treturn result;\n" +
    "\t}\n" +
    "\tlet next = setDescription(t, truncate(getDescription(t), maxChars));\n" +
    "\tconst props = getParamProperties(next);\n" +
    "\tif (props) next = setParamProperties(next, stripDeep(props) as Record<string, unknown>);\n" +
    "\treturn next;\n" +
    "}\n\n";
  code = code.slice(0, idx) + helper + code.slice(idx);
  console.log("  step 4: stripParamDescriptions helper added");
}

// --- Step 5: aggressive-branch conditional -------------------------------
if (!code.includes("PI_HARNESS_TSCG_STRIP_CALL")) {
  // Indentation inside the provider_request closure: 3 tabs for branch, 4 for body.
  const old =
    "\t\t\t} else if (settings.profile === \"aggressive\") {\n" +
    "\t\t\t\tt = truncateLongDescriptions(t, settings.aggressiveMaxDescChars);\n" +
    "\t\t\t}";
  const replacement =
    "\t\t\t} else if (settings.profile === \"aggressive\") {\n" +
    "\t\t\t\t// PI_HARNESS_TSCG_STRIP_CALL: optionally drop param descriptions entirely.\n" +
    "\t\t\t\tt = settings.aggressiveStripParamDesc\n" +
    "\t\t\t\t\t? stripParamDescriptions(t, settings.aggressiveMaxDescChars)\n" +
    "\t\t\t\t\t: truncateLongDescriptions(t, settings.aggressiveMaxDescChars);\n" +
    "\t\t\t}";
  if (!code.includes(old)) throw new Error("pi-tscg aggressive branch shape changed (step 5)");
  code = code.replace(old, replacement);
  console.log("  step 5: aggressive branch conditional applied");
}

writeFileSync(file, code);
console.log(`OK pi-tscg ${version}: patches applied`);
