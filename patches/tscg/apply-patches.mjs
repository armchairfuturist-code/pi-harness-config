import { readFileSync, writeFileSync } from 'fs';
const file = process.env.HOME + '/.pi/agent/npm/node_modules/pi-tscg/extensions/tscg.ts';
let code = readFileSync(file, 'utf8');
if (code.includes('truncateDeep')) {
	console.log('TSCG already patched (truncateDeep found)');
	process.exit(0);
}
const lines = code.split('\n');
const startIdx = lines.findIndex(l => l.startsWith('function truncateLongDescriptions('));
if (startIdx < 0) { console.error('Function not found'); process.exit(1); }
let depth = 0, endIdx = -1;
for (let i = startIdx; i < lines.length; i++) {
	for (const ch of lines[i]) {
		if (ch === '{') depth++;
		if (ch === '}') depth--;
		if (depth === 0 && i > startIdx) { endIdx = i; break; }
	}
	if (endIdx >= 0) break;
}
if (endIdx < 0) { console.error('Could not find function end'); process.exit(1); }
const replacement = [
	'function truncateLongDescriptions(t: AnyToolDefinition, maxChars: number): AnyToolDefinition {',
	'\tfunction truncateDeep(obj: unknown): unknown {',
	'\t\tif (obj === null || typeof obj !== "object") return obj;',
	'\t\tif (Array.isArray(obj)) return obj.map(truncateDeep);',
	'\t\tconst o = obj as Record<string, unknown>;',
	'\t\tconst result: Record<string, unknown> = {};',
	'\t\tfor (const [k, v] of Object.entries(o)) {',
	'\t\t\tif (k === "description" && typeof v === "string") {',
	'\t\t\t\tresult[k] = truncate(v, maxChars);',
	'\t\t\t} else {',
	'\t\t\t\tresult[k] = truncateDeep(v);',
	'\t\t\t}',
	'\t\t}',
	'\t\treturn result;',
	'\t}',
	'\tconst truncated = truncate(getDescription(t), maxChars);',
	'\tlet next = setDescription(t, truncated);',
	'\tconst props = getParamProperties(next);',
	'\tif (props) {',
	'\t\tnext = setParamProperties(next, truncateDeep(props) as Record<string, unknown>);',
	'\t}',
	'\treturn next;',
	'}',
];
lines.splice(startIdx, endIdx - startIdx + 1, ...replacement);
writeFileSync(file, lines.join('\n'));
console.log('TSCG patched: truncateLongDescriptions now recurses into nested parameter descriptions');
