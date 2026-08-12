import fs from "fs";
const WORK = "/home/alex/.pi/agent/.pi/better-harness-work/run-20260805T070410Z";
const lead = JSON.parse(fs.readFileSync(WORK + "/lead-summary.json", "utf8"));
const ue = lead.summaryFacts.usageEfficiency;
const ua = lead.summaryFacts.usageActivity;
// write compact
function pick(obj, keys) {
  const o = {};
  for (const k of keys) if (obj && k in obj) o[k] = obj[k];
  return o;
}
const out = {
  selection: ue.selection,
  longSessions: ue.longSessions,
  outcomeReview: ue.outcomeReview,
  // any other keys short
  keys: Object.keys(ue),
  rest: {},
};
for (const k of Object.keys(ue)) {
  if (["selection", "longSessions", "outcomeReview", "schemaVersion", "roles", "aiFixPrompt"].includes(k)) continue;
  const s = JSON.stringify(ue[k]);
  out.rest[k] = s && s.length > 1500 ? JSON.parse(s.slice(0, 1500) + (s.startsWith("{") ? "}" : s.startsWith("[") ? "]" : "")) : ue[k];
  try {
    out.rest[k] = ue[k];
    const ss = JSON.stringify(ue[k]);
    if (ss.length > 2000) {
      // truncate arrays
      if (Array.isArray(ue[k])) out.rest[k] = ue[k].slice(0, 5);
      else if (ue[k] && typeof ue[k] === "object") {
        const t = {};
        for (const [kk, vv] of Object.entries(ue[k])) {
          const vs = JSON.stringify(vv);
          t[kk] = vs && vs.length > 400 ? (typeof vv === "string" ? vv.slice(0, 400) : { truncated: true, keys: Object.keys(vv || {}) }) : vv;
        }
        out.rest[k] = t;
      }
    }
  } catch {
    out.rest[k] = "err";
  }
}
// activity
out.activity = ua
  ? {
      keys: Object.keys(ua),
      sessionsAnalyzed: ua.sessionsAnalyzed,
      toolCallVolume: ua.toolCallVolume,
      topTools: ua.topTools,
      failureSummary: ua.failureSummary,
      toolFailures: ua.toolFailures || ua.failures,
      notes: ua.notes,
    }
  : null;
// also search summaryFacts for friction-like
const sf = lead.summaryFacts;
out.sfKeys = Object.keys(sf);
for (const k of Object.keys(sf)) {
  if (/friction|fail|tool|session|allow|edit|outcome|effic/i.test(k) && !["usageEfficiency", "usageActivity"].includes(k)) {
    out["sf_" + k] = sf[k];
  }
}
fs.writeFileSync(WORK + "/_ue_compact.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 20000));
