import fs from "fs";
import path from "path";

const work = process.argv[2];
const raw = fs.readFileSync(path.join(work, "evidence-bundle.raw.json"), "utf8");
const i = raw.indexOf("{");
const data = JSON.parse(raw.slice(i));
fs.writeFileSync(path.join(work, "evidence-bundle.json"), JSON.stringify(data, null, 2));

const lead = data.lead?.data || {};
fs.writeFileSync(path.join(work, "lead-evidence.md"), lead.evidence || "");
fs.writeFileSync(
  path.join(work, "lead-summary.json"),
  JSON.stringify(
    {
      summaryFacts: lead.summaryFacts,
      sessionBinding: lead.sessionBinding,
      kind: lead.kind,
      schemaVersion: lead.schemaVersion,
    },
    null,
    2,
  ),
);

for (const [name, key] of [
  ["session", "sessionEvidence"],
  ["project", "projectHarness"],
  ["architecture", "agentCustomize"],
]) {
  const lane = data.lanes?.[key];
  const payload = {
    laneStatus: lane?.status,
    data: lane?.data,
    context: {
      workspace: data.context?.workspace,
      provider: data.context?.provider,
      language: data.context?.language,
      depth: data.context?.depth,
      window: data.context?.window,
      topology: data.context?.topology,
    },
    diagnostics: data.diagnostics,
  };
  fs.writeFileSync(path.join(work, `packet-${name}.json`), JSON.stringify(payload, null, 2));
}

const lanes = data.lanes || {};
const bad = [];
if (data.status === "failed") bad.push("bundle failed");
if (!lead.evidence) bad.push("lead missing evidence");
if (!lead.summaryFacts) bad.push("lead missing summaryFacts");
const depth = data.context?.depth || "normal";
for (const k of ["sessionEvidence", "projectHarness", "agentCustomize"]) {
  const st = lanes[k]?.status;
  if (st !== "ok" && st !== "partial") bad.push(`${k}:${st}`);
  if (depth === "normal" && st === "partial") bad.push(`${k}:partial-blocks-normal`);
}

// quick signal snapshot for agents
const proj = lanes.projectHarness?.data || {};
const sess = lanes.sessionEvidence?.data || {};
const arch = lanes.agentCustomize?.data || {};
const snap = {
  status: data.status,
  depth,
  bad,
  laneStatus: Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, v.status])),
  topology: data.context?.topology,
  window: data.context?.window,
  project: {
    recommendedReads: (proj.recommendedReads || []).slice(0, 20),
    reviewMatrixCount: (proj.reviewMatrix || []).length,
    summary: proj.summary || null,
    profile: proj.projectProfile || null,
  },
  session: {
    summaryFacts: sess.summaryFacts || lead.summaryFacts || null,
    candidates: (sess.candidates || []).length,
    observationCoverage: sess.observationCoverage || null,
  },
  architecture: {
    envelopeKeys: Object.keys(arch.envelopes || {}),
    inventorySnippet: JSON.stringify(arch.envelopes?.inventory || {}).slice(0, 1500),
  },
};
fs.writeFileSync(path.join(work, "bundle-snapshot.json"), JSON.stringify(snap, null, 2));
console.log(JSON.stringify(snap, null, 2));
if (bad.length) {
  console.error("GATE_FAIL", bad.join("; "));
  process.exit(2);
}
console.log("GATE_OK");
