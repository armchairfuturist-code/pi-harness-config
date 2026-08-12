// review-fix-graph.js — Code review + fix loop as an authored graph.
//
// Demonstrates the three additive graph primitives that plain parallel()/pipeline()
// cannot express:
//
//   1. SharedStore      — reviewer, scanner, fixer, and verifier all read/write
//                         a shared blackboard (store_put / store_get).  Non-adjacent
//                         nodes share state without piping through intermediaries.
//   2. Fan-in           — the fixer node depends on TWO parallel upstream branches
//                         (code reviewer + security scanner).  Promise.all over the
//                         parallel leaves is the fan-in barrier.
//   3. Cycle (gate)     — fixer → re-review → (back to fixer if issues remain)
//                         until the verifier says clean or max iterations exhausted.
//
// Topology:
//
//   ┌───────────────┐        ┌────────────────────┐
//   │  reviewer (A) │        │  security-scan (B) │   ← parallel fan-out
//   └───────┬───────┘        └─────────┬──────────┘
//           │  writes issues:review      │  writes issues:security
//           │                            │
//           ▼                            ▼
//      ════════════════════════════════════════════
//        fan-in barrier  (Promise.all / parallel)
//      ════════════════════════════════════════════
//                     │
//                     ▼
//           ┌─────────────────┐
//     ┌────►│     fixer       │  reads issues:* from store
//     │     │  (applies fixes)│  writes fix:latest to store
//     │     └────────┬────────┘
//     │              │
//     │              ▼
//     │     ┌─────────────────┐
//     │     │  re-review      │  reads fix:latest + issues:* from store
//     │     │  (verifier)     │  (skip connections to A and B)
//     │     └────────┬────────┘
//     │              │ ok=false + feedback ──┐
//     └──────────────┘                       │  cycle (gate)
//                │ ok=true                   │
//                ▼                           │
//           ┌─────────────────┐              │
//           │     report      │  reads entire store
//           └─────────────────┘
//
// Usage:
//   workflow({ script: <this file>, args: { target: "src/auth/", maxIterations: 3 } })
//
// Args:
//   target         — file path, glob, or description of what to review (default: cwd)
//   maxIterations  — gate attempts before delivering best-effort (default: 3, max: 5)

export const meta = {
  name: "review-fix-graph",
  description:
    "Code-review + security-scan fan-out → fan-in merge → fix/re-review cycle (gate) → report. Demonstrates SharedStore, fan-in, and cycles.",
  phases: [
    { title: "scan" }, // parallel fan-out: reviewer + security scanner
    { title: "fix-loop" }, // gate cycle: fixer ↔ re-review
    { title: "report" }, // converge and summarise
  ],
};

// ── Args (module scope — read before main) ──────────────────────────────

const target =
  args && typeof args.target === "string" && args.target.trim().length > 0
    ? args.target.trim()
    : cwd || ".";

const MAX_ITER = (() => {
  const n =
    args && Number.isInteger(args.maxIterations) ? args.maxIterations : 3;
  return Math.max(1, Math.min(n, 5));
})();

// ── Schemas (module scope — immutable) ──────────────────────────────────

// Standard ce-lite result contract.
const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["outcome"],
  properties: {
    outcome: { type: "string" },
    evidence: { type: "string" },
    changes: { type: "string" },
    decisions: { type: "string" },
    failures_risks: { type: "string" },
  },
};

// Each issue has a stable id so the re-review verifier can check it was addressed.
const ISSUE_SCHEMA = {
  type: "object",
  required: ["issues"],
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "severity", "file", "description"],
        properties: {
          id: {
            type: "string",
            description: 'Stable short id, e.g. REV-001 or SEC-001',
          },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          file: { type: "string", description: "File path or location" },
          line: { type: "string", description: "Line or range, optional" },
          description: { type: "string" },
          suggestion: { type: "string", description: "How to fix, optional" },
        },
      },
    },
  },
};

