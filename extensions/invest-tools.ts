// invest-tools — pi extension wrapping the invest-optimizer skill's stdlib
// python tools as native agent tools. No MCP, no pip, no third-party deps.
//
//   invest_pulse     Phase 2 regime data (2A-2G) with METRICS.md verdicts
//   invest_optimize  Phase 3.5 weights: HRP / minvar / riskpar / invvol
//   invest_risk      Phase 4 forward risk: maxDD, CVaR, tail, Calmar, MC bust
//
// All three shell out to scripts in the skill folder; each returns stdout.
// Source of truth for endpoints/thresholds: the scripts' docstrings.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import { homedir } from "node:os"
import { join } from "node:path"

// Edit this if your skills live elsewhere.
const TOOLS_DIR = join(homedir(), ".pi", "agent", "skills", "invest-optimizer", "tools")
const TICKER_RE = /^[A-Za-z][A-Za-z.]{0,5}$/
const POSITION_RE = /^[A-Za-z][A-Za-z.]{0,5}:\d*\.?\d+$/

async function runScript(
  pi: ExtensionAPI,
  script: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const r = await pi.exec("python3", [`${TOOLS_DIR}/${script}`, ...args], {
    timeout: timeoutMs,
    signal,
  })
  if (r.killed) return `ERROR: ${script} timed out after ${timeoutMs / 1000}s — GAP that axis, brief still ships.`
  const out = (r.stdout || "").trim()
  const err = (r.stderr || "").trim()
  if (r.code !== 0) return `ERROR (${script} exit ${r.code}): ${err || out || "no output"}`
  return out || err || "(no output)"
}

export default async function (pi: ExtensionAPI) {
  const probe = await pi.exec("python3", ["--version"], { timeout: 5_000 })
  if (probe.code !== 0) {
    console.warn("[invest-tools] python3 not found — extension disabled")
    return
  }

  pi.registerTool({
    name: "invest_pulse",
    label: "Market Pulse",
    description:
      "Pull the invest-optimizer Phase 2 regime snapshot: valuation (Shiller CAPE, Buffett, SP500/M2), " +
      "complacency (VIX, HY credit spread), macro (10y-2y curve), microstructure tail-day proxy, " +
      "Polymarket recession/rate-hike probabilities, 60d equity/equity-bond correlations, and a 2-state " +
      "HMM regime read — each mapped to METRICS.md verdicts. Use at the start of any portfolio/regime question.",
    promptSnippet: "invest_pulse: full market-regime snapshot (2A-2G) with verdicts — run before portfolio posture work",
    parameters: Type.Object({
      terms: Type.Optional(Type.Array(Type.String(), {
        description: "Extra Polymarket search terms, e.g. ['oil', 'fed september']",
      })),
      json: Type.Optional(Type.Boolean({ description: "Machine-readable output" })),
    }),
    async execute(_id, params, signal) {
      const args: string[] = [...(params.terms ?? []).filter((t) => t.length < 60)]
      if (params.json) args.push("--json")
      const text = await runScript(pi, "market_pulse.py", args, 120_000, signal)
      return { content: [{ type: "text", text }], details: {} }
    },
  })

  pi.registerTool({
    name: "invest_optimize",
    label: "Weight Optimizer",
    description:
      "Phase 3.5 allocation weights from ~6 months of daily prices. Return-free models only (hrp default — " +
      "robust under EXTREME/BUBBLE valuation reads): hrp | minvar | riskpar | invvol. Long-only, sums to 100%, " +
      "per-name cap, reports effective N, ann vol, daily CVaR95, and a +0.3 correlation-shock stability check.",
    promptSnippet: "invest_optimize: HRP-class portfolio weights with stress checks for a ticker universe",
    parameters: Type.Object({
      tickers: Type.Array(Type.String({ description: "Ticker, e.g. JEPI" }), { minItems: 2, maxItems: 15 }),
      model: Type.Optional(Type.Union([
        Type.Literal("hrp"), Type.Literal("minvar"),
        Type.Literal("riskpar"), Type.Literal("invvol"),
      ])),
      cap: Type.Optional(Type.Number({ description: "Per-name weight cap, default 0.30" })),
    }),
    async execute(_id, params, signal) {
      const tickers = params.tickers.map((t) => t.toUpperCase()).filter((t) => TICKER_RE.test(t))
      if (tickers.length < 2) {
        return { content: [{ type: "text", text: "ERROR: need >=2 valid tickers" }], details: {} }
      }
      const args = [...tickers, "--model", params.model ?? "hrp"]
      if (params.cap) args.push("--cap", String(params.cap))
      const text = await runScript(pi, "optimize.py", args, 120_000, signal)
      return { content: [{ type: "text", text }], details: {} }
    },
  })

  pi.registerTool({
    name: "invest_risk",
    label: "Forward Risk",
    description:
      "Phase 4 forward risk for a proposed mix: historical max drawdown, daily VaR/CVaR(95), tail ratio, " +
      "Calmar, and Monte Carlo bust probability P(maxDD <= -loss tolerance) via bootstrap resampling. " +
      "Gate: bust >25% moderate / >10% conservative -> downgrade posture one rung.",
    promptSnippet: "invest_risk: forward risk + MC bust probability for a weighted mix (positions as TICKER:WEIGHT)",
    parameters: Type.Object({
      positions: Type.Array(Type.String({ description: "TICKER:WEIGHT, e.g. 'JEPI:0.22'" }), { minItems: 1 }),
      lossTolerance: Type.Optional(Type.Number({ description: "Max tolerable drawdown, default 0.25" })),
      horizonDays: Type.Optional(Type.Number({ description: "MC horizon in trading days, default 63" })),
      paths: Type.Optional(Type.Number({ description: "MC paths, default 1000" })),
      goal: Type.Optional(Type.Number({ description: "Target equity multiple for goal probability, e.g. 1.10" })),
    }),
    async execute(_id, params, signal) {
      const positions = params.positions.filter((p) => POSITION_RE.test(p))
      if (!positions.length) {
        return { content: [{ type: "text", text: "ERROR: positions must look like JEPI:0.22" }], details: {} }
      }
      const args = [...positions]
      if (params.lossTolerance) args.push("--loss-tol", String(params.lossTolerance))
      if (params.horizonDays) args.push("--horizon", String(params.horizonDays))
      if (params.paths) args.push("--paths", String(params.paths))
      if (params.goal) args.push("--goal", String(params.goal))
      const text = await runScript(pi, "risk.py", args, 120_000, signal)
      return { content: [{ type: "text", text }], details: {} }
    },
  })
}
