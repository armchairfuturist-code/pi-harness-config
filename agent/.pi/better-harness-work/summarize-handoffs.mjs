import fs from "fs";
import path from "path";
const work = fs.readFileSync("/home/alex/.pi/agent/.pi/better-harness-work/LATEST", "utf8").trim();
for (const f of ["handoff-project-harness.json", "handoff-agent-customize.json", "handoff-session-evidence.json"]) {
  const p = path.join(work, f);
  if (!fs.existsSync(p)) {
    console.log("MISSING", f);
    continue;
  }
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  console.log("\n====", f, "====");
  console.log("status", d.status, "agentId", d.agentId, "findings", (d.findings || []).length);
  console.log(
    "scores",
    JSON.stringify(d.dimensionScores || d.scores || []).slice(0, 800),
  );
  for (const x of d.findings || []) {
    console.log(
      `- [${x.severity}] ${x.id || "?"} ${x.title} | reg=${x.regressionCheck || "?"} | dim=${x.dimension || "?"}`,
    );
    console.log("  ", (x.summary || x.reason || "").slice(0, 220));
  }
  console.log("topActions", JSON.stringify(d.topActions || []).slice(0, 600));
  console.log("gaps", d.evidenceGaps);
}
// B intermediate
for (const f of ["_parse2_out.json", "_extract_out.json", "_ue_compact.json"]) {
  const p = path.join(work, f);
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  console.log("\nBINT", f, "keys", Object.keys(d).slice(0, 30));
  console.log(JSON.stringify(d).slice(0, 2500));
}
