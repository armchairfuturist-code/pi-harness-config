---
name: invest-optimizer
description: "Recalibrate portfolio posture to market regime and goals. Use when the user wants a portfolio review or posture shift; for a market-conditions read with no portfolio changes, run the Quick pulse branch."
---

# Invest Optimizer

Recalibrate portfolio **posture** — the portfolio's overall stance expressed as concrete allocation shifts — to the current market **regime** through the lens of personal investment goals.

Reference files:
- [`METRICS.md`](METRICS.md) — market metric thresholds and synthesis rules
- [`POSTURE.md`](POSTURE.md) — posture × goals calibration matrix
- [`OPTIMIZATION.md`](OPTIMIZATION.md) — optimizer models, views, covariance defaults
- [`SCREENING.md`](SCREENING.md) — individual stock technical gates

## Phase 1 — Anchor to goals

Load a **goal profile**: a structured record of the user's investment objectives. If the system has a goal intake (e.g. Quinn's `/goal-intake`), load the latest confirmed profile. Otherwise infer from context or ask the user. The goal anchor is the fixed reference every downstream assessment recalibrates against.

| Axis | Values | Why it matters |
|---|---|---|
| Primary objective | income / growth / balanced / preservation | Sets the top-line compass — every downstream posture decision recalibrates against this axis |
| Risk tolerance | conservative / moderate / aggressive | How far from neutral the posture can deviate |
| Investor type | day trader / swing trader / income investor / growth holder | Determines recommendation granularity — traders need entry/exit levels and stops; income investors need yield safety checks; growth holders need macro-driven allocation shifts |
| Time horizon | <1 / 1-5 / 5-15 / 15+ years | Short horizons can't wait out recession; long ones average through |
| Income cadence | weekly / monthly / quarterly / annual / none | recommendations prioritize dividend safety and yield vs total-return reinvestment |
| Concentration | concentrated / balanced / broad | Concentrated tolerates sector risk; broad needs diversification |

**Completion criterion:** Every axis in the goal profile table populated and noted.

## Phase 2 — Read the regime

Recalibrate current market conditions across the structural axes using the thresholds in [`METRICS.md`](METRICS.md). For each axis produce a verdict, then synthesize a single **market pulse**.

### 2A — Valuation: how expensive are stocks vs fundamentals?

Check: **Shiller CAPE**, **Buffett Indicator**, **Tobin's Q**, **S&P 500 ÷ M2**.
Verdict: CHEAP / FAIR / RICH / EXTREME / BUBBLE

### 2B — Complacency & credit: is everyone pricing in zero risk?

Check: **VIX**, **high-yield credit spread**.
Verdict: COMPLACENT / NEUTRAL / CONCERN / FEAR / PANIC

### 2C — Macro: is a recession brewing underneath?

Check: **Yield curve (10y − 2y)**.
Verdict: EXPANSION / WARNING / RECESSION / CRISIS

### 2D — Microstructure: who is driving price action?

When AI trading agents compose a large share of daily volume, their herding creates the **parabolic-and-drop** regime — vertical parabolic surges followed by random liquidity vacuums and flash crashes — that breaks traditional option strategies.

Check: **AI trading volume share**, **intraday tail frequency** (days with >3% single-stock intraday reversals), **flash crash count** (rolling 30-day).
Thresholds and verdicts in [`METRICS.md`](METRICS.md).
Verdict: HUMAN-DOMINATED / HUMAN-MIXED / AGENT-DOMINATED / AGENT-SATURATED

### 2E — Event/prediction: what are live probability markets pricing?

Use `polymarket-cli` (or equivalent) to anchor probability-driven verdicts that complement the structural axes.

Measures: Polymarket-implied probability of recession within 12m, rate-hike probability, sector-outcome markets.
Verdict: [RECESSION p≥0.30 / NEUTRAL p0.10–0.29 / BULLISH p<0.10]

A RICH + COMPLACENT + RECESSION p≥0.30 is LATE CYCLE with extra conviction; a FAIR + ANXIOUS + BULLISH p<0.10 warns the market is pricing tail risk lower than your structural read — flag the tension.

### 2F — Correlation: is diversification real?

Check: **average pairwise equity correlation**, **equity–bond correlation**. Thresholds in [`METRICS.md`](METRICS.md).
Verdicts: DIVERSIFIED / NORMAL / ELEVATED / CRISIS-CORR and BALLAST-OK / WEAK-BALLAST / CO-CRASH.

### Synthesis

Weight axes 2A–2E into the core pulse (EXPANSION / LATE CYCLE / CONTRACTION / CRISIS). Apply **modifiers** from microstructure (2D) and correlation (2F):

