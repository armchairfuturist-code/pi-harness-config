const fs = require('fs');
const path = require('path');
const LEVEL = process.argv[2] || 'high';
const CAP = process.argv[3] || '/tmp/think-g46-captures';
function usageOf(j) {
  const body = j.res_body || j.response?.body || j.response || j;
  const u = body.usage || {};
  const tin = u.input_tokens ?? u.prompt_tokens ?? u.input ?? 0;
  const tout = u.output_tokens ?? u.completion_tokens ?? u.output ?? 0;
  return { tin, tout };
}
function lane(label) {
  const dir = path.join(CAP, label);
  if (!fs.existsSync(dir)) return null;
  let tin = 0, tout = 0, n = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const u = usageOf(j);
    tin += u.tin;
    tout += u.tout;
    n++;
  }
  return { tin, tout, n };
}
const med = (a, b) => (a + b) / 2;
let suite = 0, outSum = 0, reqSum = 0;
const parts = [];
for (const t of ['t1', 't3']) {
  const a = lane(`think-g46-${LEVEL}-${t}-r1`);
  const b = lane(`think-g46-${LEVEL}-${t}-r2`);
  if (!a || !b) {
    console.log(`MISSING ${t}`);
    process.exit(1);
  }
  suite += med(a.tin + a.tout, b.tin + b.tout);
  outSum += a.tout + b.tout;
  reqSum += a.n + b.n;
  parts.push(`${t}=${Math.round(med(a.tin + a.tout, b.tin + b.tout))}`);
}
console.log(`METRIC suite_total=${Math.round(suite)}`);
console.log(`METRIC out_sum=${outSum}`);
console.log(`METRIC req_sum=${reqSum}`);
console.log(`METRIC detail_${parts.join('_')}`);
