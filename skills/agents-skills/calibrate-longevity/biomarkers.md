# Biomarker reference

Optimal ranges for longevity. These are stricter than standard lab reference ranges — they target the ideal zone for low all-cause mortality, not the "not sick" cutoff.

---

## Coverage targets

Not every panel measures the same thing. This table lists the high-value longevity markers the skill watches for. It is **not a required input set** — the skill contextualizes whatever markers are present. After parsing a panel, the skill scans this list for *absent* markers and reports them as invisible gaps (blind spots worth testing next time).

| Priority | Marker | System | Why it matters |
|---|---|---|---|
| **Core** | Fasting glucose | Metabolic | Glycemic control; >90 mg/dL correlates with mortality even in range |
| **Core** | Fasting insulin / HOMA-IR | Metabolic | Early insulin resistance; responds before glucose |
| **Core** | HbA1c | Metabolic | 90-day glucose average |
| **Core** | Lipids (TC, LDL, HDL, TG) | Cardiovascular | Standard risk panel |
| **Core** | **ApoB** | Cardiovascular | Better predictor than LDL; particle count |
| **Core** | **Lp(a)** | Cardiovascular | Largely genetic; drives residual risk |
| **Core** | hs-CRP | Inflammatory | Low-grade inflammation |
| **Core** | Homocysteine | Inflammatory / methylation | CVD + cognitive risk; B-vitamin status |
| **Core** | Ferritin + iron studies | Nutritional | Deficiency *and* overload both harmful |
| **Core** | Vitamin D (25-OH) | Nutritional | Broad mortality signal |
| **Core** | TSH, fT4, fT3 | Hormonal | Thyroid function |
| **Core** | Albumin | Liver / nutritional | PhenoAge input; visceral protein status |
| **Core** | Creatinine / eGFR (or Cystatin C) | Renal | Filtration; PhenoAge input |
| **Core** | CBC (WBC, RBC, MCV, RDW, platelets) | Hematologic | Anemia, inflammation, RDW is a PhenoAge input |
| **High** | Free testosterone (men) / estradiol + progesterone (women) | Hormonal | Hypogonadism, cycle-phase issues |
| **High** | Cortisol (AM, ideally 4-point curve) | Hormonal / HPA | Stress axis |
| **High** | DHEA-S | Hormonal | Adrenal; declines with age |
| **High** | B12, RBC folate, methylmalonic acid | Nutritional / methylation | B-status; MMA is functional B12 |
| **High** | Magnesium (RBC), Zinc, Selenium | Nutritional | Cofactors for antioxidant / enzyme function |
| **High** | Uric acid | Metabolic | U-shaped; gout + CVD |
| **High** | GGT, ALT, AST | Liver / oxidative | Fatty liver, oxidative stress |
| **High** | HbA1c + fasting insulin → HOMA-IR | Metabolic | Cheap insulin-resistance proxy |
| **High** | CRP, WBC, neutrophil:lymphocyte ratio | Inflammatory | Immune activation |
| **High** | Vitamin B1, B6 | Nutritional | Often-untested cofactors |
| **Context** | Genetic: APOE, LPA kringle, MTHFR, C677T, F2/F5, CYP21A2 | Genomic | Predisposition context for the above |
| **Context** | Tracker: HRV, RHR, VO2 max, sleep stages | Recovery / fitness | Real-world validation of lab picture |

A panel that contains, say, only a CBC + lipids is fully contextualized for hematology and cardiovascular risk — the coverage scan simply flags that metabolic-insulin (fasting insulin, HOMA-IR), inflammatory (hs-CRP, homocysteine), nutritional (vit D, ferritin), and hormonal (thyroid, testosterone) markers are absent and thus invisible.

---

Not every marker deserves equal attention. Use a tiered structure (adapted from the `years` system) so the plan targets the highest-leverage markers first, not just the ones furthest from lab-normal.