- AGENT-DOMINATED + high valuation → crash severity elevated (parabolic-and-drop becomes structural)
- AGENT-DOMINATED + LATE CYCLE → rotation severity elevated (agents herd exits faster than humans)
- AGENT-DOMINATED × any pulse → **monthly ATM covered calls structurally underperform**
- CRISIS-CORR or CO-CRASH → non-equity hedge floors rise; name-count diversification claims are invalid
- CO-CRASH + LATE CYCLE → duration is not the hedge; prefer cash/T-bills/collars

### 2G — Statistical regime confirmation (optional)

If a Markov/HMM regime tool is available, run it on a broad proxy (SPY or the user's equity benchmark) and report current regime, persistence, and stationary mix per [`METRICS.md`](METRICS.md). Use as confirmation or tension flag against the structural pulse — never as a silent override.

**Completion criterion:** Verdicts for 2A–2F each supported by at least one metric reading; synthesized pulse with explicit weighting rationale; modifiers (microstructure, correlation) stated; 2G present or explicitly skipped with gap noted.

### Tool fallback

Data and quant tools, in preference order when present: OpenBB / system market feeds → `polymarket-cli` → yfinance-class price pulls → manual METRICS.md checks. Optimizers are Phase 3.5 (`skfolio`, `Riskfolio-Lib`, `PyPortfolioOpt`). A missing tool downgrades that step; the brief still ships.

## Phase 3 — Calibrate posture

Map the market pulse against the goal anchor using **[the posture matrix](POSTURE.md)**. The matrix is the cross-product: same pulse × different goals → different postures.

When 2D verdict is AGENT-DOMINATED or AGENT-SATURATED, apply the **[Agent-Market Microstructure Addendum](POSTURE.md#agent-market-microstructure-addendum)** as a modifier on all income instrument recommendations. Standard allocation templates remain valid for broad asset-class posture but individual income vehicles must be filtered through the addendum's preference hierarchy — use the **parabolic-and-drop** framing to explain why short-duration options outperform monthly in agent-dominated regimes.

When 2F is CRISIS-CORR or CO-CRASH, apply the correlation rules in POSTURE.md: raise non-equity hedge floors and forbid "diversified by ticker count" language.

For each area the portfolio touches, produce:

1. **Current posture** — what the portfolio looks like now
2. **Target posture** — per the matrix, given the pulse and goals
3. **Actions** — specific trades or shifts to close the gap
4. **Risk gate** — the observable condition that, if met, breaks the thesis and triggers a posture revert

When the posture implies individual stock picks, apply the technical gates in [`SCREENING.md`](SCREENING.md).

**Completion criterion:** At least one concrete recommendation per portfolio area (equities, fixed income, alternatives, cash, sector tilts, income instruments as applicable), each with target posture, specific actions, and a risk gate.

## Phase 3.5 — Optimize weights

Translate the target posture from Phase 3 into mathematically grounded allocation weights. Heuristic templates give ranges; optimization gives exact weights **inside** those ranges. Full model menu, covariance defaults, Entropy Pooling/BL view encoding, and stress checks: [`OPTIMIZATION.md`](OPTIMIZATION.md).

1. Build the candidate universe (equities, ETFs, bonds per the target posture tilt + SCREENING survivors)
2. Select tool and model per OPTIMIZATION.md — prefer **skfolio**, then Riskfolio-Lib, then PyPortfolioOpt; match model to goal × pulse (HRP when valuations are EXTREME; DR-CVaR or CDaR under AGENT-DOMINATED; NCO when universe >12 and correlations unstable)
3. Set covariance prior (default **Ledoit-Wolf shrinkage**) and expected-return prior (James-Stein / BL equilibrium — not raw historical means)
4. Encode Phase 2 pulse as a small BL or Entropy Pooling view set (OPTIMIZATION.md table); scale view confidence by axis agreement
5. Constrain to posture asset-class bands, sector/name ceilings, and turnover budget if prior weights exist
6. Solve; run optimizer-level stress checks (in-band, concentration, CVaR sanity, correlation-break)
7. Optional: discrete allocation to share counts when deployable cash and prices are known
8. Optional large gap (>15% equity shift): note turnover/cost path (cvxportfolio-class multi-period) without blocking the brief

If no optimizer is available, fall back to equal-weight or inverse-volatility within target bands and state the gap.

**Completion criterion:** Every recommended asset has an explicit weight, optimized or fallback, summing to 100% inside posture bands; model + risk measure + covariance method named; stress checks passed or fallback path stated.

## Phase 4 — Risk check

Before outputting, validate recommendations against system risk constraints and forward risk analytics. If system values aren't available, use defaults:

- [ ] Position size within goal-appropriate limits
- [ ] Sector concentration under ceiling (≤30% per sector default)
- [ ] Single-name ceiling respected (concentrated vs broad from goal profile)
- [ ] Leverage under cap (≤1.25× default)
- [ ] Polymarket-implied recession probability matches posture level (LATE CYCLE → recession p context; BULLISH tilt → p<0.10)
- [ ] Correlation modifier honored (CRISIS-CORR/CO-CRASH → non-equity hedges present)
- [ ] Drawdown / CVaR within loss tolerance from goal profile

### Forward risk analytics

When return history for the recommended mix (or proxy ETFs) is available — via quantstats-class tooling or manual calc — report:

| Metric | Role |
|---|---|
| Historical max drawdown | Sanity vs goal loss tolerance |
| CVaR (expected shortfall) | Tail loss beyond VaR |
| Tail ratio / Calmar | Asymmetry and drawdown-adjusted return |
| Monte Carlo bust probability | P(DD ≤ −loss_tolerance); default 1000 paths |
| Monte Carlo goal probability | Only if the profile states a return target + horizon |

Gate: bust probability above comfort (default >25% moderate, >10% conservative/preservation) → downgrade posture one rung or cut equity band and re-run 3.5. If MC tooling is unavailable, use historical max DD + CVaR and state the gap.

If a Markov stationary mix is available from 2G, scale tactical risk: high long-run Bear share → smaller active tilts (stationary distribution as a size modifier).

If any recommendation violates a limit, downgrade the posture to the next safe rung. State the violation and the downgrade explicitly.

### Regime validation

If a prior posture brief exists, check whether the previous regime read was confirmed or contradicted by subsequent market action:

- **Confirmed** — metrics moved in the predicted direction (e.g. prior LATE CYCLE → yield curve un-inverted or spreads widened)
- **Contradicted** — metrics moved against (e.g. prior LATE CYCLE → VIX dropped and spreads tightened)
- **Mixed** — some axes confirmed, others didn't → note which and adjust confidence in the current read

A contradicted prior read lowers confidence in regime calls depending on the same axes. State the adjustment explicitly.

**Completion criterion:** Every recommendation checked against risk limits and forward analytics (or gap noted). Violations blocked or downgraded with reason. Prior regime read validated as confirmed, contradicted, or mixed with confidence adjustment stated.

## Output format

Present as a structured posture brief. The format adapts to **investor type** — traders get levels, stops, and position sizing; holders get allocation shifts and review cadence.

```markdown
## Posture brief — {date}

### Profile
- Primary: growth · Trader type: long-term holder · Horizon: 10+ years
- *Why this matters:* long-term holder tolerates late-cycle drawdowns and averages through; a day trader would tighten stops and halve position size.

### Market pulse
| Axis | Verdict |
|---|---|
| Valuation | RICH |
| Complacency | COMPLACENT |
| Macro | RECESSION WARNING |
| Microstructure | AGENT-DOMINATED |
| Prediction | RECESSION p=0.34 |
| Correlation | ELEVATED / WEAK-BALLAST |
| **Overall** | **LATE CYCLE** (+ corr & agent modifiers) |

### Posture
| Area | Current | Target | Action | Risk gate |
|---|---|---|---|---|
| Equity allocation | 80% | 65% | Trim 15% → cash/short bonds | Redeploy if CAPE < 25 |
| Sector tilt | Tech-heavy | Add defensive | Buy XLP, XLU | Exit if VIX > 30 |
| Duration | 5yr | 2yr | Shorten bond portfolio | — |

### Weights (Phase 3.5)
| Asset | Weight | Notes |
|---|---|---|
| … | … | model: HRP+CVaR · cov: Ledoit-Wolf |

### Forward risk
| Metric | Value | Gate |
|---|---|---|
| Max DD (hist proxy) | … | vs loss tolerance |
| CVaR | … | |
| MC bust p | … | downgrade if above comfort |

### Stock picks (screener pass)
| Ticker | 52W low | ADR | EMA8/21 | Gate status |
|---|---|---|---|---|
| ABC | +75% | 5.2% | Above both | PASS |
| DEF | +40% | 3.1% | Above EMA8 only | FAIL (low 52W, low ADR) |
```

**Completion criterion:** Every portfolio area from Phase 3 has a corresponding row in the posture table. Weights sum to 100% with model named when 3.5 ran. Forward risk row present or gap noted. Every stock-level example shows which gates it passes or fails.

## Branch: Quick pulse

When only market conditions are requested (no portfolio recommendations), run Phase 2 only (2A–2F; 2G if cheap to run). Output a compact table of axes, modifiers, and overall pulse. Skip Phases 1, 3, 3.5, and 4.
