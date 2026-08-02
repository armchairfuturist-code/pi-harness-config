// gather-judge-split.js
// General-purpose research/judge separation workflow.
//
// Principle (from research/research-judge-separation-20260802.md):
//   Never gather evidence and judge it in the same context window.
//   - Gather phase: cheap model (tier "small" → mercury-2 / gemini-3-5-flash-lite)
//     collects raw evidence, outputs structured JSON. No conclusions.
//   - Judge phase: strong model (tier "big" → GLM-5.2 / kimi-k3) receives ONLY
//     the structured evidence packets in a FRESH context. Never sees the
//     gatherers' reasoning, search paths, or intermediate hypotheses.
//   - Verify phase: medium model adversarially audits the judge's verdict
//     against the same evidence packets — also a fresh context.
//
// The script enforces separation architecturally:
//   1. Gather workers' `decisions` field must be empty — violations are stripped.
//   2. The judge prompt contains ONLY evidencePackets (extracted payload_json),
//      never the full agent result objects or their contexts.
//   3. The verify agent gets the judge's structured verdict + the same evidence
//      packets, but NOT the judge's full context.
//
// Usage via workflow tool:
//   workflow({ script: <contents of this file>, args: { question: "...", ... } })
//
// Args:
//   question     (required) The question to research and judge.
//   context      (optional) Background context / domain framing for the gatherers.
//   gather_tier  (optional) Model tier for gather phase. Default: "small".
//   judge_tier   (optional) Model tier for judge phase. Default: "big".
//   verify_tier  (optional) Model tier for verify phase. Default: "medium".
//   max_subtasks (optional) Max parallel gather workers. Default: 8.
//   verify       (optional) Run adversarial verify phase? Default: true.
//   source_hint  (optional) Where to gather from (e.g. "codebase", "web", "session logs").

export const meta = {
  name: "gather-judge-split",
  description:
    "Enforced research/judge separation. Cheap model gathers evidence-only packets in parallel; strong model judges them in a fresh context; medium model adversarially verifies. The judge never sees gatherer reasoning — only structured evidence.",
  phases: [
    { title: "Brief" },
    { title: "Gather" },
    { title: "Judge" },
    { title: "Verify" },
  ],
}

const question     = args.question     || ""
const context      = args.context      || ""
const gatherTier   = args.gather_tier  || "small"
const judgeTier    = args.judge_tier   || "big"
const verifyTier   = args.verify_tier  || "medium"
const maxSubtasks  = parseInt(args.max_subtasks || "8", 10)
const runVerify    = args.verify !== "false" && args.verify !== false
const sourceHint   = args.source_hint  || "any available source"

if (!question) {
  return {
    report: "gather-judge-split: no question provided. Pass args.question.",
    incomplete: true,
  }
}

// ── Contracts ──────────────────────────────────────────────

// Gather workers return evidence only. `decisions` MUST be empty.
const GATHER_CONTRACT = {
  type: "object",
  required: ["outcome", "evidence", "changes", "decisions", "failures_risks", "new_tasks", "payload_json"],
  properties: {
    outcome:       { type: "string", description: "What data was gathered, 1-2 sentences. NO recommendations, NO conclusions." },
    evidence:      { type: "string", description: "Raw evidence: data points, quotes, file paths, citations, signals. NO interpretation." },
    changes:       { type: "array", items: { type: "string" } },
    decisions:     { type: "array", items: { type: "string" }, description: "MUST be empty array. Gatherers do not decide." },
    failures_risks:{ type: "array", items: { type: "string" }, description: "Data quality issues, missing sources, staleness, access failures." },
    new_tasks:     { type: "array", items: { type: "string" } },
    payload_json:  { type: "string", description: "Structured evidence as JSON string: { subtask_id, data_points: [{metric, value, source, timestamp, confidence}], raw_notes }" },
  },
}

// Brief architect returns subtask decomposition — also evidence-shaped (no decisions).
const BRIEF_CONTRACT = {
  type: "object",
  required: ["outcome", "evidence", "changes", "decisions", "failures_risks", "new_tasks", "payload_json"],
  properties: {
    outcome:       { type: "string", description: "Brief summary of the research decomposition, 1-2 sentences." },
    evidence:      { type: "string", description: "Key considerations that shaped the subtask decomposition." },
    changes:       { type: "array", items: { type: "string" } },
    decisions:     { type: "array", items: { type: "string" } },
    failures_risks:{ type: "array", items: { type: "string" } },
    new_tasks:     { type: "array", items: { type: "string" } },
    payload_json:  { type: "string", description: "JSON: { subtasks: [{ id, question, data_to_gather, confirm_signals, deny_signals }] }" },
  },
}

