// Investment-Engine 3-node DAG with shared state + convergence gate.
//
// Topology:
//   research (fan-out: macro + sector + sentiment, in parallel)
//        │  writes {macro, sector, sentiment} to SharedStore
//        ▼
//   portfolio-builder  (calls Investment-Engine MCP; reads store; writes {allocation})
//        │
//        ▼
//   risk-review (gate: breaches? → loops back to portfolio-builder with feedback)
//        │  ok
//        ▼
//   report
//
// Edges that make this a *graph*, not a pipeline:
//   - fan-in: portfolio-builder depends on all 3 research leaves.
//   - skip connection: risk-review reads the research notes from the store
//     (non-adjacent), not just the allocation.
//   - cycle: risk-review → portfolio-builder until the gate passes.
//   - shared mutable state: the SharedStore is the blackboard all nodes use.
//
// Run via the `workflow` tool: { script: <this file>, args: { ... } }

export const meta = {
  name: "investment-engine-dag",
  description: "3-node DAG: research → portfolio(MCP) → risk-gate, shared blackboard.",
};

// Agent result contract (per ce-lite): terse JSON with
// outcome / evidence / changes / decisions / failures_risks / new_tasks.
const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["outcome"],
  properties: {
    outcome: { type: "string" },
    evidence: { type: "string" },
    decisions: { type: "string" },
    failures_risks: { type: "string" },
  },
};

export async function main() {
  phase("research");
  const ticker = args?.ticker ?? "VTI";

  // Node 1: three independent research leaves in parallel.
  // Each writes its finding to the SharedStore so non-adjacent nodes
  // (risk-review) can read them without re-piping through portfolio-builder.
  const leaves = [
    { key: "macro", lens: "macroeconomic regime, rates, liquidity" },
    { key: "sector", lens: `sector and single-name signals for ${ticker}` },
    { key: "sentiment", lens: "30-day sentiment / flow / positioning" },
  ];

  const research = await parallel(
    leaves.map((l) => () =>
      agent(
        `You are a research node. Lens: ${l.lens}.` +
          `\nWrite a concise finding (<=200 words) to the shared blackboard with store_put(key="${l.key}", value=<your finding>).` +
          `\nReturn terse JSON: outcome (1-2 sentences), evidence (citations or data points), failures_risks.`,
        { label: `research-${l.key}`, schema: RESULT_SCHEMA }
      )
    )
  );

  // Fan-in: all three leaves done before the next node.
  // (parallel() already barriered; we just proceed.)

  phase("portfolio");
  // Node 2: portfolio builder. Reads the blackboard, calls the MCP.
  // Uses gate() for the cycle back from risk-review.
  const PORTFOLIO_SCHEMA = {
    ...RESULT_SCHEMA,
    properties: {
      ...RESULT_SCHEMA.properties,
      allocation: {
        type: "object",
        description: "ticker -> weight",
        additionalProperties: { type: "number" },
      },
    },
    required: ["outcome", "allocation"],
  };

  const buildPortfolio = (feedback) =>
    agent(
      `You are the portfolio-construction node.` +
        `\nRead the research blackboard with store_get("macro"), store_get("sector"), store_get("sentiment").` +
        `\nUse the Investment-Engine MCP tools to build a portfolio for ${ticker}.` +
        (feedback ? `\nRisk review rejected the prior allocation. Fix: ${feedback}` : "") +
        `\nWrite your allocation to the blackboard with store_put(key="allocation", value=<allocation JSON>).` +
        `\nReturn terse JSON with an "allocation" field (ticker -> weight) plus the standard contract fields.`,
      { label: "portfolio-builder", schema: PORTFOLIO_SCHEMA }
    );

  // Node 2 + Node 3 cycle: build, then risk-review, loop on rejection.
  const GATE_MAX = 3;
  let allocation = null;
  let lastFeedback = undefined;

  const gated = await gate(
    async (feedback) => {
      lastFeedback = feedback;
      const r = await buildPortfolio(feedback);
      allocation = r?.allocation ?? null;
      return r;
    },
    // validator = the risk-review node
    async (buildResult) => {
      const review = await agent(
        `You are the risk-review node.` +
          `\nRead store_get("allocation") and the research notes (store_get macro/sector/sentiment).` +
          `\nCheck concentration, leverage, drawdown, and mandate fit.` +
          `\nReturn JSON: { ok: boolean, feedback?: string }. ok=false means reject and re-build.`,
        {
          label: "risk-review",
          schema: {
            type: "object",
            required: ["ok"],
            properties: {
              ok: { type: "boolean" },
              feedback: { type: "string" },
            },
          },
        }
      );
      return review ?? { ok: false, feedback: "review returned null" };
    },
    { attempts: GATE_MAX }
  );

  if (!gated.ok) {
    log(`risk gate did not pass in ${GATE_MAX} attempts; delivering best-effort allocation`);
  }

  phase("report");
  // Node 4: report. Reads the allocation + all research notes from the store
  // (skip connections to nodes it never directly received output from).
  const report = await agent(
    `You are the report node.` +
      `\nRead the final allocation from store_get("allocation") and the research notes from store_get("macro"), store_get("sector"), store_get("sentiment").` +
      `\nWrite a concise investment memo for ${ticker}: thesis, allocation table, risks, and the gate outcome (${gated.ok ? "passed" : "best-effort after " + GATE_MAX + " attempts"}).` +
      `\nReturn terse JSON: outcome (the memo, or a path to it), evidence, decisions, failures_risks.`,
    { label: "report", schema: RESULT_SCHEMA }
  );

  return {
    ticker,
    gatePassed: gated.ok,
    gateAttempts: gated.attempts,
    allocation,
    research: research.map((r, i) => ({ leaf: leaves[i].key, result: r })),
    report,
  };
}
