# Lab parsing

A reference prompt to turn any lab PDF, screenshot, or pasted table into the signal-card format Step 1 expects. No code dependency — any agent can run this by pasting the user's raw lab file plus the prompt below.

Works for: PDF lab reports, images of results, spreadsheets, pasted text tables, and portal screenshots.

---

## Extraction prompt

```
You are parsing a lab report into structured signal cards. For every marker in the
report, output one line in this exact format:

[marker] = [value] [unit] | optimal: [range] | ref: [lab range] | trend: [unknown] | confidence: [high]

Rules:
- Use the report's own value and unit verbatim.
- "optimal" comes from biomarkers.md optimal ranges, NOT the lab's reference range.
  If biomarkers.md has no entry, write optimal: "see lab ref" and keep the lab range in "ref".
- "trend" is "unknown" on a first parse (no prior draw to compare). The skill fills
  trend in later by comparing across sessions.
- "confidence" is high unless the draw looks confounded (see lab-ground-rules.md:
  non-fasting glucose/insulin/lipids, wrong draw time for cortisol/TSH/T, recent
  supplements). If confounded, write confidence: low and note the confounder.
- Preserve the original marker name AND add the standardized name if they differ
  (e.g. "Glucose, Fasting" → fasting_glucose).
- Drop panels that are not health-relevant (e.g. drug-screen administrative lines)
  unless the user asks for them.
- If the report gives a date, prepend it: [2026-03-14] [marker] = ...

After the cards, write a one-line "parse notes" block: any missing units, ambiguous
markers, or confounders you flagged.
```

---

## Multiple historical PDFs (catch-up)

When the user drops several past reports at once, parse each independently, then sort
by date. The skill uses the most recent draw as the current state and older draws to
compute `trend`. Flag any marker whose lab or unit changed between reports (e.g.
ferritin reported in ng/mL vs µg/L) so values aren't compared apples-to-oranges.

---

## Standardized marker names

The skill contextualizes **every** marker present in a panel, not just a fixed list.
This table maps common report labels to canonical names so repeated markers stay
comparable across sessions. It is **not exhaustive** — when a marker isn't listed,
use the rule at the bottom of this section.

### Metabolic
| Report label (examples) | Canonical |
|---|---|
| Glucose, Fasting / GLU / FPG | fasting_glucose |
| Insulin, Fasting / FINS | fasting_insulin |
| HOMA-IR / Insulin Resistance Index | homa_ir |
| HbA1c / A1c / Glycated Hb / IFCC | hba1c |
| Estimated Avg Glucose / eAG | eag |
| C-Peptide | c_peptide |
| Urea / BUN | urea |
| Cystatin C | cystatin_c |
| Creatinine | creatinine |
| eGFR / GFR (CKD-EPI, MDRD) | egfr |
| Uric Acid / UA | uric_acid |

### Lipids & cardiovascular
| Report label | Canonical |
|---|---|
| Total Cholesterol / TC | total_cholesterol |
| HDL-C / HDL Cholesterol | hdl |
| LDL-C / Calculated LDL | ldl |
| Triglycerides / TG | triglycerides |
| Apolipoprotein A1 / ApoA1 | apoa1 |
| Apolipoprotein B / ApoB | apob |
| ApoB:ApoA1 ratio | apob_apoa1_ratio |
| Lipoprotein (a) / Lp(a) | lpa |
| Blood Pressure (systolic) | bp_systolic |
| Blood Pressure (diastolic) | bp_diastolic |
| NT-proBNP / BNP | bnp |

### Inflammatory & immune
| Report label | Canonical |
|---|---|
| hs-CRP / CRP, high sensitivity | hs_crp |
| Homocysteine / Hcy | homocysteine |
| Ferritin / Fer | ferritin |
| Iron (Sideremia) / Serum Iron | iron |
| TIBC | tibc |
| Transferrin saturation / Iron sat | iron_saturation |
| WBC / Leukocytes | wbc |
| Neutrophils (%, abs) | neutrophils |
| Lymphocytes (%, abs) | lymphocytes |
| Monocytes (%, abs) | monocytes |
| Eosinophils (%, abs) | eosinophils |
| Basophils (%, abs) | basophils |
| ESR / Sedimentation rate | esr |
| Platelets | platelets |
| MPV | mpv |
| Neutrophil:Lymphocyte ratio | nlr |

### Hematology
| Report label | Canonical |
|---|---|
| RBC / Erythrocytes | rbc |
| Hemoglobin / Hb | hemoglobin |
| Hematocrit / Hct | hematocrit |
| MCV | mcv |
| MCH | mch |
| MCHC | mchc |
| RDW | rdw |

### Hormonal
| Report label | Canonical |
|---|---|
| TSH / Thyroid Stimulating Hormone | tsh |
| Free T4 / FT4 | ft4 |
| Free T3 / FT3 | ft3 |
| Reverse T3 / rT3 | reverse_t3 |
| Total Testosterone | total_t |
| Free Testosterone | free_t |
| SHBG | shbg |
| Estradiol / E2 | estradiol |
| Progesterone | progesterone |
| LH | lh |
| FSH | fsh |
| DHEA-S | dhea_s |
| Cortisol (AM/PM) | cortisol |
| IGF-1 / Somatomedin C | igf1 |
| Prolactin | prolactin |
| PSA | psa |

### Liver & oxidative
| Report label | Canonical |
|---|---|
| ALT / GPT | alt |
| AST / GOT | ast |
| GGT / Gamma-GT | ggt |
| Alkaline Phosphatase / ALP | alp |
| Bilirubin (total/direct) | bilirubin |
| Albumin | albumin |

### Nutritional & vitamins
| Report label | Canonical |
|---|---|
| Vitamin D, 25-OH / 25(OH)D | vitamin_d |
| Vitamin B12 / Cobalamin | b12 |
| RBC Folate / Folate | folate |
| Methylmalonic Acid / MMA | mma |
| Vitamin B1 / Thiamine | b1 |
| Vitamin B6 / PLP | b6 |
| Vitamin B9 | b9 |
| Magnesium (RBC) | magnesium_rbc |
| Magnesium (serum) | magnesium_serum |
| Zinc / Zn (serum/erythrocyte) | zinc |
| Selenium / Se | selenium |
| Copper / Ceruloplasmin | copper |
| Calcium (serum/ionized) | calcium |
| Phosphate | phosphate |

### Fitness / recovery (tracker)
| Report label | Canonical |
|---|---|
| VO2 max / VO2max | vo2_max |
| HRV (RMSSD) | hrv |
| RHR / Resting HR | rhr |
| Deep sleep / REM / Sleep latency | sleep_* |
| Steps / Active calories | activity_* |

### Other
| Report label | Canonical |
|---|---|
| Creatine Kinase / CK | ck |
| LDH | ldh |
| Sodium / Na | sodium |
| Potassium / K | potassium |
| Chloride / Cl | chloride |

**Unrecognized-marker rule**: if a marker isn't in this table *and* isn't in
`biomarkers.md`, keep the report's exact label as the canonical name (no guessing,
no silent dropping). Write the signal card using the report's own reference range
for the `optimal` field, flag `confidence: medium`, and append a `?` note so the
skill can flag it as an unrecognized marker in Step 6 rather than mis-scoring it.
The goal is to contextualize the *entire* panel, not to force every result into a
known bucket.