// Judge returns verdict with evidence citations.
const JUDGE_CONTRACT = {
  type: "object",
  required: ["outcome", "evidence", "changes", "decisions", "failures_risks", "new_tasks", "payload_json"],
  properties: {
    outcome:       { type: "string", description: "Verdict / answer to the question, with confidence level. 2-4 sentences." },
    evidence:      { type: "string", description: "Which evidence packets support/oppose the verdict, cited by subtask_id." },
    changes:       { type: "array", items: { type: "string" } },
    decisions:     { type: "array", items: { type: "string" }, description: "Each decision with rationale and evidence citation." },
    failures_risks:{ type: "array", items: { type: "string" }, description: "Conflicting signals, ignored evidence, calibration concerns, missing data." },
    new_tasks:     { type: "array", items: { type: "string" } },
    payload_json:  { type: "string", description: "JSON: { verdict, confidence: high|medium|low, supporting_evidence: [subtask_ids], opposing_evidence: [subtask_ids], conflicts: [{subtask_ids, description}], risk_flags: [strings], assumptions: [strings] }" },
  },
}

// Verify returns adversarial audit of the judge's verdict.
const VERIFY_CONTRACT = {
  type: "object",
  required: ["outcome", "evidence", "changes", "decisions", "failures_risks", "new_tasks", "payload_json"],
  properties: {
    outcome:       { type: "string", description: "Verification result: PASS or FAIL with reason. 2-3 sentences." },
    evidence:      { type: "string", description: "Specific checks performed and findings." },
    changes:       { type: "array", items: { type: "string" } },
    decisions:     { type: "array", items: { type: "string" } },
    failures_risks:{ type: "array", items: { type: "string" }, description: "Any verification failures with severity." },
    new_tasks:     { type: "array", items: { type: "string" } },
    payload_json:  { type: "string", description: "JSON: { verdict: pass|fail, checks: [{name, passed, detail}], critical_failures: [strings], recalibration: high|medium|low|none }" },
  },
}

// ── Phase 1: BRIEF ─────────────────────────────────────────
// Small model decomposes the question into sub-questions.
// No gathering, no judging — pure decomposition.
phase("Brief")
let brief = null
try {
  brief = await agent(
    `You are a research architect. Your ONLY job is to decompose a question into research subtasks. You do not gather data. You do not answer the question. You do not judge.

Question: ${question}
${context ? `Context: ${context}` : ""}
Source domain: ${sourceHint}

Output a research brief:
1. 4-${maxSubtasks} sub-questions that, if answered with raw data, would inform a judgment on the main question.
2. For each sub-question: what specific data/evidence to gather.
3. What evidence would CONFIRM each plausible answer to the main question.
4. What evidence would DENY each plausible answer.

Keep sub-questions independent (parallelizable). Avoid overlap.

Return the worker contract JSON. Put the brief in payload_json as: { subtasks: [{ id, question, data_to_gather, confirm_signals, deny_signals }] }`,
    { label: "architect-brief", tier: gatherTier, schema: BRIEF_CONTRACT }
  )
} catch (err) {
  return { report: `gather-judge-split: brief phase failed (${String(err)}). Nothing was gathered.`, incomplete: true }
}

let briefPayload = null
if (brief && typeof brief.payload_json === "string") {
  try { briefPayload = JSON.parse(brief.payload_json) } catch { briefPayload = null }
}
if (!briefPayload || !Array.isArray(briefPayload.subtasks) || briefPayload.subtasks.length === 0) {
  return { report: "gather-judge-split: architect produced no usable subtasks. Aborting before gather.", incomplete: true, brief }
}

const subtasks = briefPayload.subtasks.slice(0, maxSubtasks)
log(`Brief: ${subtasks.length} subtasks`)

