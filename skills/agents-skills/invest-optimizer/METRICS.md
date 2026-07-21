# Market Metrics Reference

Thresholds and interpretation for the five market axes the Invest Optimizer reads. All values are current-snapshot checks; a metric outside the range for its axis contributes to the synthesized **market pulse**.

## Valuation

### Shiller CAPE Ratio
Price ÷ 10-year average inflation-adjusted earnings. Long-run mean ~17.

| Range | Verdict | Forward return implication |
|---|---|---|
| < 10 | CHEAP | Historically strong 10-year returns |
| 10–17 | FAIR | Near long-run mean |
| 17–25 | RICH | Below-average forward returns |
| 25–35 | EXTREME | Historically very weak forward returns |
| > 35 | BUBBLE | Only exceeded pre-1929 and 1999-2000 |

High CAPE is the single best long-run return predictor — it has historically meant weak returns over the following decade, not the next week.

### Buffett Indicator
Total US stock market value ÷ GDP. "Probably the best single measure of where valuations stand" — Warren Buffett.

| Threshold | Verdict |
|---|---|
| < 80% | CHEAP |
| 80–120% | FAIR |
| 120–150% | RICH |
| 150–200% | PLAYING WITH FIRE |
| > 200% | EXTREME |

### Tobin's Q
Market value of companies ÷ replacement cost. Long-run mean ~0.75. Above 1 means the market prices companies above their tangible worth.

| Range | Verdict |
|---|---|
| < 0.5 | VERY CHEAP |
| 0.5–0.75 | CHEAP |
| 0.75–1.0 | FAIR |
| 1.0–1.5 | RICH |
| > 1.5 | VERY RICH |

### S&P 500 ÷ M2
Valuation adjusted for the money supply. Filters out "record highs" that are really just monetary inflation.

No fixed thresholds — compare to the series' own history. A reading in the 90th+ percentile = RICH.

## Complacency

### VIX — CBOE Volatility Index
Implied volatility of S&P 500 options. Sustained low VIX is a more dangerous tell than a spike: low VIX means no one is hedging.

| Range | Verdict | Meaning |
|---|---|---|
| < 12 | COMPLACENT | Investors pricing in no risk — classic late-cycle tell |
| 12–18 | NEUTRAL | Normal range |
| 18–25 | CONCERN | Elevated fear |
| 25–35 | FEAR | High fear, late stages of sell-off |
| > 35 | PANIC | Crisis-level fear, historically a buying signal |

### High-Yield Credit Spread
Junk bond yield over Treasuries.

| Spread | Verdict | Meaning |
|---|---|---|
| < 3% | TIGHT | Froth — lenders pricing in almost no risk |
| 3–5% | NORMAL | Typical range |
| 5–8% | WIDENING | Stress building |
| > 8% | DISTRESS | Crisis — credit markets seizing |

## Macro

### Yield Curve — 10y − 2y

| State | Verdict | Meaning |
|---|---|---|
| > +0.5% | EXPANSION | Normal growth — steep curve |
| 0% to +0.5% | WARNING | Late cycle — flattening, slowing growth |
| < 0% (inverted) | RECESSION | Recession warning — most reliable lead indicator |
| Recently un-inverted | CRISIS | Recession typically hits after un-inversion, not during |

The recession usually arrives 6–18 months after the curve un-inverts.

## Market Microstructure

### AI Trading Agent Volume Share
Estimated share of daily equity volume driven by automated/AI agents (quant funds, ML models, algos).

| Share | Verdict | Meaning |
|-------|---------|---------|
| < 30% | HUMAN-DOMINATED | Traditional set-and-forget strategies work fine |
| 30–50% | HUMAN-MIXED | Monthly options may get intermittent gamma pressure |
| 50–70% | AGENT-DOMINATED | Short-duration options preferred; monthly ATM covered calls structurally underperform |
| > 70% | AGENT-SATURATED | Daily OTM minimum; monthly options are alpha leaks |

### Intraday Tail Frequency
Days per week where a >3% single-stock intraday V-reversal occurs (drop then recover, or surge then crash). Measures the "parabolic-and-drop" signature.

| Frequency | Signal |
|-----------|--------|
| < 1/wk | NORMAL — traditional strategies safe |
| 1–3/wk | ELEVATED — monitor for regime change |
| 3–8/wk | HIGH — agent-driven microstructure dominant |
| > 8/wk | EXTREME — structural fragility, daily options + collars preferred |

### Flash Crash Count
Rolling 30-day count of >5% intraday index drops that recover within the same session.

| Count | Signal |
|-------|--------|
| 0 | NORMAL |
| 1–2 | ELEVATED — consider put protection |
| 3–4 | HIGH — collars or cash buffer recommended |
| > 4 | CRITICAL — minimum position sizing, collars on all positions |
