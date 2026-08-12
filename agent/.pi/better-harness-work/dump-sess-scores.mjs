import fs from "fs";
const work = fs.readFileSync("/home/alex/.pi/agent/.pi/better-harness-work/LATEST", "utf8").trim();
const d = JSON.parse(fs.readFileSync(work + "/handoff-session-evidence.json", "utf8"));
console.log("keys", Object.keys(d));
console.log("dimensionScores", JSON.stringify(d.dimensionScores || d.scores, null, 2)?.slice(0, 3000));
console.log(
  "findings",
  (d.findings || []).map((f) => `${f.severity}|${f.id}|${f.title}`).join("\n"),
);
console.log("topActions", JSON.stringify(d.topActions || []).slice(0, 1500));
console.log("runtime", JSON.stringify(d.runtimeMetrics || d.metrics || {}).slice(0, 2000));
