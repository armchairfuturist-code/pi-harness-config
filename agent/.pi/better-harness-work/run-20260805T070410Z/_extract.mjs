import fs from "fs";
import path from "path";

const WORK = "/home/alex/.pi/agent/.pi/better-harness-work/run-20260805T070410Z";

const parse = JSON.parse(fs.readFileSync(path.join(WORK, "_parse_out.json"), "utf8"));
const lead = JSON.parse(fs.readFileSync(path.join(WORK, "lead-summary.json"), "utf8"));
const packet = JSON.parse(fs.readFileSync(path.join(WORK, "packet-session.json"), "utf8"));
const priorHandoff = JSON.parse(
  fs.readFileSync("/home/alex/.pi/agent/.pi/better-harness-work/handoff-session-evidence.json", "utf8")
);

const d = packet.data;
const ue = lead.summaryFacts.usageEfficiency;
const ua = lead.summaryFacts.usageActivity;

// candidate friction rollup
const cands = d.candidates || [];
const candRoll = cands.map((c) => ({
  ref: c.ref,
  toolCalls: c.activity?.toolCalls,
  execFail: c.friction?.executionFailures,
  permDeny: c.friction?.permissionDenials,
  edits: c.changes?.edits,
  files: c.changes?.files,
  closure: c.closure,
  classes: c.evidenceClasses,
  summary: (c.request?.summary || "").slice(0, 120),
}));

const out = {
  parse: {
    eligibleCount: parse.eligibleCount,
    withToolsCount: parse.withToolsCount,
    zeroToolEligible: parse.zeroToolEligible,
    eligibleTotals: parse.eligibleTotals,
    totalsAllFiles: parse.totalsAllFiles,
    longSessions: parse.longSessions,
    postP0: parse.postP0,
    topFails: parse.topFails,
    frictionLeaders: parse.frictionLeaders,
    topToolsAll: parse.topToolsAll,
  },
  leadUsageEfficiency: ue,
  leadUsageActivity: ua,
  leadEvidenceBoundary: lead.summaryFacts.evidenceBoundary,
  packetAdmission: d.admission,
  packetPopulation: d.populationCoverage,
  packetObservation: d.observationCoverage,
  packetFlags: d.diagnosticFlags,
  packetOmitted: d.omitted,
  candRoll,
  priorHandoffKeys: Object.keys(priorHandoff),
  priorFindingIds: (priorHandoff.findings || []).map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    dimensionIds: f.dimensionIds,
  })),
  priorNextActions: priorHandoff.nextActions || priorHandoff.topActions,
  priorRuntime: priorHandoff.runtimeMetrics,
  priorCoverage: priorHandoff.coverage,
  priorGaps: priorHandoff.evidenceGaps,
};

fs.writeFileSync(path.join(WORK, "_extract_out.json"), JSON.stringify(out, null, 2));
console.log("wrote _extract_out.json bytes", fs.statSync(path.join(WORK, "_extract_out.json")).size);
console.log(
  JSON.stringify(
    {
      parseEligible: parse.eligibleCount,
      parseTools: parse.eligibleTotals,
      parseLong: parse.longSessions?.length,
      parsePostP0: parse.postP0,
      parseFails: parse.topFails,
      leadLong: ue?.longSessions,
      leadOutcome: ue?.outcomeReview,
      leadSelection: ue?.selection,
      candFails: candRoll.map((c) => c.ref + ":" + c.execFail + "/" + c.toolCalls),
      packetPop: d.populationCoverage,
    },
    null,
    2
  )
);
