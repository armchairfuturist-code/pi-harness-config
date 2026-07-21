---
name: invest-optimizer
description: "Recalibrate portfolio posture to market regime and goals. Triggers: portfolio review, market timing, goal alignment, posture shift."
---

# Invest Optimizer

Recalibrate portfolio **posture** — the portfolio's overall stance expressed as concrete allocation shifts — to the current market **regime** through the lens of personal investment goals.

Reference files:
- [`METRICS.md`](METRICS.md) — market metric thresholds and synthesis rules
- [`POSTURE.md`](POSTURE.md) — posture × goals calibration matrix
- [`SCREENING.md`](SCREENING.md) — individual stock technical gates

## Phase 1 — Anchor to goals

Load a **goal profile**: a structured record of the user's investment objectives. If the system has a goal intake (e.g. Quinn's `/goal-intake`), load the latest confirmed profile. Otherwise infer from context or ask the user.

The goal anchor is the fixed reference every downstream assessment recalibrates against — it determines which posture fits.

| Axis | Values | Why it matters |
|---|---|---|
| Primary objective | income / growth / balanced / preservation | Sets the top-line compass — every downstream posture decision recalibrates against this axis |
| Risk tolerance | conservative / moderate / aggressive | How far from neutral the posture can deviate |
| Investor type | day trader / swing trader / income investor / growth holder | Determines recommendation granularity — traders need entry/exit levels and stops; income investors need yield safety checks; growth holders need macro-driven allocation shifts |
| Time horizon | <1 / 1-5 / 5-15 / 15+ years | Short horizons can't wait out recession; long ones average through |
| Income cadence | weekly / monthly / quarterly / annual / none | Determines whether recommendations prioritize dividend safety and yield vs total-return reinvestment |
| Concentration | concentrated / balanced / broad | Concentrated tolerates sector risk; broad needs diversification |

**Completion criterion:** All critical axes loaded and noted.

## Phase 2 — Read the regime

Recalibrate current market conditions across five axes using the thresholds in [`METRICS.md`](METRICS.md). For each axis produce a verdict, then synthesize a single **market pulse**.

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

AI trading agents now compose >60% of daily equity volume. Their herding creates the **parabolic-and-drop** regime — vertical parabolic surges followed by random liquidity vacuums and flash crashes — that breaks traditional option strategies.

Check: **AI trading volume share**, **intraday tail frequency** (days with >3% single-stock intraday reversals), **flash crash count** (rolling 30-day).

| Metric | Estimate (mid-2026) | Signal |
|--------|--------------------|--------|
| AI trading agent volume share | 60–70%+ | AGENT-DOMINATED |
| Intraday >3% V-reversals per week | 3–8 | HIGH REGIME NOISE |
| Flash crash events (30d) | 1–4 | STRUCTURAL FRAGILITY |

Verdict: AGENT-DOMINATED / HUMAN-MIXED / HUMAN-DOMINATED

### 2E — Event/prediction: what are live probability markets pricing?

Use `polymarket-cli` to anchor probability-driven verdicts that complement the four structural axes. Live prediction-market prices on recessions, rate moves, and sector outcomes are a harder signal than any VIX read.

Measures: Polymarket-implied probability of recession within 12m, rate-hike probability, sector-outcome markets.

Verdict: [RECESSION p≥0.30 / NEUTRAL p0.10–0.29 / BULLISH p<0.10]

Fold this into the synthesis as a fifth column. A RICH + COMPLACENT + RECESSION p≥0.30 is LATE CYCLE with extra conviction; a FAIR + ANXIOUS + BULLISH p<0.10 warns the market is pricing tail risk lower than your structural read — flag the tension.

### Synthesis

Weight all five axes. Add microstructure as a **modifier** — it amplifies or mutes the standard pulse based on who is trading:

- AGENT-DOMINATED + high valuation → crash severity elevated (parabolic-and-drop becomes structural, not one-off)
- AGENT-DOMINATED + LATE CYCLE → rotation severity elevated (agents herd exits faster than humans)
- AGENT-DOMINATED × any pulse → **monthly ATM covered calls structurally underperform** (strikes get run over by intraday agent-driven spikes)

**Completion criterion:** Five axis verdicts (valuation, complacency, macro, microstructure, prediction markets), each supported by at least one metric reading, plus a synthesized pulse with explicit weighting rationale.

### Tool fallback

If a quantitative tool (`polymarket-cli`, `Riskfolio-Lib`, `qlib`) is unavailable, fall back to the manual metric checks in METRICS.md and state the gap. Never block a posture brief on a missing data source.

## Phase 3 — Calibrate posture

Map the market pulse against the goal anchor using **[the posture matrix](POSTURE.md)**. The matrix is the cross-product: same pulse × different goals → different postures.

