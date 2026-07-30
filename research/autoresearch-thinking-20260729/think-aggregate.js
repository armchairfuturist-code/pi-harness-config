const fs = require('fs');
const path = require('path');
const CAP = '/home/alex/bench-systima/captures';
const LEVEL = process.argv[2] || 'xhigh';
function lane(label) {
  const dir = path.join(CAP, label);
  if (!fs.existsSync(dir)) return null;
  let tin = 0, tout = 0, n = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const u = j.response?.body?.usage || j.response?.usage || j.usage || {};
    tin += u.input_tokens || 0; tout += u.output_tokens || 0; n++;
  }
  return { tin, tout, n };
}
const med = (a, b) => (a + b) / 2;
let suite = 0, outSum = 0, reqSum = 0; const parts = [];
for (const t of ['t1', 't3']) {
  const a = lane(`think-${LEVEL}-${t}-r1`), b = lane(`think-${LEVEL}-${t}-r2`);
  if (!a || !b) { console.log(`MISSING ${t}`); process.exit(1); }
  suite += med(a.tin + a.tout, b.tin + b.tout);
  outSum += a.tout + b.tout; reqSum += a.n + b.n;
  parts.push(`${t}=${Math.round(med(a.tin + a.tout, b.tin + b.tout))}`);
}
console.log(`METRIC suite_total=${Math.round(suite)}`);
console.log(`METRIC out_sum=${outSum}`);
console.log(`METRIC req_sum=${reqSum}`);
console.log(`METRIC detail_${parts.join('_')}`);
