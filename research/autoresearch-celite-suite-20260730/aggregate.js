const fs = require('fs');
const path = require('path');
const CAP = '/home/alex/bench-systima/captures';
function lane(label) {
  const dir = path.join(CAP, label);
  if (!fs.existsSync(dir)) return null;
  let tin = 0, tout = 0, n = 0, skill = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const body = j.request?.body || j.body || j.request || j;
    const u = j.response?.body?.usage || j.response?.usage || j.usage || {};
    tin += u.input_tokens ?? u.prompt_tokens ?? 0; tout += u.output_tokens ?? u.completion_tokens ?? 0; n++;
    if (JSON.stringify(body.messages || []).includes('ce-lite')) skill = 1;
  }
  return { tin, tout, n, skill };
}
const med = (a, b) => (a + b) / 2;
let suite = 0, outSum = 0, reqSum = 0, skillLanes = 0;
const parts = [];
for (const s of ['s1', 's2', 's3', 's4', 's5']) {
  const a = lane(`celite-${s}-r1`), b = lane(`celite-${s}-r2`);
  if (!a || !b) { console.log(`MISSING ${s}`); process.exit(1); }
  suite += med(a.tin + a.tout, b.tin + b.tout);
  outSum += a.tout + b.tout; reqSum += a.n + b.n;
  skillLanes += a.skill + b.skill;
  parts.push(`${s}=${Math.round(med(a.tin + a.tout, b.tin + b.tout))}`);
}
console.log(`METRIC suite_total=${Math.round(suite)}`);
console.log(`METRIC out_sum=${outSum}`);
console.log(`METRIC req_sum=${reqSum}`);
console.log(`METRIC skill_loaded=${skillLanes}/10`);
console.log(`METRIC detail_${parts.join('_')}`);