When 2D verdict is AGENT-DOMINATED or AGENT-SATURATED, apply the **[Agent-Market Microstructure Addendum](POSTURE.md#agent-market-microstructure-addendum)** as a modifier on all income instrument recommendations. Standard allocation templates remain valid for broad asset-class posture but individual income vehicles must be filtered through the addendum's preference hierarchy — use the **parabolic-and-drop** framing to explain why short-duration options outperform monthly in agent-dominated regimes.

For each area the portfolio touches, produce:

1. **Current posture** — what the portfolio looks like now
2. **Target posture** — per the matrix, given the pulse and goals
3. **Actions** — specific trades or shifts to close the gap
4. **Risk gate** — the observable condition that, if met, breaks the thesis and triggers a posture revert

When the posture implies individual stock picks, apply the technical gates in [`SCREENING.md`](SCREENING.md).

**Completion criterion:** At least one concrete recommendation per portfolio area (equities, fixed income, alternatives, cash, sector tilts, income instruments as applicable), each with target posture, specific actions, and a risk gate.

## Phase 3.5 — Optimize weights

Translate the target posture from Phase 3 into mathematically grounded allocation weights. Heuristic templates give ranges; optimization gives exact weights within those ranges.

If `Riskfolio-Lib` is available, run portfolio optimization on the candidate universe constrained to the target posture's allocation bands from [`POSTURE.md`](POSTURE.md):

1. Build the candidate universe (equities, ETFs, bonds per the target posture tilt)
2. Select an optimization model matched to the goal profile:
   - **Growth/Aggressive** → mean-variance (maximize Sharpe) or mean-CVaR for fat tails
   - **Balanced** → risk parity or mean-variance with turnover constraint
   - **Income/Conservative** → risk parity or minimum-variance
   - **Preservation** → minimum-variance or Black-Litterman with conservative views
3. Constrain to the posture's asset-class bands (e.g. Balanced: equities 50–65%, fixed income 25–40%, cash 5–10%)
4. Output optimal weights per asset

If `Riskfolio-Lib` is unavailable, fall back to equal-weight or inverse-volatility weighting within the target bands and state the gap. Never block a posture brief on a missing tool.

**Completion criterion:** Every asset in the recommended portfolio has an explicit weight assignment, either optimized or fallback-weighted, summing to 100% within the target posture's allocation bands.

## Phase 4 — Risk check

Before outputting, validate recommendations against system risk constraints. If system values aren't available, use defaults:

- [ ] Position size within goal-appropriate limits
- [ ] Sector concentration under ceiling (≤30% per sector default)
- [ ] Leverage under cap (≤1.25× default)
- [ ] Polymarket-implied recession probability matches posture level (LATE CYCLE → ≥0.30; HEDGE → ≥0.15; BULLISH → <0.10)
- [ ] Drawdown within loss tolerance from goal profile

If any recommendation violates a limit, downgrade the posture to the next safe rung. State the violation and the downgrade explicitly.

### Regime validation

If a prior posture brief exists, check whether the previous regime read was confirmed or contradicted by subsequent market action:

- **Confirmed** — metrics moved in the predicted direction (e.g. prior LATE CYCLE → yield curve un-inverted or spreads widened)
- **Contradicted** — metrics moved against (e.g. prior LATE CYCLE → VIX dropped and spreads tightened)
- **Mixed** — some axes confirmed, others didn't → note which and adjust confidence in the current read

A contradicted prior read lowers confidence in regime calls depending on the same axes. State the adjustment explicitly.

**Completion criterion:** Every recommendation checked against risk limits. Violations blocked or downgraded with reason. Prior regime read validated as confirmed, contradicted, or mixed with confidence adjustment stated.

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
| **Overall** | **LATE CYCLE** |

### Posture
| Area | Current | Target | Action | Risk gate |
|---|---|---|---|---|
| Equity allocation | 80% | 65% | Trim 15% → cash/short bonds | Redeploy if CAPE < 25 |
| Sector tilt | Tech-heavy | Add defensive | Buy XLP, XLU | Exit if VIX > 30 |
| Duration | 5yr | 2yr | Shorten bond portfolio | — |

### Stock picks (screener pass)
| Ticker | 52W low | ADR | EMA8/21 | Gate status |
|---|---|---|---|---|
| ABC | +75% | 5.2% | Above both | PASS |
| DEF | +40% | 3.1% | Above EMA8 only | FAIL (low 52W, low ADR) |
```

**Completion criterion:** Every portfolio area from Phase 3 has a corresponding row in the posture table. Every stock-level example shows which gates it passes or fails.

## Branch: Quick pulse

When only market conditions are requested (no portfolio recommendations), run Phase 2 only. Output a compact table of five axes and overall pulse. Skip Phases 1, 3, 3.5, and 4.