| Tier | Name | What lives here | Recheck |
|---|---|---|---|
| **Primary KPIs** | Active movers | The 3–5 markers you are actively trying to shift this cycle. Pick by phenotype, family history, and what you've already addressed. | Every intervention cycle (2–12 weeks by marker) |
| **Secondary KPIs** | Guardrails + confirmatory | Markers reliably in optimal range that serve as guardrails, plus confirmatory readouts that triangulate a Primary KPI (HbA1c lags fasting insulin by months; hs-CRP catches inflammation fasting insulin misses; UACR confirms BP reaches the kidney). | ~annually |
| **Baseline measurements** | Once-in-life | DEXA (bone density, body comp), CCTA (plaque burden when indicated), APOE and Lp(a) genotyping (neither changes). | Infrequent or one-time |

**Principle**: a 60-year-old with confirmed plaque shouldn't track the same five Primary KPIs as a 30-year-old with a clean scan. Promote markers you need to move; demote stable-in-range markers to Secondary as guardrails. Pick from remaining candidates using expected-value vs cost: how much an intervention shifts long-term risk, your honest probability of sticking with it, and durability (a one-time screen vs something that decays the moment you stop).

### Default Primary KPI set (adults, no special history)

ApoB, fasting insulin / HOMA-IR, home blood pressure, waist-to-height ratio, and VO₂max trend from a smartwatch. Start here if starting from zero. Promote/demote based on phenotype and family history (ferritin + TSAT if hemochromatosis carrier; ApoB if paternal early MI; cystatin-C eGFR if high muscle mass makes creatinine eGFR misleading).

---

## Metabolic

| Marker | Optimal range | Notes | Recheck | Key SNPs |
|---|---|---|---|---|
| Fasting glucose | 72–85 mg/dL | >90 correlates with higher mortality even within "normal" | 2–4 weeks | GCK, TCF7L2, SLC2A2 |
| HbA1c | <5.0% (or <31 mmol/mol) | 4.8–5.0% ideal; each 1% above 5.0 increases CVD risk ~20% | 12 weeks (3 months) | GCK, ADIPOQ |
| Fasting insulin | <8 µIU/mL | <5 ideal; HOMA-IR should be <1.5 | 2–4 weeks | IRS1, PPARG, ENPP1 |
| HOMA-IR | <1.5 | (glucose × insulin) / 405 | 2–4 weeks | TCF7L2, IRS1 |
| Triglycerides | <100 mg/dL | <70 optimal; elevated = excess carbs/ethanol | 6–8 weeks | APOA5, LPL, GCKR |
| HDL | Men: >55 mg/dL, Women: >65 mg/dL | >80 optimal for longevity | 6–8 weeks | CETP, LIPC, LPL |
| LDL | <100 mg/dL | <70 if APOE ε4 or Lp(a) high | 6–8 weeks | APOE, PCSK9, LDLR |
| ApoB | <80 mg/dL | <60 if high risk; better marker than LDL | 8–12 weeks | APOB, PCSK9 |
| Lp(a) | <30 mg/dL | Mostly genetic; if high, aggressive LDL lowering | 12 months (largely stable) | LPA kringle repeats |

## Inflammatory / immune

| Marker | Optimal range | Notes | Recheck | Key SNPs |
|---|---|---|---|---|
| hs-CRP | <0.5 mg/L | <0.2 ideal; >1.0 signals chronic inflammation | 4–6 weeks | CRP, IL6, TNF |
| Homocysteine | <8 µmol/L | <7 ideal; elevated → CVD, cognitive decline risk | 4–6 weeks | MTHFR C677T, MTR, MTRR, CBS |
| Ferritin | 50–100 ng/mL | <30 = deficiency, >200 = iron overload (oxidative stress) | 4–8 weeks (3 months post-IV) | HFE C282Y, H63D, TMPRSS6 |
| WBC | 4.0–6.0 K/µL | Higher end = chronic immune activation | 2–4 weeks | Multiple |
| Neutrophil/lymphocyte ratio | <2.0 | >3.0 correlates with all-cause mortality | 2–4 weeks | — |

## Hormonal

