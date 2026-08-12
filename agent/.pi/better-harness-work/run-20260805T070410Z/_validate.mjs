import fs from "fs";
const p =
  "/home/alex/.pi/agent/.pi/better-harness-work/run-20260805T070410Z/handoff-session-evidence.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
console.log(
  "ok",
  j.agentId,
  "findings=" + j.findings.length,
  "actions=" + j.nextActions.length,
  j.status,
  "eligible=" + j.coverage.eligibleSessions
);
