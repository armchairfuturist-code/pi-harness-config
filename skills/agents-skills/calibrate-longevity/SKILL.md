---
name: calibrate-longevity
description: Turn bloodwork, DNA, and health-tracker data into a ranked longevity optimization plan — supplements, peptides, and research compounds. Use when the user shares lab results, wants a longevity/biohacking protocol, or mentions peptides/NAD+/rapamycin.
---

# calibrate-longevity

Turn bloodwork, DNA, and tracker data into a ranked longevity plan. The entire workflow is **gap**-driven: profile signals to find each gap, calibrate whether it's actionable, rank it, close it.

> **Caveat**: This skill discusses experimental compounds (peptides, research chemicals, off-label cognition drugs) that may not have FDA/EMA approval, lack long-term human safety data, and are often sourced from unregulated markets. The user must do their own due diligence on legality, sourcing, dosing, and medical supervision. This skill is a decision-support tool, not a prescription.

## Input

Accept whatever the user provides — any bloodwork (a single panel or many), DNA / genomics, and/or tracker export. The skill is **panel-agnostic**: it maps and contextualizes every marker present, then reports which high-value longevity markers are *absent* so the user knows what to add next time. You do not require a specific panel to run.

Required to proceed (not bloodwork):
1. **Goals & notes** — what to optimize (longevity, energy, cognition, body composition) and any symptoms.
2. **Risk tolerance** — none / established supplements only / open to peptides / open to research chems. Gates the plan's tier ceiling.

High-value inputs (provide what you have; more signal = sharper calibration):
- **Bloodwork** — any lab panel(s). CBC, CMP, lipids, hormones, inflammation, thyroid, iron studies, vitamin D/B12/folate, HbA1c, fasting insulin, ApoB, and Lp(a) are the most informative for longevity, but a partial panel is still fully contextualized.
- **DNA / genomics** — raw data (23andMe, etc.) or interpreted report.
- **Health tracker export** — HRV, RHR, sleep stages, steps, activity, VO2 max.

The skill reads whatever exists and flags gaps on two axes: **out-of-range values** (visible gaps) and **missing high-value markers** (invisible gaps — you can't calibrate what you can't see).

**Persistent record (load first)**: before any new run, check for an existing `longitudinal-record.md` (see `longitudinal-record.md` reference). If present, read it first — it holds prior gap snapshots, past calibrations, and N-of-1 verdicts (`merge`/`revert`). Calibrate this session's gaps against what was already tried and proven or rejected, so the plan compounds instead of repeating.

## Evidence tiers

| Tier | Label | Examples |
|---|---|---|
| T1 | Established | Magnesium, creatine, zone 2, TRE |
| T2 | Emerging | NAD+ precursors, low-dose rapamycin, apigenin, glycine |
| T3 | Experimental | BPC-157, TB-500, semax, dihexa, noopept, SS-31 |

