import fs from "fs";
const WORK = "/home/alex/.pi/agent/.pi/better-harness-work/run-20260805T070410Z";
const brief = JSON.parse(fs.readFileSync(WORK + "/_brief.json", "utf8"));
const v = brief.variants.find((x) => x.label === "primary_dir_overlap");
const leadUE = brief.leadUE || {};
console.log("=== VARIANT primary_dir_overlap ===");
console.log(JSON.stringify({
  n: v.n, withTools: v.withTools, long: v.long, longNoOutcome: v.longNoOutcome,
  toolCalls: v.toolCalls, toolResults: v.toolResults, errN: v.errN, allowN: v.allowN,
  editMissN: v.editMissN, readMissN: v.readMissN, editCalls: v.editCalls, shellCalls: v.shellCalls,
  errorRate: v.errorRate, topTools: v.topTools, topErrTools: v.topErrTools,
  longSessions: v.longSessions, postP0: v.postP0,
  frictionLeaders: (v.frictionLeaders||[]).map(f => ({
    file: f.file, durationMin: f.durationMin, toolCalls: f.toolCalls,
    errN: f.errN, allowN: f.allowN, editMissN: f.editMissN, lastTs: f.lastTs,
    samples: (f.failSamples||[]).map(s => s.cls+':'+s.name+':'+(s.text||'').slice(0,100))
  }))
}, null, 2));
console.log("=== LEAD UE KEYS ===", Object.keys(leadUE));
console.log("selection", JSON.stringify(leadUE.selection));
console.log("longSessions", JSON.stringify(leadUE.longSessions, null, 2).slice(0,2000));
console.log("outcomeReview", JSON.stringify(leadUE.outcomeReview, null, 2).slice(0,2000));
console.log("friction", JSON.stringify(leadUE.friction || leadUE.toolFriction || leadUE.failures, null, 2)?.slice(0,3000));
// dump all top-level leadUE with short preview
for (const [k,val] of Object.entries(leadUE)) {
  const s = JSON.stringify(val);
  console.log("UE."+k, s ? s.slice(0,300) : s);
}
console.log("=== ALLOW SAMPLES ===");
console.log(JSON.stringify(brief.allowSamples, null, 2).slice(0,4000));
console.log("=== EDIT SAMPLES ===");
console.log(JSON.stringify(brief.editSamples, null, 2).slice(0,4000));
console.log("=== IDENTICAL RETRY ===", brief.identicalRetry);
console.log("=== PACKET CAND ===");
console.log(JSON.stringify(brief.packetCand, null, 2));
console.log("=== PACKET POP/OBS ===");
console.log(JSON.stringify({pop: brief.packetPop, obs: brief.packetObs}, null, 2));
console.log("=== LEAD UA ===");
console.log(JSON.stringify(brief.leadUA, null, 2).slice(0,5000));