| Marker | Optimal range | Notes | Recheck | Key SNPs |
|---|---|---|---|---|
| Free T (men) | 15–25 ng/dL | >20 ideal; below 12 → evaluate | 4–6 weeks | SHBG, AR CAG repeat |
| Free T (women) | 0.5–2.0 ng/dL | Varies with age, cycle phase | 4–6 weeks | SHBG, AR |
| SHBG | 25–50 nmol/L | High = low free T; low = metabolic syndrome | 6–8 weeks | SHBG, TCF7L2 |
| DHEA-S | 300–500 µg/dL (men <50) | Declines with age; <200 suggests adrenal fatigue | 4–6 weeks | CYP21A2, HSD3B2 |
| Cortisol (AM) | 10–20 µg/dL | >25 → adrenal stress; flat diurnal curve → HPA dysfunction | 2–4 weeks | NR3C1, FKBP5 |
| Cortisol (PM) | <5 µg/dL | Should drop 50%+ from AM | 2–4 weeks | NR3C1, FKBP5 |
| TSH | 0.5–2.5 mIU/L | >2.5 may indicate subclinical hypothyroidism | 6–8 weeks after dose change | TSHR, PDE8B |
| fT4 | 1.0–1.6 ng/dL | Low = slow metabolism, high = tissue hyperthyroidism | 6–8 weeks | DIO1, DIO2 |
| fT3 | 3.0–4.2 pg/mL | Low conversion = reverse T3 dominance | 6–8 weeks | DIO1, DIO2 |

## Cardiovascular

| Marker | Optimal range | Notes | Recheck | Key SNPs |
|---|---|---|---|---|
| HRV (RMSSD) | >50 ms (AM fasted) | <30 = sympathetic dominance, overtraining, or stress | Continuous (tracker) | ADRB1, CHRM2 |
| RHR | 50–65 bpm | <45 (athlete) or >75 → evaluate | Continuous (tracker) | ADRB1, ADRB2, GNB3 |
| BP systolic | <120 mmHg | >130 → arterial stiffness | 2–4 weeks | AGT, ACE, ADD1 |
| BP diastolic | <80 mmHg | >85 → increased CVD risk | 2–4 weeks | AGT, ACE, NOS3 |
| ApoB / ApoA1 ratio | <0.7 | <0.6 ideal | 8–12 weeks | APOB, APOA1, CETP |

## Mitochondrial / oxidative

| Marker | Optimal range | Notes | Recheck | Key SNPs |
|---|---|---|---|---|
| CoQ10 (total) | >1.0 µg/mL | Declines with statins and age | 8–12 weeks | COQ2, NQO1 |
| Uric acid | 4.0–5.5 mg/dL | U-shaped risk curve (too low also bad) | 4–6 weeks | SLC2A9, ABCG2 |
| GGT | <20 U/L | >30 = oxidative stress, liver congestion | 2–4 weeks | GSTM1, GSTT1 |
| VO2 max (relative) | >45 (men), >38 (women) | Single strongest longevity biomarker | 8–12 weeks (re-test protocol) | Multiple mitochondrial |

## Nutritional

| Marker | Optimal range | Notes | Recheck | Key SNPs |
|---|---|---|---|---|
| Vitamin D (25-OH) | 50–80 ng/mL | >30 is "sufficient"; >50 is optimal | 3 months after loading | VDR, GC, CYP2R1 |
| Vitamin B12 | 600–900 pg/mL | >500 is sufficient; neurological benefits >600 | 4–6 weeks | MTR, MTRR, CUBN, GIF |
| Folate (RBC) | >500 ng/mL | MTHFR variants need methylfolate | 4–6 weeks | MTHFR, MTR, SLC19A1 |
| Magnesium (RBC) | 4.5–6.5 mg/dL | Serum Mg is poor proxy; RBC Mg is better | 4–6 weeks | TRPM6, CNNM2 |
| Zinc | 80–120 µg/dL | Low → immune, thyroid, testosterone issues | 4–6 weeks | SLC30A8, SLC39A8 |
| Selenium | 120–150 µg/L | U-shaped; both low and high increase mortality | 4–6 weeks | SEPP1, GPX1, GPX3 |
| Iron saturation | 25–35% | <20 = deficiency; >45 = oxidative stress | 4–8 weeks | HFE, TFR2, TMPRSS6 |

## Sleep / recovery