T3 compounds: require consent (risk tolerance ≥ "open to peptides"). Full spec — warning, dose escalation, stop signals, sourcing — lives in the [experimental compounds register](#6-present-the-calibration-report).

## Steps

### 1. Profile the signal set

Extract relevant metrics from each source provided. The skill is **panel-agnostic** — work with whatever was supplied, from a single CBC to a full longevity workup. Bloodwork gets priority weight; DNA provides predisposition context; tracker validates real-world.

**Parse first** (reference: `lab-parsing.md`): turn each lab file into the signal-card format. Every marker in the panel is mapped to a canonical name and contextualized, even if it isn't in the longevity priority set — a normal result is still evidence.

**Coverage gap scan**: after parsing, compare the supplied markers against the high-value longevity panel in `biomarkers.md` §Coverage targets. For each *absent* high-value marker, note it as an **invisible gap** — a blind spot the user should consider testing. This is reported in Step 6 ("Markers to re-draw / add").

**Before grading, run the confounder checklist** (full reference: `lab-ground-rules.md`):
- Properly fasted (10+ h) for glucose, insulin, lipids, iron, homocysteine?
- Draw time matching marker diurnal peak (cortisol/T/TSH by 10 AM)?
- Sex hormones at correct cycle phase (follicular vs luteal ranges differ 2–5×)?
- Enough time since last intervention for recheck?
- Tracker-tension: does HRV/sleep contradict the lab picture?

Write each finding as a signal card: `[marker] = [value] | optimal: [range] | trend: [stable/improving/worsening] | confidence: [high/medium/low]`

**Biological age**: compute a compressed-age signal alongside the raw markers. From 9 routine blood markers estimate PhenoAge and GrimAge (full method: `biomarkers.md` §Biological Age), then write: `[biological_age] = [PhenoAge: X yr | GrimAge: Y yr | chronological: Z yr | delta: X−Z yr]`. The delta is a high-signal gap indicator — a positive delta means the user is biologically older than their years and the systems driving it are the highest-ROI targets.

**Completion**: every data source processed, every relevant marker written as a signal card, and a biological age estimate produced from any available routine blood markers.

### 2. Map signals to systems

Group signal cards by biological system. DNA SNPs that directly modulate a system live inline with that system's card.

| System | Key markers |
|---|---|
| **Metabolic** | glucose, HbA1c, fasting insulin, HOMA-IR, lipids |
| **Inflammatory / immune** | hs-CRP, homocysteine, ferritin, WBC diff |
| **Hormonal** | free T, SHBG, cortisol, DHEA-S, TSH, fT4, fT3 |
| **Cardiovascular** | BP, HRV, RHR, apoB, Lp(a), TG |
| **Mitochondrial / oxidative** | CoQ10, oxidative markers, VO2 max |
| **Nutritional** | vitamin D, B12, iron/ferritin, Mg, Zn, Se |
| **Sleep / recovery** | sleep stages, latency, HRV trend, RHR during sleep |
| **Cognitive / neurological** | BDNF, cortisol awakening response, subjective cognition, EEG |

**Completion**: every signal card assigned to at least one system.

**Cross-system connections**: a gap in one system is rarely isolated. Before scoring, check the known inter-system axes (full reference: `cross-system-connections.md`):

- **Gut–immune–thyroid axis** — low ferritin + high WBC + borderline TSH → consider malabsorption driving both.
- **Metabolic–inflammatory axis** — high TG + high hs-CRP + high fasting insulin → insulin resistance is the root; treat the axis, not the markers.
- **HPA–gonadal axis** — high PM cortisol + low free T → chronic stress suppressing androgen production.
- **Mitochondrial–nutritional axis** — low CoQ10 + low Mg + low selenium → endogenous antioxidant capacity is underbuilt.
- **Sleep–metabolic axis** — poor deep sleep + high glucose variability → glymphatic and glucose disposal share the night.

When two or more systems share an axis and all show gaps, treat the axis as a single higher-order gap (one root cause, multiple downstream markers). This raises the priority of the shared root over any single out-of-range marker.

**Completion**: every signal card assigned to a system AND evaluated against the relevant cross-system axis.

### 3. Calibrate — rank intervention opportunities

For each system, decide: is there a calibratable **gap**? A gap is calibratable when:
- The marker is actionable (not fixed genetic expression)
- Outside optimal range
- The user has data to track effect

Score each gap as **P0 / P1 / P2**:
- **P0** — clearly outside optimal range and actionable now
- **P1** — borderline/trending wrong, or actionable but needs a P0 fixed first
- **P2** — within range but improvable; nice-to-have

For each gap, propose interventions tagged by evidence tier.

**Completion**: every system assessed, all gaps scored P0–P2, each with at least one proposed intervention.

### 4. Build the optimization plan

Three mandatory sections, in order. Every section includes the system/gap table. **For every intervention you propose, across all sections:**
- Cross-reference with DNA: SNP affecting metabolism → flag it (e.g. "MTHFR C677T — methylfolate > folic acid")
- Cross-reference with tracker: if HRV or sleep contradicts bloodwork, note the tension pattern from `lab-ground-rules.md` and lower confidence on the lab-only interpretation

---

#### Section A: Drains & Removals (do FIRST)

List what the user should stop or reduce before adding anything. For each drain: what to stop, why it matters (mechanism), and what observable feedback signs it's working (HRV/sleep/tracker).

- **Sleep hygiene**: late eating (stop 3 h before bed), alcohol, inconsistent schedule
- **Circadian disruptors**: blue light after 10 PM, screen before sunlight, eating outside daylight window
- **Chronic stress**: overtraining, insufficient rest days, cognitive load without decompression
- **Dietary drains**: excess alcohol, late-night eating, refined seed oils, excessive PUFA oxidation
- **Supplement timing errors**: Ca with Fe, Zn without Cu, fat-solubles on empty stomach

> Drains first: removing correctly is higher ROI than adding any single supplement, and makes subsequent additions more effective.

**Completion**: every relevant drain identified with mechanism and feedback signal.

---

#### Section B: Foundational supports (T1)

T1 interventions addressing calibratable gaps. Table per gap:

| System | Gap | Mechanism | Intervention | Tier | Dosage / Protocol | Timing | Re-check | Interaction notes |

Timing guidance per `interactions.md`:
- Food vs empty stomach
- Pairs to separate (Ca ↔ Fe: 4 h; Zn ↔ Cu: always pair; Mg ↔ Ca: different meals)
- Morning vs evening circadian guidance
- Fat-required absorption (A, D, E, K, CoQ10, curcumin)

Assess existing stack for conflicts:
- Zn:Cu ratio (flag if Zn >30 mg/day without Cu)
- Ca + Fe taken together (separate 4+ h)
- Multiple GABAergics → sedation risk (Mg, glycine, theanine, melatonin, ashwagandha, GABA)
- D + K2 + Mg triad completeness
- NAC + glycine taken together (necessary for GSH)

**Completion**: every P0–P1 gap has at least one T1 intervention proposed with timing guidance and interaction check.

---

#### Section C: Enhancement & experimental (T2–T3)

Only when risk tolerance permits. Covers:
- **Emerging supplements** (T2): NAD+ precursors, low-dose rapamycin, glycine, apigenin
- **Peptides** (T3): protocol from `peptides.md` with cycle, dose, route, sourcing
- **Cognition compounds** (T3): protocol from `cognition-compounds.md`

**Completion**: every P0–P1 gap at the permitted tier has an intervention; T3 entries reference the experimental register below.

### 5. Design validation experiments (N-of-1)

A proposed intervention is a hypothesis, not a result. Before the user commits to a stack, design formal self-experiments for the top-3 highest-ROI interventions so they can *prove* the effect on their own body. Use the adversarial-review pattern: one pass designs the protocol, a second pass tries to break it.

**For each top-3 intervention, write an experiment protocol:**

```
HYPOTHESIS: [intervention] improves [outcome marker] by ≥[MDE] over [baseline window].
EVIDENCE FROM YOUR DATA: correlation/deficit that justifies it (r, p, n, or delta vs optimal).
LITERATURE SUPPORT: 1–3 PMIDs for mechanism + human relevance.
PROTOCOL:
  Design: ABA (baseline → intervention → washout) or AB (baseline → intervention).
  Phase duration: ≥14 days per phase (enough for slow markers; HbA1c needs 12-wk windows).
  One variable: change exactly one thing. List covariates to hold constant (calories, sleep, training).
  Primary outcome: the marker you expect to move (e.g. fasting insulin, HRV, sleep score).
  Secondary outcomes: confirmatory readouts.
  Criterion: pre-register the success threshold BEFORE starting (e.g. "fasting insulin ↓ ≥2 µIU/mL AND HRV ↑ ≥10%").
```

**Adversarial review pass** — critique each protocol for:
- Confounders (did you control calories? sleep? training load?)
- Order effects (ABA washout long enough? carryover from peptides?)
- Regression to the mean (is the baseline an outlier draw?)
- Measurement noise (tracker HRV vs lab — which is the endpoint?)

**Verdict rule**: after the trial completes, the user records `merge` (effect confirmed, keep it as standing protocol) or `revert` (no effect / adverse, drop it and log why). Write the experiment + verdict into `longitudinal-record.md` (see Step 1 input #5 / new reference file) so future calibrations build on proven results, not repeated guesses.

**Completion**: every top-3 intervention has a pre-registered N-of-1 protocol with one variable, a pre-written success criterion, and an adversarial-review note on its weakest assumption.

### 6. Present the calibration report

- **Top 3 calibrations to start this month** — highest-ROI gaps regardless of tier
- **Full plan by system** — intervention tables from step 4
- **Markers to re-draw** — which labs to repeat and when
- **Tracker watchpoints** — which metrics to monitor as feedback
- **Experimental compounds register** — all T3 suggestions, each with:
  - Rationale & mechanism
  - Full protocol (dose, cycle, route from `peptides.md` or `cognition-compounds.md`)
  - Sourcing checklist: third-party CoA verified, purity ≥98%, endotoxin-tested
  - Dose-escalation plan: start at 25–50% of target dose for 3–5 days
  - Stop signals: adverse effects warranting discontinuation
  - Interaction flags with other plan interventions
  - **Warning**: "Limited human data. Unknown long-term profile. Source from tested batches only."

**Completion**: the plan covers all calibratable gaps at the user's risk tolerance, with specific dosages, protocols, evidence tiers, and re-check cadences. T3 suggestions are isolated in the experimental register with the full warning.

**Longitudinal handoff**: after presenting the report, append a dated entry to the user's `longitudinal-record.md` (see `longitudinal-record.md` reference): the date, the gap snapshot, the top-3 calibrations chosen, and the N-of-1 protocols designed this session. This file is the persistent memory the skill reads at the start of every future run — without it, each session restarts from zero. If the file does not yet exist, create it from the template in that reference.

## Reference pointers

- [`peptides.md`](peptides.md) — peptide protocols: dosing, cycle, administration route, interaction risks.
- [`cognition-compounds.md`](cognition-compounds.md) — nootropics and research chems: mechanisms, half-lives, side effects, tolerance management.
- [`biomarkers.md`](biomarkers.md) — optimal ranges, SNP interactions, recheck intervals for each marker.
- [`interactions.md`](interactions.md) — supplement synergy, antagonism, absorption conflicts, circadian timing.
- [`lab-ground-rules.md`](lab-ground-rules.md) — pre-analytical confounders, diurnal variation, cycle-phase dependencies, recheck intervals, tracker-lab tension.
- [`longitudinal-record.md`](longitudinal-record.md) — persistent knowledge-base structure: how to store and reload each session's gaps, calibrations, and N-of-1 verdicts.
- [`lab-parsing.md`](lab-parsing.md) — extraction prompt to turn any lab PDF/report into the signal-card format Step 1 expects.
- [`cross-system-connections.md`](cross-system-connections.md) — inter-system axes and the downstream markers that share a root cause.
