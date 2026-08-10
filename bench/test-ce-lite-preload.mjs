#!/usr/bin/env node
/**
 * Unit test for ce-lite-preload heuristics (no pi runtime required).
 * Run: node bench/test-ce-lite-preload.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "extensions/ce-lite-preload.ts"), "utf8");

if (/systemPrompt\s*:/.test(src)) {
	console.error("FAIL: extension must not set systemPrompt (H4 cache safety)");
	process.exit(1);
}
if (!src.includes('customType: "ce-lite-preload"')) {
	console.error("FAIL: missing custom message injection");
	process.exit(1);
}

// Extract ACTION_RE / OBJECT_RE / PATHISH_RE + shouldPreload body as one eval unit.
const start = src.indexOf("const ACTION_RE");
const fnStart = src.indexOf("export function shouldPreload");
const fnBrace = src.indexOf("{", fnStart);
if (start < 0 || fnStart < 0 || fnBrace < 0) {
	console.error("FAIL: could not locate ACTION_RE / shouldPreload");
	process.exit(1);
}
// Walk braces to end of shouldPreload
let depth = 0;
let end = fnBrace;
for (; end < src.length; end++) {
	const ch = src[end];
	if (ch === "{") depth++;
	else if (ch === "}") {
		depth--;
		if (depth === 0) {
			end++;
			break;
		}
	}
}
const chunk = src.slice(start, end)
	// strip TS-only bits if any
	.replace(/^export\s+/m, "")
	.replace(/function shouldPreload\(prompt:\s*string\):\s*boolean/g, "function shouldPreload(prompt)")
	.replace(/\(prompt\?\? ""\)/g, '(prompt ?? "")');
const shouldPreload = new Function(`${chunk}\nreturn shouldPreload;`)();

const cases = [
	["hi", false],
	["test", false],
	["what is the KEEP policy?", false],
	["thanks", false],
	["implement multi-file refactor of extensions and add tests", true],
	["debug the probe.sh cache metrics and fix semantic-canary", true],
	["1. edit settings.json\n2. install harness\n3. run canary", true],
	["file edits for the harness preload extension", true],
	["please refactor runtime-discipline and wire up install", true],
	["quick question about tokens only", false],
];

let failed = 0;
for (const [p, exp] of cases) {
	const got = !!shouldPreload(p);
	const mark = got === exp ? "OK" : "FAIL";
	if (got !== exp) failed++;
	console.log(
		`${mark} shouldPreload(${JSON.stringify(p).slice(0, 60)}) => ${got} (want ${exp})`,
	);
}
if (failed) {
	console.error(`\n${failed} case(s) failed`);
	process.exit(1);
}
console.log(`\nPASS ${cases.length} cases`);
