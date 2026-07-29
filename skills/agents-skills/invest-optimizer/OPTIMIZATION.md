# Optimization Reference

Model selection, covariance defaults, and view encoding for Phase 3.5. Heuristic templates in [`POSTURE.md`](POSTURE.md) set the bands; this file picks the math inside those bands.

## Tool preference

| Priority | Library | Use when |
|---|---|---|
| 1 | **skfolio** | Available — sklearn API, cross-validation, Nested Clusters, DR-CVaR, Entropy Pooling, HRP/HERC |
| 2 | **Riskfolio-Lib** | skfolio missing — 26+ risk measures, risk parity, hierarchical clustering |
| 3 | **PyPortfolioOpt** | Either above missing, or need **discrete allocation** (share counts from continuous weights) / Ledoit-Wolf + BL quick path |
| 4 | Heuristic fallback | No optimizer — equal-weight or inverse-volatility within posture bands; state the gap |

`cvxportfolio` is optional for multi-period rebalance paths that price turnover and transaction costs when the gap from current → target is large (>15% equity shift). Do not block the brief on it.

## Model × goal map

Pick one primary optimizer from the goal profile. Pulse modifies risk measure and views, not the goal's structural model.

| Goal profile | Primary model | Risk measure default | Pulse modifiers |
|---|---|---|---|
| Growth / Aggressive | Mean-risk max Sharpe, or Nested Clusters (inner mean-CVaR) | Variance (EXPANSION); **CVaR** (LATE CYCLE / CONTRACTION) | LATE CYCLE → cut equity band ceiling 5–10 pts before optimize |
| Balanced / Moderate | Risk budgeting (risk parity) or HRP | CVaR or semi-variance | CONTRACTION → HERC over HRP (more defensive cluster weights) |
| Income / Conservative | Risk parity or min-risk | CVaR or CDaR (drawdown-aware) | AGENT-DOMINATED → prefer CDaR; shorten options sleeve outside optimizer |
| Preservation | Min-risk or Black-Litterman with conservative views | Variance or CDaR | Always BL-shrink expected returns toward T-bill; never max-Sharpe |

### Advanced models (use when data quality supports them)

- **Nested Clusters Optimization (NCO)** — inner estimator per cluster, outer risk-budget across clusters. Default upgrade when universe >12 names and correlations are unstable.
- **Hierarchical Risk Parity (HRP) / HERC** — no expected-return estimates; robust when Phase 2 valuation is EXTREME/BUBBLE (return forecasts are least trustworthy).
- **Distributionally robust CVaR** — when microstructure is AGENT-DOMINATED or flash-crash count is HIGH/CRITICAL; hedges ambiguity in the return distribution.
- **Schur complementary allocation** — alternative to HRP when cluster structure is clear but risk budgets must stay coherent with a factor model.
- **Entropy Pooling** — encode Phase 2 regime as views on the prior return distribution, then optimize CVaR on the posterior. Preferred bridge from pulse → weights when conviction is high.

## Covariance and return priors

Defaults beat sample estimates. Apply unless the user supplies a researched factor model.

| Input | Default | Notes |
|---|---|---|
| Covariance | Ledoit-Wolf shrinkage (or skfolio/Riskfolio equivalent) | Sample cov is noisy under 3y daily history |
| Covariance (alt) | Gerber statistic | When returns have many near-zero days or crypto-like noise |
| Expected returns | James-Stein / exponential mean, or BL equilibrium | Raw historical mean overfits; never use <1y arithmetic mean alone |
| Factor prior | Time-series factor model when betas available | OpenBB / Qlib factor feeds if present |
| Black-Litterman views | From Phase 2 pulse (see below) | Views are *tilts*, not certainty |

## Entropy Pooling / BL view encoding from pulse

Translate the synthesized pulse into a small view set. Over-specifying views defeats robustness.

| Pulse | View type | Example encoding |
|---|---|---|
| EXPANSION | Mild equity risk-on | Equilibrium + small positive excess return on equity beta; HY spread stays tight |
| LATE CYCLE | Defensive relative views | Equity expected excess ≤ 0 vs bonds; quality/low-vol outperform broad equity; duration shorten |
| CONTRACTION | Risk-off absolute | Raise equity CVaR view; widen credit-spread stress; extend quality duration |
| CRISIS | Stress posterior | Entropy Pool / scenario: equity −2σ month, credit +300 bps; optimize min CVaR on stressed posterior |
| AGENT-DOMINATED (any pulse) | Tail ambiguity | Prefer DR-CVaR or add left-tail view; do not raise return forecasts |

Confidence: scale view uncertainty inversely with Phase 2 axis agreement. Five axes aligned → tighter views; mixed axes → near-equilibrium (weak views).

## Constraints checklist

Always apply before solve:

1. **Asset-class bands** from the posture template (hard)
2. **Sector ceiling** ≤30% default (or goal profile)
3. **Single-name ceiling** — concentrated goals ≤15–25%; broad ≤5–8%
4. **Turnover budget** — if prior weights exist, cap one-way turnover (default 20–40% of portfolio) unless CRISIS / user override
5. **Long-only** unless the goal profile explicitly allows shorts/leverage
6. **Income sleeve** — option-income ETFs capped so ROC-heavy names cannot dominate (see POSTURE ROC note); pair with uncapped equity ballast outside the income share

## Discrete allocation

After continuous weights sum to 100% inside bands:

- If `PyPortfolioOpt.DiscreteAllocation` (or equivalent) is available and the user has a deployable cash amount, convert to share counts and residual cash.
- Otherwise report percentage weights only.
- Never invent share prices — pull latest or skip discrete step.

## Stress and validation (optimizer-level)

Before accepting weights into the brief:

| Check | Pass criterion |
|---|---|
| In-band | Every asset-class aggregate inside posture bands |
| Concentration | No sector/name breach of ceilings |
| CVaR sanity | Portfolio historical or synthetic CVaR ≤ goal loss tolerance (annualized framing stated) |
| Diversification | Effective N (1/Σw²) ≥ floor for broad goals (default ≥ 8); concentrated goals exempt |
| Correlation break | Under +0.3 uniform correlation shock to equities, band constraints still hold after one re-solve or manual clip |
| Cross-fit (skfolio) | If CV available, out-of-sample Sharpe or CVaR not catastrophic vs in-sample (flag if OOS collapses >50%) |

Failure → loosen return views, switch to HRP/min-risk, or drop to heuristic inverse-vol; state which fallback fired.

## Monte Carlo survival (quantstats-class)

When return history for the recommended mix (or proxy ETFs) is available:

- Run bootstrap/Monte Carlo (default 1000 paths)
- **Bust probability** = P(drawdown ≤ −loss_tolerance from goal profile)
- **Goal probability** = P(reaching stated return target within horizon) when the profile has one
- Gate: bust probability above the profile's comfort (default >25% for moderate, >10% for conservative/preservation) → downgrade posture one rung or cut equity band and re-optimize

If quantstats (or equivalent) is unavailable, approximate with historical max drawdown and CVaR of the proxy mix and state the gap.
