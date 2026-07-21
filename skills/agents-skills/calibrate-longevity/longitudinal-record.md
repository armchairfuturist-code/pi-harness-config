# Longitudinal record

A persistent knowledge base the skill reads at the start of every run and writes to at the end. Without it, each session restarts from zero — the same gaps get re-found, the same interventions re-proposed, and proven results are lost. With it, the plan compounds: each calibration builds on what was already tried, confirmed, or rejected.

Store this file next to the user's health data (a private repo, encrypted volume, or local folder). The skill creates it on first use from the template below; thereafter it appends one dated entry per session.

---

## Layer structure

The record is a layered pyramid. Each layer only consumes the one below it, so evidence flows upward and nothing is asserted without a trail back to its source.

| Layer | Holds | Example |
|---|---|---|
| `00_context` | Goals, risk tolerance, current protocol, known SNPs | "open to peptides", APOE ε4, Lp(a) 80 mg/dL |
| `01_raw` | Latest labs, tracker data, signal cards | `[ferritin] = 45 ng/mL | optimal: 50–100` |
| `02_sources` | Evidence-labeled notes (FACT / INFERENCE) | "FACT: ferritin 45. INFERENCE: likely low from long-term vegan diet." |
| `03_wiki` | Established baselines, known SNP effects, standing rules | "fasting insulin runs 6–9, responds to carb restriction" |
| `04_synthesis` | Cross-domain patterns, biological age trend | "bio-age delta widening — metabolic axis driving it" |
| `05_decisions` | N-of-1 experiments with merge/revert verdicts | "creatine → HRV +8ms: MERGED" |

---

## Record template

```markdown
# Longitudinal record — [user handle or "owner"]

## 00_context
- Goals: [longevity / energy / cognition / body composition]
- Risk tolerance: [none / established only / open to peptides / open to research chems]
- Standing SNPs: [MTHFR C677T, APOE ε4, LPA kringle, …]
- Current protocol: [what's active this cycle]

## 01_raw — latest signal cards
[ paste the most recent run's signal cards here, or link the source file ]

## 02_sources
- [date] FACT: [observed value]
- [date] INFERENCE: [interpretation, flagged as inference]

## 03_wiki — established baselines
- [personal baseline or known response pattern]

## 04_synthesis — cross-domain patterns
- [biological age trend, axis-level findings]

## 05_decisions — N-of-1 verdicts
| Date | Intervention | Hypothesis | Verdict | Notes |
|---|---|---|---|---|
| [date] | [compound] | [what it should do] | MERGE / REVERT | [why] |

---

## Session log
### [YYYY-MM-DD] — calibration run
- Gap snapshot: [P0/P1/P2 gaps found]
- Top-3 calibrations: [what was chosen]
- N-of-1 protocols designed: [hypothesis + criterion for each]
- Carried forward from prior sessions: [what's still active, what was rejected]
```

---

## Read rules (start of every run)

1. Load `00_context` first — goals and risk tolerance gate the whole plan.
2. Load `05_decisions` before proposing any intervention — never re-suggest a REVERTED compound without new evidence, and promote MERGED protocols to "standing stack."
3. Load `04_synthesis` and `03_wiki` to see established patterns before scoring fresh gaps.
4. Load `01_raw` to compare this session's signal cards against the last known state — is the gap closing, stable, or worsening?

## Write rules (end of every run)

1. Append a dated entry under `## Session log`.
2. Update `05_decisions` when an N-of-1 trial has a verdict.
3. Update `04_synthesis` / `03_wiki` when a new pattern is established.
4. Update `01_raw` with the latest signal cards.
5. Never delete history — supersede with a newer dated entry. The record is append-only.
