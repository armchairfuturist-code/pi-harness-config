// aggregate.js — read captures/terseness-t{1,2,3}-r{1,2}, emit tier/suite totals.
const fs = require('fs');
const path = require('path');
const CAP = '/home/alex/bench-systima/captures';

function laneTotal(label) {
  const dir = path.join(CAP, label);
  if (!fs.existsSync(dir)) return null;
  let tin = 0, tout = 0, n = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const usage = j.response?.body?.usage || j.response?.usage || j.usage || {};
    tin += usage.input_tokens || 0;
    tout += usage.output_tokens || 0;
    n++;
  }
  return { in: tin, out: tout, reqs: n };
}
const med = (a, b) => (a + b) / 2;

let suite = 0, outSum = 0, reqSum = 0;
const parts = [];
for (const t of ['t1', 't2', 't3']) {
  const r1 = laneTotal(`terseness-${t}-r1`);
  const r2 = laneTotal(`terseness-${t}-r2`);
  if (!r1 || !r2) { console.log(`MISSING lane for ${t}`); process.exit(1); }
  const tm = med(r1.in + r1.out, r2.in + r2.out);
  suite += tm;
  outSum += r1.out + r2.out;
  reqSum += r1.reqs + r2.reqs;
  parts.push(`${t}=${Math.round(tm)}`);
}
console.log(`METRIC suite_total=${Math.round(suite)}`);
console.log(`METRIC out_sum=${outSum}`);
console.log(`METRIC req_sum=${reqSum}`);
console.log(`METRIC detail_${parts.join('_')}`);
