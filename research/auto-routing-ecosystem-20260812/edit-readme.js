const fs = require('fs');
const path = '/home/alex/Projects/pi-harness-config/README.md';
let s = fs.readFileSync(path, 'utf8');

const newSection = `## Thinking levels

Thinking is **static pins**, not an auto-raiser.

- **Floor:** machine-local \`defaultThinkingLevel\` in \`~/.pi/agent/settings.json\` (not committed). Recommendation: \`medium\`.
- **Per-model:** live \`model-thinking.json\`. Pin exceptions only after a canary.
- **User levers:** \`/think\`. \`xhigh\`/\`max\` stay user-only.
- **Removed:** \`@howaboua/pi-auto-reasoning-tool\` and the harness raise-only patch. The package could only raise, switched cache lanes, and did not save tokens on this pin table.

`;

const start = s.indexOf('## Adaptive reasoning (pi-auto-reasoning-tool)');
const end = s.indexOf('## Design (why these files exist)');
if (start < 0 || end < 0 || end <= start) {
  throw new Error('section markers not found: ' + start + ' ' + end);
}
s = s.slice(0, start) + newSection + s.slice(end);

const bulletRe = /\n- \*\*pi-auto-reasoning-tool\*\*[\s\S]*?(?=\n- \*\*pi-skill-model-facing-api-design\*\*)/;
if (!bulletRe.test(s)) throw new Error('package bullet not found');
s = s.replace(bulletRe, '\n');

fs.writeFileSync(path, s);
console.log('readme updated', start, end);
