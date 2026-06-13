# Longitudinal biomarkers — age + sex-relevant capture & display (v1)

**Status:** v1 engineering shipped (sex-aware catalog + USPSTF scaffold); **clinical sign-off pending** on the marker SET, ranges, and screening cadences. Operator review 2026-06-13.

This doc answers: *how do we make the health-marker list complete and accurate by age and gender, and what standardized sources do we lean on* — for a longitudinal-health app that has to genuinely deliver value, be cutting-edge, and stay easy to use.

---

## 1. Hard boundary (read first)

The app **captures coded values** and **displays them against sourced, versioned reference ranges** — it **explains, never diagnoses or recommends**. Three rules govern everything below:

1. **The marker SET, reference RANGES, and screening CADENCES are clinical content** — sourced from authoritative bodies and signed off by a named clinical reviewer. They are **never invented in code**. (Mirrors the empty-by-design `interpretation/tableV1.ts` biomarkers map + `CURATED_PANELS`.)
2. **Terminology is sourced from NLM/LOINC** (verified against the NLM Clinical Tables API), not memory.
3. **Cohort gating is on `sex_at_birth`** (the clinical key), never gender identity. Age gates *interpretation + screening cadence*, not which marker is offered (the cohort is 45+).

---

## 2. What shipped (v1 catalog)

`mobile/src/screens/markers/markerCatalog.ts` — 20 markers, all `provisional: true`, every LOINC code NLM-verified (original 9 on 2026-06-12; the 12 below on 2026-06-13), grouped for an easy picker, sex-gated via `markersFor(sex_at_birth)`:

| Group | Markers (LOINC) |
|---|---|
| Heart & cholesterol | Blood pressure (8480-6/8462-4), Resting HR (8867-4), Total chol (2093-3), LDL (18262-6), HDL (2085-9), **Triglycerides (2571-8)**, **hs-CRP (30522-7)** |
| Blood sugar | HbA1c (4548-4), Fasting glucose (1558-6) |
| Kidney & liver | **Creatinine (2160-0)**, **eGFR — CKD-EPI 2021 race-free (98979-8)**, **ALT (1742-6)**, **AST (1920-8)** |
| Thyroid & nutrients | **TSH (3016-3)**, **Ferritin (2276-4)**, **Vitamin D 25-OH (62292-8)** |
| Body | Weight (29463-7), **Waist circumference (56086-2)** |
| Men's health (sex=male) | **Testosterone (2986-8)**, **PSA (2857-1)** |

(**bold** = the 12 added in this pass.) Plausible bounds are **typo guards** (physical extremes), not clinical ranges.

---

## 3. The age/sex completeness story — especially women

Two distinct mechanisms make this "complete for gender and age":

**(a) Sex-specific *interpretation* of universal markers (reviewer-gated, biggest lever).** Most markers are measured by everyone but read differently by sex/age: HDL and waist thresholds differ by sex; CV risk shifts for women after menopause; ferritin/TSH ranges differ. This lives in the **versioned interpretation table** (`tableV1.ts`, strategies `uniform | sex-specific | age-sex-specific`), which is **empty for biomarkers by design** until the reviewer ships ranges sourced from ADA / ACC-AHA / KDIGO / WHO / ATA.

**(b) Sex-specific markers + a preventive cadence layer.**
- Male-only loggable labs: PSA, testosterone (shipped).
- **Women's-health priorities (NOT yet loggable — routed to §5 + reviewer):**
  - **Bone-density T-score (DEXA)** — *the* signature post-menopausal longitudinal marker. Site-specific LOINC (DXA Hip 38264-8 / Spine 104938-6) and a **negative** T-score scale, so it needs a dedicated signed-number entry + reviewer decision on site — deferred from the quick-entry catalog.
  - **Mammography, Pap/HPV cadence** — screening-cadence trackers, not "values" → the preventive layer.
  - Thyroid (TSH), ferritin, vitamin D — shipped as universal markers but **women-weighted** in prevalence/relevance.