// Verifier verdict — drives the gate cycle.
const VERDICT_SCHEMA = {
  type: "object",
  required: ["ok", "resolved", "remaining"],
  properties: {
    ok: { type: "boolean", description: "true = all issues resolved" },
    resolved: {
      type: "array",
      items: { type: "string" },
      description: "Issue ids confirmed fixed",
    },
    remaining: {
      type: "array",
      items: { type: "string" },
      description: "Issue ids still open",
    },
    feedback: {
      type: "string",
      description: "Actionable feedback for the fixer if ok=false",
    },
  },
};

// ── Main ────────────────────────────────────────────────────────────────

export async function main() {
  log(`review-fix-graph: target="${target}" maxIterations=${MAX_ITER}`);

  // ── Phase 1: Parallel fan-out (reviewer + security scanner) ───────────
  //
  // Both nodes run concurrently.  Each writes its issue list to the SharedStore
  // so the fixer and re-reviewer can read them later (skip connections).

  phase("scan");

  const [reviewResult, securityResult] = await parallel([
    // Node A — code reviewer
    () =>
      agent(
        `You are a code-review node. Review the code at or described by: ${target}\n` +
          `Focus on: correctness, error handling, edge cases, readability, and testability.\n` +
          `Assign each issue a stable id starting with "REV-" (e.g. REV-001).\n` +
          `Write your full issue list to the shared blackboard:\n` +
          `  store_put(key="issues:review", value=<your issues array as JSON>)\n` +
          `Return terse JSON with an "issues" array. If the code is clean, return an empty array.`,
        { label: "code-reviewer", schema: ISSUE_SCHEMA }
      ),

    // Node B — security scanner
    () =>
      agent(
        `You are a security-scanning node. Analyse the code at or described by: ${target}\n` +
          `Focus on: injection, authn/authz, secret leakage, unsafe deserialization, dependency risks.\n` +
          `Assign each issue a stable id starting with "SEC-" (e.g. SEC-001).\n` +
          `Write your full issue list to the shared blackboard:\n` +
          `  store_put(key="issues:security", value=<your issues array as JSON>)\n` +
          `Return terse JSON with an "issues" array. If no security issues, return an empty array.`,
        { label: "security-scanner", schema: ISSUE_SCHEMA }
      ),
  ]);

  const reviewIssues = reviewResult?.issues ?? [];
  const securityIssues = securityResult?.issues ?? [];
  const allIssues = [...reviewIssues, ...securityIssues];

  log(
    `fan-in complete: ${reviewIssues.length} review + ${securityIssues.length} security = ${allIssues.length} total issues`
  );

  // Fast path: nothing to fix.
  if (allIssues.length === 0) {
    phase("report");
    const cleanReport = await agent(
      `You are the report node. Both the code reviewer and security scanner found ZERO issues for: ${target}\n` +
        `Confirm the clean bill of health and note what was checked.\n` +
        `Return terse JSON: outcome, evidence, decisions.`,
      { label: "report", schema: RESULT_SCHEMA }
    );
    return {
      target,
      gatePassed: true,
      gateAttempts: 0,
      totalIssues: 0,
      reviewIssues: [],
      securityIssues: [],
      report: cleanReport,
    };
  }

  // ── Phase 2: Fix / re-review cycle (gate) ─────────────────────────────
  //
  // The gate is the back-edge:
  //   thunk     = fixer (applies fixes, reads issues from store, writes fix:latest)
  //   validator = re-review (reads fix:latest + original issues, returns ok/feedback)
  //
  // gate() feeds the validator's feedback string back into the thunk on each
  // iteration, giving the fixer targeted guidance.

  phase("fix-loop");

  // Track the verifier's ledger for the final report.
  const gateLedger = [];

  const gateOutcome = await gate(
    // ── Fixer node ──
    async (feedback, attempt) => {
      const iteration = attempt + 1;
      log(
        `fixer: iteration ${iteration}/${MAX_ITER}${feedback ? " (with feedback)" : ""}`
      );

      const fixResult = await agent(
        `You are the fixer node (iteration ${iteration} of ${MAX_ITER}).\n` +
          `Target: ${target}\n\n` +
          `Read the issue lists from the shared blackboard:\n` +
          `  store_get("issues:review")  — code-review issues\n` +
          `  store_get("issues:security") — security issues\n\n` +
          `Address EVERY issue. For each one, either apply the fix or explain why it is a false positive.\n` +
          (feedback
            ? `\nThe re-reviewer rejected the previous fix iteration. Address this feedback:\n  ${feedback}\n`
            : `\nThis is the first fix iteration.\n`) +
          `\nWrite a summary of what you changed (or dismissed) to the blackboard:\n` +
          `  store_put(key="fix:latest", value=<summary of fixes applied and issue ids addressed>)\n` +
          `\nReturn terse JSON: outcome (what you fixed), changes (files touched), decisions (false positives dismissed), failures_risks.`,
        { label: `fixer:${iteration}`, schema: RESULT_SCHEMA }
      );

      gateLedger.push({
        iteration,
        hadFeedback: feedback != null,
        fixSummary: fixResult?.outcome ?? null,
      });

      return fixResult;
    },

    // ── Re-review / verifier node ──
    async (fixResult) => {
      const verdict = await agent(
        `You are the re-review verifier node.\n` +
          `Target: ${target}\n\n` +
          `Read from the shared blackboard:\n` +
          `  store_get("issues:review")   — original code-review issues\n` +
          `  store_get("issues:security")  — original security issues\n` +
          `  store_get("fix:latest")       — what the fixer claims to have addressed\n\n` +
          `For each issue id, determine whether it is now resolved.\n` +
          `Return JSON with:\n` +
          `  ok: true only if ALL issues are resolved (or confirmed false positives)\n` +
          `  resolved: array of issue ids confirmed fixed\n` +
          `  remaining: array of issue ids still open\n` +
          `  feedback: if ok=false, give the fixer specific actionable guidance on what remains`,
        { label: "re-review", schema: VERDICT_SCHEMA }
      );

      const ok = verdict?.ok === true;
      const remaining = verdict?.remaining ?? [];
      const feedback =
        verdict?.feedback ??
        (remaining.length > 0
          ? `These issues remain unresolved: ${remaining.join(", ")}`
          : "Issues not confirmed resolved.");

      log(
        `re-review: ok=${ok} resolved=${(verdict?.resolved ?? []).length} remaining=${remaining.length}`
      );

      return ok ? { ok: true } : { ok: false, feedback };
    },

    { attempts: MAX_ITER }
  );

  // ── Phase 3: Report ───────────────────────────────────────────────────
  //
  // The report node reads the ENTIRE blackboard — original issues, the latest
  // fix summary, and the gate outcome — via skip connections to nodes it never
  // directly received output from.  This is the convergence point.

  phase("report");

  const report = await agent(
    `You are the report node. Produce a final code-review summary.\n\n` +
      `Read the full review state from the shared blackboard:\n` +
      `  store_get("issues:review")   — original code-review issues\n` +
      `  store_get("issues:security") — original security issues\n` +
      `  store_get("fix:latest")      — the fixer's latest summary\n\n` +
      `Target reviewed: ${target}\n` +
      `Gate outcome: ${gateOutcome.ok ? "PASSED" : "EXHAUSTED"} after ${gateOutcome.attempts} iteration(s)\n\n` +
      `Write a concise summary covering:\n` +
      `1. Issues found (by category: review vs security, by severity)\n` +
      `2. Issues resolved vs remaining\n` +
      `3. Files changed and key decisions (including dismissed false positives)\n` +
      `4. Outstanding risks if the gate did not pass\n\n` +
      `Return terse JSON: outcome (the summary), evidence, changes, decisions, failures_risks.`,
    { label: "report", schema: RESULT_SCHEMA }
  );

  // ── Return ────────────────────────────────────────────────────────────

  return {
    target,
    gatePassed: gateOutcome.ok,
    gateAttempts: gateOutcome.attempts,
    totalIssues: allIssues.length,
    reviewIssues,
    securityIssues,
    gateLedger,
    report,
  };
}