// ── Phase 2: GATHER ────────────────────────────────────────
// Parallel small-model workers gather raw evidence. Each is a fresh context.
// Enforced: decisions field must be empty. Violations are stripped.
phase("Gather")
const gatherPromises = subtasks.map((st) =>
  agent(
    `You are an evidence gatherer. Your ONLY job is to collect raw data. You do NOT make recommendations. You do NOT draw conclusions. You do NOT interpret. You do NOT answer the sub-question — you gather data that a separate judge will use.

Subtask ID: ${st.id}
Sub-question: ${st.question}
Data to gather: ${st.data_to_gather}
Source domain: ${sourceHint}
${context ? `Context: ${context}` : ""}

Gather raw evidence only. Every data point needs a source and (where possible) a timestamp. Include conflicting or contradictory data if you find it — do not filter toward a conclusion.

CRITICAL ENFORCEMENT: Your 'decisions' field MUST be an empty array []. You are a gatherer, not a decider. Any conclusion or recommendation you put in 'decisions' will be stripped before the judge sees your output. Spend your effort on evidence quality, not interpretation.

Return the worker contract JSON. Put structured evidence in payload_json as:
{ "subtask_id": "${st.id}", "data_points": [{"metric": "...", "value": "...", "source": "...", "timestamp": "...", "confidence": "high|medium|low"}], "raw_notes": "..." }`,
    { label: `gather-${st.id}`, tier: gatherTier, schema: GATHER_CONTRACT }
  )
)

let gatherResults = []
try {
  gatherResults = await parallel(gatherPromises)
} catch (err) {
  return {
    report: `gather-judge-split: gather phase failed (${String(err)}). Brief was created but no evidence gathered.`,
    incomplete: true,
    brief: { subtasks: subtasks.length, outcome: brief.outcome },
  }
}

// Enforce: gatherers must not have made decisions
const decisionViolations = gatherResults.filter(
  (r) => r && Array.isArray(r.decisions) && r.decisions.length > 0
)
if (decisionViolations.length > 0) {
  log(`WARNING: ${decisionViolations.length} gatherer(s) returned decisions despite instructions. Stripping before judge phase.`)
}

// Extract evidence packets — the judge gets ONLY these, never full worker contexts.
// This is the architectural enforcement of context separation.
const evidencePackets = gatherResults
  .filter((r) => r && r.payload_json)
  .map((r) => {
    let parsed = null
    try { parsed = JSON.parse(r.payload_json) } catch { parsed = null }
    return {
      subtask_id:         parsed?.subtask_id || "unknown",
      data_points:        parsed?.data_points || [],
      raw_notes:          parsed?.raw_notes || r.evidence || "",
      data_quality_issues: r.failures_risks || [],
    }
  })
  .filter((p) => p.data_points.length > 0 || (p.raw_notes && p.raw_notes.length > 0))

if (evidencePackets.length === 0) {
  return {
    report: "gather-judge-split: no usable evidence packets gathered. Aborting before judge phase — no judgment without evidence.",
    incomplete: true,
    brief: { subtasks: subtasks.length, outcome: brief.outcome },
    gather: gatherResults.map((r) => ({ outcome: r?.outcome, failures: r?.failures_risks })),
  }
}

log(`Gathered ${evidencePackets.length} evidence packets from ${gatherResults.length} workers (${decisionViolations.length} decision violations stripped)`)

// ── Phase 3: JUDGE ─────────────────────────────────────────
// Strong model, FRESH context. Receives ONLY evidencePackets —
// never the gatherers' prompts, reasoning, contexts, or search paths.
phase("Judge")
let judgment = null
try {
  judgment = await agent(
    `You are the judge. You are evaluating pre-gathered evidence from multiple independent gatherers. You did NOT gather this data yourself — you have no knowledge of how it was found, what was searched, or what was tried and failed. You see only the evidence packets below.

Question: ${question}
${context ? `Context: ${context}` : ""}

Evidence packets (JSON — this is ALL you have):
${JSON.stringify(evidencePackets, null, 2)}

Your job:
1. Weigh ALL evidence packets. Identify conflicting signals between packets.
2. For each plausible answer to the question, cite which evidence packets (by subtask_id) support and which oppose it.
3. Produce a verdict with explicit confidence level (high/medium/low).
4. Flag risks: what evidence is missing, what would change the verdict, what data quality issues affect confidence.
5. State your assumptions explicitly.

Rules:
- Cite evidence by subtask_id for every claim.
- If you cannot support a claim with a specific evidence packet, say so explicitly — do not infer beyond the evidence.
- If the evidence is insufficient to reach a verdict, say so. "Insufficient evidence" is a valid verdict.
- Do not speculate about data you were not given.

Return the worker contract JSON. Put your structured verdict in payload_json.`,
    { label: "judge-evidence", tier: judgeTier, schema: JUDGE_CONTRACT }
  )
} catch (err) {
  return {
    report: `gather-judge-split: judge phase failed (${String(err)}). Evidence was gathered but no judgment produced. Do NOT act on raw evidence.`,
    incomplete: true,
    brief: { subtasks: subtasks.length },
    evidencePackets,
  }
}

let judgePayload = null
if (judgment && typeof judgment.payload_json === "string") {
  try { judgePayload = JSON.parse(judgment.payload_json) } catch { judgePayload = null }
}

