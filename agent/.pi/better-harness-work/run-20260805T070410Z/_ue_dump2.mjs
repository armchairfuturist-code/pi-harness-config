import fs from "fs";
const WORK = "/home/alex/.pi/agent/.pi/better-harness-work/run-20260805T070410Z";
const lead = JSON.parse(fs.readFileSync(WORK + "/lead-summary.json", "utf8"));
const ue = lead.summaryFacts.usageEfficiency || {};
const ua = lead.summaryFacts.usageActivity || {};
const out = {
  ueKeys: Object.keys(ue),
  selection: ue.selection,
  longSessions: ue.longSessions,
  outcomeReview: ue.outcomeReview,
  roles: ue.roles,
  // stringify large fields safely
  longSessionsStr: JSON.stringify(ue.longSessions || null).slice(0, 4000),
  outcomeReviewStr: JSON.stringify(ue.outcomeReview || null).slice(0, 4000),
  restKeys: {},
};
for (const k of Object.keys(ue)) {
  if (["selection", "longSessions", "outcomeReview", "roles", "schemaVersion"].includes(k)) continue;
  out.restKeys[k] = JSON.stringify(ue[k]).slice(0, 500);
}
out.ua = {
  keys: Object.keys(ua),
  sessionsAnalyzed: ua.sessionsAnalyzed,
  toolCallVolume: ua.toolCallVolume,
  topTools: ua.topTools,
  failureSummary: ua.failureSummary,
};
// stringify failure details if any
for (const k of Object.keys(ua)) {
  if (!out.ua[k]) out.ua["x_" + k] = JSON.stringify(ua[k]).slice(0, 600);
}
fs.writeFileSync(WORK + "/_ue_compact.json", JSON.stringify(out, null, 2));
console.log(fs.readFileSync(WORK + "/_ue_compact.json", "utf8").slice(0, 18000));
