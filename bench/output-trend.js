const fs = require('fs');
const path = require('path');
const ROOT = '/home/alex/.pi/agent/sessions';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.jsonl')) files.push(p);
  }
})(ROOT);

// model per session from model_change records; usage from assistant messages
const week = ts => { const d = new Date(ts); const o = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = (o.getUTCDay() + 6) % 7; o.setUTCDate(o.getUTCDate() - day); return o.toISOString().slice(0, 10); };
const agg = {}; // week|model -> {in, cacheR, out, reqs, sessions:Set}
for (const f of files) {
  let model = '?';
  const mtime = fs.statSync(f).mtimeMs;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.type === 'model_change' && r.modelId) model = r.modelId;
    if (r.type === 'message' && r.message?.role === 'assistant') {
      const u = r.message.usage || r.message.msg?.usage;
      if (!u) continue;
      const w = week(r.timestamp || mtime);
      const k = `${w}|${model}`;
      const a = agg[k] = agg[k] || { in: 0, cacheR: 0, out: 0, reqs: 0 };
      a.in += u.input || 0; a.cacheR += u.cacheRead || 0; a.out += u.output || 0; a.reqs++;
    }
  }
}
console.log('week|model|reqs|outToks|out/in%|fresh/req');
for (const [k, a] of Object.entries(agg).sort()) {
  if (a.reqs < 5) continue;
  const tot = a.in + a.cacheR;
  console.log(`${k}|${a.reqs}|${a.out.toLocaleString()}|${(100 * a.out / (tot || 1)).toFixed(1)}%|${Math.round(a.in / a.reqs).toLocaleString()}`);
}