> Honest note: there is no female-*exclusive* loggable-lab group in v1 (the key women's marker, bone density, is deferred). The women's value is delivered through sex-specific **interpretation** + the **preventive layer** + the deferred bone-density entry — not catalog exclusivity.

---

## 4. Standardized sources (the "RAG" question) — the real landscape

There is **no single downloadable "normal-range" dataset.** The authoritative, mostly machine-readable sources, by purpose:

| Need | Source | Notes |
|---|---|---|
| Terminology / codes | **NLM LOINC** (Clinical Tables API) + **UCUM** units | Already used to verify every code. |
| Screening cadence by age/sex | **USPSTF Prevention TaskForce API / ePSS** | The gold standard for "what to screen, when, by age+sex" — bone density, mammography, lipids, diabetes, colorectal. Machine-readable. This is the best "standardized" fit for the age/gender preventive layer (§5). |
| Reference ranges | **Clinical guidelines** — ADA (A1c/glucose), ACC/AHA + NHLBI (lipids/BP), KDIGO + CKD-EPI 2021 (kidney), WHO (bone T-score), ATA (thyroid) | Curated into the versioned table; not pulled live. |
| Coverage (Medicare) | **CMS NCD/LCD** (already used by the web app) + preventive-services coverage | CMS answers "is it covered," not "is it normal." |
| Data model | **FHIR R4 / USCDI v3** (Observation + LOINC + UCUM + referenceRange) | The modern interoperability standard the app already targets. |

So "CMS or others" → **USPSTF** for the age/sex preventive layer, **guidelines** for ranges, **LOINC/NLM** for terminology, **CMS** for coverage.

---

## 5. USPSTF preventive layer (scaffold shipped)

`mobile/src/preventive/uspstf.ts` — types + pure `dueScreenings(age, sex, lastDone, now)` logic + an **empty `PREVENTIVE_RECOMMENDATIONS`** set (reviewer/API-gated, same pattern as the interpretation table).

Integration plan:
1. Fetch the USPSTF recommendation set via their API (key-gated), map to `PreventiveRecommendation`, store as a **versioned set with provenance** (topic + grade + retrieval date). Queries are **by age/sex only — no PHI leaves the device** (same posture as the government-API tools).
2. "Last done" dates come from **local observations** (a logged mammogram/DEXA/colonoscopy date), never transmitted.
3. Surface a **"Due for…"** card on the dashboard, sex/age-filtered. Copy **states the standardized cadence + the operator-locked referral verb** ("talking with your doctor could help") — explains, never directs.

---

## 6. How a cutting-edge app captures + displays this

- **Capture:** catalog-driven **coded** entry (LOINC + UCUM — shipped), **sex/age-aware** (shipped), grouped picker (shipped), + lab-report upload (shipped) + **device-sync** (HealthKit / Google Fit for vitals — Phase 2). Provenance per value (`self_reported` / `uploaded_report` / `derived`).
- **Interpret:** value shown against the user's **own age+sex reference band** (shaded, like the instrument charts), sourced + versioned. Below/in/above the band — **never a diagnosis**.
- **Trend:** longitudinal series + **rate of change** (eGFR slope, A1c trajectory), explained against the user's history.
- **Prevent:** the USPSTF "Due for…" layer (§5).
- **Easy to use:** plain-language names (no acronyms surfaced), grouped picker, unit toggles, "what did you measure?" framing.

---

## 7. Open decisions for the clinical reviewer

1. **Marker set** — approve / trim / extend the 20 (and the 12 new in particular).
2. **Bone-density T-score** — site (hip vs spine), the negative-scale entry UX, and whether it's a logged value vs a preventive-cadence item.
3. **Reference ranges** — populate `tableV1.ts` biomarker entries (age+sex), each citing its guideline + version.
4. **USPSTF set** — supply / approve the recommendation extract for `PREVENTIVE_RECOMMENDATIONS`.
5. **Coding nuances** — fasting vs random glucose (1558-6/2339-0); LDL direct (18262-6) vs calculated (13457-7); international units for the new single-unit markers.
6. **Referral verb** — the operator-locked final wording for the preventive + interpretation surfaces.