// ── Phase 4: VERIFY ────────────────────────────────────────
// Medium model, FRESH context. Adversarial audit of the judge's verdict
// against the same evidence packets. Separate agent, separate context.
phase("Verify")
let verifyPayload = null
let verification = null

if (runVerify) {
  try {
    verification = await agent(
      `You are an adversarial verifier. Your job is to find what's wrong with a judgment, not to confirm it.

Original question: ${question}

Judge's structured verdict (JSON):
${JSON.stringify(judgePayload, null, 2)}

Judge's reasoning:
${judgment?.outcome || ""}

Evidence packets the judge had access to (JSON — the same set):
${JSON.stringify(evidencePackets, null, 2)}

Verify:
1. Did the judge cite specific evidence packets (by subtask_id) for each claim? Flag any unsupported claims.
2. Did the judge ignore any evidence packet? Check that every subtask_id is referenced or explicitly noted as insufficient.
3. Is the confidence level calibrated? Does the evidence quality and coverage support the stated confidence?
4. What scenario would make this verdict wrong? Is it acknowledged in risk_flags?
5. Are there data quality issues (from the packets' data_quality_issues) that undermine the verdict?
6. Did the judge infer beyond the evidence? Flag any claim not traceable to a data point.

Verdict: PASS if the verdict is well-supported and risks are adequately flagged. FAIL if there are unsupported claims, ignored evidence, unacknowledged risks, or overreach beyond the evidence.

Return the worker contract JSON. Put verification results in payload_json.`,
      { label: "verify-verdict", tier: verifyTier, schema: VERIFY_CONTRACT }
    )
  } catch (err) {
    log(`Verify phase failed (${String(err)}). Delivering judgment without adversarial verification.`)
    verification = {
      outcome: "Verification phase failed — judgment delivered WITHOUT adversarial review.",
      payload_json: JSON.stringify({ verdict: "skipped", critical_failures: ["verify phase error: " + String(err)], checks: [] }),
    }
  }

  if (verification && typeof verification.payload_json === "string") {
    try { verifyPayload = JSON.parse(verification.payload_json) } catch { verifyPayload = null }
  }
}

log("gather-judge-split complete")

// ── Assemble report ─────────────────────────────────────────
const verdict = judgePayload?.verdict || judgment?.outcome || "No verdict produced"
const confidence = judgePayload?.confidence || "unknown"
const conflicts = judgePayload?.conflicts || []
const riskFlags = judgePayload?.risk_flags || []
const assumptions = judgePayload?.assumptions || []
const verifyVerdict = runVerify ? (verifyPayload?.verdict || "unknown") : "skipped (verify disabled)"
const criticalFailures = runVerify ? (verifyPayload?.critical_failures || []) : []
const recalibration = runVerify ? (verifyPayload?.recalibration || "none") : "none"

let report = `Gather/judge separation complete.

Question: ${question}

VERDICT: ${verdict}
Confidence: ${confidence}${recalibration !== "none" && recalibration !== "low" ? ` (verifier recommends recalibration to ${recalibration})` : ""}

Evidence packets: ${evidencePackets.length} from ${gatherResults.length} gatherers
Subtasks investigated: ${subtasks.length}
Decision-violation stripping: ${decisionViolations.length} gatherer(s) had decisions stripped

Conflicts identified: ${conflicts.length > 0 ? conflicts.map(c => `[${(c.subtask_ids||[]).join(",")}] ${c.description}`).join("; ") : "none"}
Risk flags: ${riskFlags.length > 0 ? riskFlags.join("; ") : "none"}
Assumptions: ${assumptions.length > 0 ? assumptions.join("; ") : "none"}

Verification: ${verifyVerdict}${criticalFailures.length > 0 ? "\nCRITICAL FAILURES: " + criticalFailures.join("; ") : ""}`

return {
  report,
  question,
  brief: { subtasks: subtasks.length, outcome: brief.outcome },
  gather: {
    packets: evidencePackets.length,
    workers: gatherResults.length,
    decision_violations_stripped: decisionViolations.length,
  },
  judge: {
    verdict,
    confidence,
    supporting_evidence: judgePayload?.supporting_evidence || [],
    opposing_evidence: judgePayload?.opposing_evidence || [],
    conflicts,
    risk_flags: riskFlags,
    assumptions,
  },
  verify: runVerify
    ? { verdict: verifyVerdict, critical_failures: criticalFailures, recalibration, checks: verifyPayload?.checks || [] }
    : { verdict: "skipped", reason: "verify disabled via args" },
}
