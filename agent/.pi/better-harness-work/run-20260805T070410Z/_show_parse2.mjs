import fs from "fs";
const WORK = "/home/alex/.pi/agent/.pi/better-harness-work/run-20260805T070410Z";
const j = JSON.parse(fs.readFileSync(WORK + "/_parse2_out.json", "utf8"));
const lead = JSON.parse(fs.readFileSync(WORK + "/lead-summary.json", "utf8"));
const packet = JSON.parse(fs.readFileSync(WORK + "/packet-session.json", "utf8"));

const brief = {
  window: { start: j.windowStart, end: j.windowEnd },
  totals: { totalFiles: j.totalFiles, primaryFiles: j.primaryFiles },
  variants: j.variants.map((v) => ({
    label: v.label,
    n: v.n,
    withTools: v.withTools,
    long: v.long,
    longNoOutcome: v.longNoOutcome,
    toolCalls: v.toolCalls,
    toolResults: v.toolResults,
    errN: v.errN,
    allowN: v.allowN,
    editMissN: v.editMissN,
    readMissN: v.readMissN,
    editCalls: v.editCalls,
    shellCalls: v.shellCalls,
    errorRate: v.errorRate,
    topTools: v.topTools,
    topErrTools: v.topErrTools,
    longSessions: v.longSessions,
    frictionLeaders: v.frictionLeaders?.slice(0, 8),
    postP0: v.postP0,
  })),
  allowSamples: j.allowSamples,
  editSamples: j.editSamples,
  identicalRetry: j.identicalRetry,
  packetPop: j.packetPop,
  packetObs: j.packetObs,
  packetCand: (packet.data.candidates || []).map((c) => ({
    ref: c.ref,
    toolCalls: c.activity?.toolCalls,
    fails: c.friction?.executionFailures,
    denials: c.friction?.permissionDenials,
    edits: c.changes?.edits,
    files: c.changes?.files,
    closure: c.closure,
    classes: c.evidenceClasses,
    summary: (c.request?.summary || "").slice(0, 140),
  })),
  leadUE: lead.summaryFacts?.usageEfficiency,
  leadUA: {
    sessionsAnalyzed: lead.summaryFacts?.usageActivity?.sessionsAnalyzed,
    toolCallVolume: lead.summaryFacts?.usageActivity?.toolCallVolume,
    topTools: lead.summaryFacts?.usageActivity?.topTools,
    failureSummary: lead.summaryFacts?.usageActivity?.failureSummary,
    notes: lead.summaryFacts?.usageActivity?.notes,
  },
  primaryToolsDetail: j.primaryToolsDetail,
};

fs.writeFileSync(WORK + "/_brief.json", JSON.stringify(brief, null, 2));
console.log("bytes", fs.statSync(WORK + "/_brief.json").size);
// print key variant matching ~17
for (const v of brief.variants) {
  console.log(
    v.label,
    "n=" + v.n,
    "tools=" + v.withTools,
    "long=" + v.long,
    "tc=" + v.toolCalls,
    "err=" + v.errN,
    "allow=" + v.allowN,
    "editMiss=" + v.editMissN,
    "editCalls=" + v.editCalls,
    "rate=" + (v.errorRate != null ? v.errorRate.toFixed(3) : null)
  );
}
console.log("LEAD UE", JSON.stringify(brief.leadUE, null, 2));
console.log("LEAD UA", JSON.stringify(brief.leadUA, null, 2));
console.log("ALLOW", JSON.stringify(brief.allowSamples, null, 2));
console.log("EDIT", JSON.stringify(brief.editSamples, null, 2));
console.log("IDENT", brief.identicalRetry);
console.log("PACKET CAND", JSON.stringify(brief.packetCand, null, 2));
console.log(
  "LONG primary_dir_tools",
  JSON.stringify(brief.variants.find((v) => v.label === "primary_dir_tools_overlap")?.longSessions, null, 2)
);
console.log(
  "POSTP0 primary",
  JSON.stringify(brief.variants.find((v) => v.label === "primary_dir_tools_overlap")?.postP0, null, 2)
);
console.log(
  "FRICTION",
  JSON.stringify(brief.variants.find((v) => v.label === "primary_dir_tools_overlap")?.frictionLeaders, null, 2)
);
