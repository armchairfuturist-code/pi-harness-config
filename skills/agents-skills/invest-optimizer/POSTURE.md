# Posture Calibration Matrix

How market pulse maps to portfolio posture through the lens of personal goals. Same pulse × different goals → different postures; the matrix makes the mapping explicit.

## The matrix

Cells marked **(default)** are the allocation the goal profile would produce on its own — they exist for completeness. Focus calibration effort on the non-obvious intersections where the pulse materially changes the default behavior.

| Market pulse | Growth / Aggressive | Balanced / Moderate | Income / Conservative | Preservation |
|---|---|---|---|---|
| **EXPANSION** — cheap valuations, bull market, low fear | Maximum equities. Small/value tilt. Emerging markets. Full risk budget. | **(default)** Neutral weight, drift to equity. Maintain targets. | Income tilt. High quality, preferreds, dividend growers. | **(default)** Standard allocation. Quality bias. |
| **LATE CYCLE** — rich valuations, complacency, macro warnings | Reduce to neutral. Trim winners, raise cash 15–20%. Quality rotation. | Shift defensive. +5–10% bonds. Quality, low vol equities. | Short duration, high credit quality. Trim HY exposure. | Reduce equity to minimum target. Short Treasuries core. |
| **CONTRACTION** — fear, recession, crash | Average down systematically. Extend duration. Scale into weakness. | Rebalance. Sell bonds into equity strength at targets. | **(default)** Hold income. Dividends safe; yield quality only. | **(default)** Maintain. Equity at floor. Duration extended. |
| **CRISIS** — panic, credit freeze, policy emergency | Aggressive buy. Full deployment into panic. Go barbell. | Systematic rebalance only. | Hold course. Income from best credits. | **(default)** Hold. This is what the allocation is for. |

## Allocation templates by posture

### Aggressive
Equities 80–100% · Fixed income 0–10% · Cash 0–10%<br>
Tilt: small cap, value, emerging markets, thematic

### Growth
Equities 65–80% · Fixed income 10–25% · Cash 5–15%<br>
Tilt: quality growth, broad market, sector rotation

### Balanced
Equities 50–65% · Fixed income 25–40% · Cash 5–10%<br>
Tilt: total market, core bonds, low correlation

### Conservative
Equities 30–50% · Fixed income 40–60% · Cash 5–10%<br>
Tilt: large cap, dividend, investment grade bonds

### Income
Equities 20–40% · Fixed income 50–70% · Cash 5–10%<br>
Tilt: dividend aristocrats, preferreds, REITs, high quality corporates

### Preservation
Equities 10–30% · Fixed income 60–80% · Cash 5–10%<br>
Tilt: short duration Treasuries, TIPS, money market

## Agent-Market Microstructure Addendum

When AI trading agents compose >30% of daily volume (current: 60–70%+), traditional "set-and-forget" income strategies face structural headwinds from the **parabolic-and-drop** regime.

### How agent-market changes instrument selection

Standard monthly ATM covered calls **underperform structurally** — an intraday agent-driven spike can breach a strike written 25 days ago in minutes. The premium does not compensate for the capped upside + asymmetric crash exposure.

**Preference hierarchy for income instruments in agent-dominated markets:**

| Rank | Instrument | Why | Example |
|------|-----------|-----|---------|
| 1 | **Short-duration options** (daily/weekly) | Gamma-safe — strike resets match agent time horizon. OTM during high-momentum phases captures massive IV premiums. | GIAX (daily index call spreads), CHPY (weekly semi covered calls) |
| 2 | **Call spreads** (sell near OTM, buy further OTM) | Purchased OTM leg participates in parabolic rallies — upside not fully capped. Section 1256 contracts provide tax advantage. | QQQI, SPYI (call spread on Nasdaq-100 / S&P 500) |
| 3 | **Collars** (buy-write-plus-put) | Premium from sold call funds a protective put. Hard floor against flash crashes. Lower net yield but survivable. | DIY or structured products |
| 4 | **Monthly ATM covered calls** | Structurally last — only acceptable when 2D verdict is HUMAN-DOMINATED or as a tactical fill when volatility is flat. | GPIQ, OVL, JEPQ |
| 5 | **Pure equity growth** (no options) | Captures full parabolic move. No income but necessary for "uncapped" leg. | AOTG, SPMO |

### Portfolio construction implications

- **Duration matters more than strike**: Daily OTM options > weekly OTM > monthly OTM > monthly ATM in agent markets. Each step in duration adds gamma exposure to agent-driven micro-moves.
- **Blend short-duration income + pure equity**: Let the short-duration income layer (daily/weekly) provide cash flow while pure equity holds the parabolic capture. Avoid full allocation to any single expiration schedule.
- **Watch for intraday skew**: When agents trigger a >5% single-stock move within 30 minutes, option IV reprices instantly. Short-duration writers benefit (premium reprices up), monthly writers lose (strike gets gapped through).
- **Tax efficiency**: Section 1256 contracts (index options — NDX, SPX) get 60/40 LTCG/STCG treatment. Prefer index-based options (GIAX, QQQI, SPYI) over single-stock in taxable accounts.

## Thematic Tilt Overlay

A **secular/sector supercycle** (e.g. an "AI macro nexus" — token demand, compute, power/energy, digital assets) can run *inside* a broad-market Late Cycle or Contraction. The 1999 precedent applies: broad valuations were late-cycle even as networking/semis compounded. The overlay lets a thesis tilt the **offense sleeve only**, without touching regime-level hedges.

**Rules:**
- A thematic tilt is a *modifier on the offense band*, never a substitute for the regime read. The market pulse (Phase 2) always wins on defense.
- The tilt may overweight specific sectors/themes *within* the equities allocation already permitted by the pulse — it does **not** grant extra equity weight beyond the matrix bands.
- It **cannot** override the Phase 4 risk gate. If the pulse is LATE CYCLE / CONTRACTION, the hedge layers (duration, non-correlated, cash) stay at their minimum regardless of conviction.
- Treat any secular narrative as *one strategist's thesis to weight*, not doctrine. State the source and the condition that would falsify it (e.g. "token demand growth decelerates below compute supply growth").
- Common overlay candidates: AI/semiconductor infrastructure, energy/power (grid, nuclear/SMR, utilities feeding load growth), digital assets / crypto-forward (BTC, stablecoin legislation, Treasury digital-asset posture). Source candidates per SCREENING.md's thematic buckets.

## Return-of-Capital & Margin-Income Note

Option-income ETFs (CHPY, AMDY, NVDY, QQQI, SPYI, Roundhill 0DTE, etc.) distribute heavily from **return of capital (ROC)** and option premium. High "distribution yield" is **not** income you keep — it is partly your own NAV handed back, and NAV can erode.

**Rules for income / margin-account goals:**
- Report **distribution yield** and **total-return yield** separately. A 28% distribution yield on an ETF losing 10% NAV is a *negative* real yield.
- **Margin survival check:** total-return yield must exceed the account margin rate (e.g. ~7%) *sustained*, or the income compounds debt. Confirm before funding.
- **ROC-erosion hedge:** pair high-ROC income sleeves with an *uncapped pure-equity growth leg* (e.g. SMH, sector index). The growth leg offsets NAV decay — it is ballast for the income sleeve, not optional upside.
- **Drawdown defense is not optional in margin accounts.** Stripping hedges to hit a distribution-yield target removes the buffer that prevents a margin call during the very drawdown the regime read warned about. State this tension explicitly when a yield target conflicts with the risk gate.
