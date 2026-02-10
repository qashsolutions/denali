# CMS Criteria Gap Analysis: Conversational AI + Diabetes & Obesity

> Reference doc so we don't repeat this analysis. Covers what Blue Button provides,
> what CMS expects, and how we bridge the gap via EOB-to-clinical extraction.
> Cross-checked against codebase 2026-02-09.

---

## Blue Button 2.0 Reality

Blue Button provides **exactly 3 FHIR resources**:

| Resource | Available | What It Contains |
|----------|-----------|------------------|
| **Patient** | Yes | Name, DOB, gender, Medicare ID, address |
| **Coverage** | Yes | Part A/B/C/D status, start dates, plan names |
| **ExplanationOfBenefit** | Yes | Claims: diagnoses (ICD-10), procedures (CPT), Part D drugs (NDC), amounts, denials |
| ~~Observation~~ | **No** | ~~Lab values (A1C, glucose, BMI)~~ |
| ~~Condition~~ | **No** | ~~Active diagnoses (diabetes, obesity)~~ |
| ~~MedicationRequest~~ | **No** | ~~Prescriptions (metformin, insulin)~~ |

Source: [bluebutton.cms.gov/data/understanding-the-data](https://bluebutton.cms.gov/data/understanding-the-data/)

## What EOB Claims Contain (Clinical Intelligence)

EOB claims are rich with clinical data — just structured differently:

### Diagnosis Codes (ICD-10)
Every claim has `diagnosis[].diagnosisCodeableConcept.coding[]` with:
- `.code` = ICD-10 code (e.g., "E11.9")
- `.display` = plain English (e.g., "Type 2 diabetes mellitus")

**Diabetes-relevant ICD-10 prefixes:**
- `E10.*` → Type 1 diabetes
- `E11.*` → Type 2 diabetes
- `E13.*` → Other diabetes
- `R73.03` → Pre-diabetes
- `R73.09` → Pre-diabetes (other)
- `E66.*` → Obesity

### Procedure Codes (CPT)
Every claim has `item[].productOrService.coding[]` with:
- `.code` = CPT or HCPCS code (e.g., "83036")
- `.display` = procedure name (e.g., "Hemoglobin A1C")

### Part D Drug Names
Part D Event (PDE) claims have drug info in `item[].productOrService`:
- `.display` = drug name (e.g., "METFORMIN HCL 500MG TABLET")
- `.code` = NDC code

**Diabetes drug patterns:** metformin, insulin, glipizide, glyburide, glimepiride, pioglitazone, sitagliptin, saxagliptin, linagliptin, canagliflozin, dapagliflozin, empagliflozin, liraglutide, semaglutide, dulaglutide, exenatide, tirzepatide, acarbose, repaglinide, etc.

## What We CAN'T Get from EOBs

- **Actual lab values** — EOBs show "A1C test was done" but NOT "A1C = 7.2%"
- **Active vs. resolved status** — Claims show a diagnosis was billed, not whether it's currently active
- **Dosage instructions** — Part D shows drug name, not "500mg twice daily"
- **Prescription status** — Recent Part D claim implies active, but no explicit "active/stopped"

---

## Extraction Architecture (Implemented)

### Module: `src/lib/fhir/eob-clinical.ts`

```
extractConditionsFromClaims(claims: ClaimSummary[]) → DiagnosisSummary[]
  - Scans claim.diagnosisCodes[] for diabetes/obesity ICD-10 prefixes
  - Deduplicates by code (keeps most recent date)
  - Maps to DiagnosisSummary with category

extractMedicationsFromClaims(claims: ClaimSummary[]) → MedicationSummary[]
  - Filters to Part D (PDE) claims
  - Takes procedures[] as drug names
  - Matches against DIABETES_DRUG_PATTERNS
  - Deduplicates by normalized name (keeps most recent)
  - Recent claims (< 6 months) = "Active", older = "Completed"
```

### Data Flow (Verified End-to-End)

```
Blue Button EOBs
  → transformEOB() [adds diagnosisCodes[], procedureCodes[]]
  → extractConditionsFromClaims() → DiagnosisSummary[]
  → extractMedicationsFromClaims() → MedicationSummary[]
  → sync.ts caches in fhir_cache (resource_type: "conditions", "medications")
  → getCachedHealthData() reads from cache
  → /api/fhir/data returns to client
  → useHealthData() sets state (conditions, medications)
  ├─→ diabetes/page.tsx → classifyDiabetesStatus() → classification badge, RiskAlerts
  ├─→ chat/page.tsx → initialSessionState → route.ts → hasDiabetesContext trigger
  ├─→ context.ts → injects conditions + medications into Claude prompt
  └─→ skills-loader.ts → DIABETES_PREVENTION_SKILL loaded when conditions found
```

### Files Changed

| File | Change |
|------|--------|
| `transforms.ts` | Added `diagnosisCodes?: string[]`, `procedureCodes?: string[]` to ClaimSummary. Removed dead FHIR extraction functions (~115 lines) |
| `eob-clinical.ts` | **New** — extraction functions |
| `sync.ts` | Calls extraction, caches conditions/medications. Removed 3 dead FHIR calls |
| `CLAUDE.md` | Updated sync.ts description |

---

## Component-Level Status (Verified Against Code)

### What WORKS with EOB-Extracted Data

| Component | Functional | Evidence |
|-----------|-----------|----------|
| **classifyDiabetesStatus()** | 85% | ICD-10 diagnosis → "diabetic" (step 1). Active meds → "diabetic" (step 7). Obesity → "at-risk" (step 9). Lab-based steps 2/3/5/6/8 skipped (no values). |
| **DIABETES_PREVENTION_SKILL** | 70% | Classification-based coaching, medication coaching, MDPP referral, lifestyle advice all fire. Lab-specific guidance (A1C interpretation, trend awareness, screening frequency) is dead. |
| **InsightsCard + AI** | 60% | Claude generates summary + recommendations from conditions + meds. Cannot assess A1C control or trends. Generic coaching, not quantitative. |
| **RiskAlerts** | 33% | Only "diabetes diagnosis but no active meds" alert fires. A1C >= 9.0 alert dead (no lab values). A1C trending up alert dead (no snapshot data). |
| **context.ts prompt injection** | 90% | Conditions and medications sections inject correctly. Lab section, lab trends section, interpretLabValue() never fire. |
| **hasDiabetesContext trigger** | 100% | Fires on conditions with diabetes categories. Skills-loader loads DIABETES_PREVENTION_SKILL. |

### What's DEAD (Needs Lab Values We Can't Get)

| Component | Functional | Root Cause |
|-----------|-----------|------------|
| **ScreeningReminders** | 0% | All 4 reminders need `labs.find(l => l.name.includes("a1c"))`. `labs = []` always. Renders null. |
| **A1CTrendChart** | 0% | Needs `diabetes_snapshots` data. `appendDiabetesSnapshots()` is never called. No data writer. |
| **A1CRangeBar** (diabetes page) | 0% | Needs `latestA1C.value`. `labs = []` so `latestA1C` is always undefined. |
| **RiskAlerts** (2 of 3 alerts) | 0% | "A1C >= 9.0" and "A1C trending up" need lab values. |

### Dead Code Inventory

| Item | File | Status |
|------|------|--------|
| `appendDiabetesSnapshots()` | `snapshots.ts` | Orphaned — no caller. Was called by sync.ts before cleanup |
| `diabetes_snapshots` table | Supabase | Read by 4 consumers, written by nothing |
| `FhirObservation` interface | Removed from `transforms.ts` | Was dead |
| `extractDiabetesLabs()` | Removed from `transforms.ts` | Was dead (operated on FHIR Observations) |
| `extractDiabetesConditions()` | Removed from `transforms.ts` | Replaced by `eob-clinical.ts` |
| `extractDiabetesMedications()` | Removed from `transforms.ts` | Replaced by `eob-clinical.ts` |

---

## CMS Criteria Assessment (Honest)

### Conversational AI Criteria

| Criterion | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| Personalized AI across clinical record | Use connected health data in AI | **Working** | context.ts injects conditions + medications into Claude prompt |
| Coverage intelligence | Personalized guidance from claims | **Working** | Coverage + denial data from EOB flows to Claude |
| Lab/condition awareness | Reference patient's actual data | **Partial** | Conditions from EOB diagnoses work. No lab values — Claude can't say "your A1C is X" |
| Medication awareness | Know patient's active drugs | **Working** | Part D extraction gives diabetes medications to Claude |
| Diabetes classification | Classify patient status | **Working** | classifyDiabetesStatus() fires on ICD-10 codes + active meds |

### Diabetes & Obesity Criteria

| Criterion | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| Connect clinical record | FHIR data in diabetes dashboard | **Working** | EOB conditions + medications populate dashboard |
| Classification engine | Diabetic/pre-diabetic/at-risk | **Working** | ICD-10 diagnosis codes → classification. Lab paths skipped but not needed when diagnosis present |
| Personalized coaching | Based on classification + data | **Partial** | DIABETES_PREVENTION_SKILL fires, gives coaching based on classification + meds. Can't reference actual A1C values |
| Risk alerts | Proactive alerts from data | **Partial** | Only "no meds" alert works. A1C-based alerts dead |
| Screening reminders | Due date tracking | **Not working** | ScreeningReminders renders null — needs lab dates |
| Medication coaching | Reference active diabetes meds | **Working** | Part D extraction identifies diabetes drugs, Claude coaches on them |
| MDPP eligibility | Pre-diabetic detection + referral | **Working** | Pre-diabetic ICD-10 codes (R73.03/09) trigger MDPP coaching in skill + diabetes page |

### What Remains Impossible (Without Lab Values)

- A1C trend chart with actual values
- A1C range highlighting on diabetes page
- Lab-based classification thresholds (A1C >= 6.5 → diabetic)
- interpretLabValue() in context.ts
- ScreeningReminders (all 4 checks need A1C date)
- 2 of 3 RiskAlerts (high A1C, trending A1C)

**Mitigation:** Classification works reliably via ICD-10 diagnosis codes (physician assessment) and active medications (implies diabetes). These are MORE reliable than lab thresholds.

### Potential Future Improvements

| Improvement | Difficulty | Impact |
|-------------|-----------|--------|
| **ScreeningReminders from EOB procedures** — use CPT 83036 (A1C test) claim dates from EOBs instead of lab result dates | Low | Enables "Last A1C test was X months ago" without needing the value |
| **Remove dead A1C UI** — hide A1CTrendChart, A1CRangeBar, lab-dependent RiskAlerts when labs are empty | Low | Cleaner UX — don't show empty sections |
| **Medication refill tracking** — detect gaps in Part D claims for diabetes drugs | Medium | Alert: "No metformin fill in 3 months — discuss with doctor" |
| **Clean up diabetes_snapshots** — remove orphaned table or repurpose for EOB procedure dates | Low | Reduces dead code |