| Marker | Optimal range | Notes | Recheck | Key SNPs |
|---|---|---|---|---|
| Deep sleep | >20% of night | <15% → impaired glymphatic clearance | Continuous (tracker) | — |
| REM sleep | 20–25% of night | <18% → cognitive recovery impaired | Continuous (tracker) | — |
| Sleep latency | <20 min | >30 min → sleep onset issue | Continuous (tracker) | CLOCK, PER2, PER3 |
| HRV during sleep | >60 ms (RMSSD) | Rising trend across night is good | Continuous (tracker) | ADRB1, CHRM2 |
| RHR during sleep | 5–10 bpm below waking | No drop → poor recovery or overtraining | Continuous (tracker) | ADRB1, NOS3 |

---

## Biological Age

A compressed-age signal computed from routine blood markers. The delta (biological − chronological) is a high-signal gap indicator: a positive delta means the user is biologically older than their years, and the systems driving it are the highest-ROI calibration targets.

### PhenoAge (Levine 2018)

Validated algorithm from Levine et al., *Aging* (2018) — a Gompertz proportional-hazards model on NHANES mortality data. Takes 9 routine clinical markers + chronological age and returns a "phenotypic age" calibrated to population mortality risk. PhenoAge tracks all-cause mortality more tightly than any single marker.

**Required inputs (use these exact units):**

| Marker | Unit | Where it lives in a panel |
|---|---|---|
| Albumin | g/L | Metabolic / liver |
| Creatinine | µmol/L | Renal |
| Glucose (fasting) | mmol/L (mg/dL × 0.0555) | Metabolic |
| C-reactive protein (CRP) | mg/L | Inflammatory |
| Lymphocyte % | % | CBC differential |
| Mean cell volume (MCV) | fL | CBC |
| Red cell distribution width (RDW) | % | CBC |
| Alkaline phosphatase | U/L | Liver/bone |
| White blood cell count | ×10⁹/L (1000 cells/µL) | CBC |
| Chronological age | years | user input |

**Algorithm:**

```
# Step 1 — weighted linear predictor (xb)
xb = -19.9067
     - 0.0336 · albumin_gL
     + 0.0095 · creatinine_umolL
     + 0.1953 · glucose_mmolL
     + 0.0954 · ln(CRP_mgL)
     - 0.0120 · lymphocyte_pct
     + 0.0268 · MCV_fL
     + 0.3306 · RDW_pct
     + 0.00188 · alkaline_phosphatase_UL
     + 0.0554 · WBC_x10e9
     + 0.0804 · chronological_age

# Step 2 — mortality score (Gompertz)
gamma   = -1.51714
lambda  =  0.0076927
M = 1 - exp( (gamma · exp(xb)) / lambda )

# Step 3 — phenotypic (biological) age
PhenoAge = 141.50225 + ln( -0.00553 · ln(1 - M) ) / 0.09165
```

**Sanity check**: a healthy person at a given age typically scores a few years *below* their chronological age (PhenoAge runs slightly young in NHANES III). If the output lands 5–10 years *above* age, recheck units — the most common error is feeding albumin in g/dL instead of g/L, or creatinine in mg/dL instead of µmol/L.

**Partial estimates**: if a marker is missing, you cannot simply drop its term — the coefficients are fit jointly. Instead flag PhenoAge as **indeterminate** and report only the qualitative cross-system picture. Do not invent a number.

### GrimAge (surrogate)

GrimAge adds DNAm-based mortality predictors; the routine-blood surrogate uses the same 9 markers plus smoking-pack-years where known, weighted toward the inflammatory and renal terms. Report it as a second opinion on the PhenoAge estimate — large disagreement between the two suggests a dominant single driver (e.g. renal or inflammatory) worth isolating.

### Signal card format

```
[biological_age] = [PhenoAge: X yr | GrimAge: Y yr | chronological: Z yr | delta: X−Z yr]
```

- **delta ≤ 0**: biological age at or below chronological — systems are keeping pace.
- **delta +3 to +7**: moderate acceleration — find the dominant axis (metabolic and inflammatory are the usual roots).
- **delta > +7**: significant acceleration — prioritize the root-axis intervention above all supplement additions.

**Recheck**: not a lab re-draw; recompute PhenoAge whenever the 9 input markers are refreshed (2–12 weeks depending on which changed). The delta trend across sessions (stored in `longitudinal-record.md`) is the real signal — is biological age converging toward chronological?
