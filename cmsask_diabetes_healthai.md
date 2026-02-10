# CMS Criteria Gap Analysis: Conversational AI + Diabetes & Obesity

> Reference doc so we don't repeat this analysis. Covers what Blue Button provides,
> what CMS expects, and how we bridge the gap via EOB-to-clinical extraction.

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

## CMS Criteria Assessment

### Conversational AI Criteria

| Criterion | Requirement | Status | How |
|-----------|-------------|--------|-----|
| Personalized AI across clinical record | Use connected health data in AI | **Partial → Full** | EOB extraction gives conditions + medications to Claude |
| Coverage intelligence | Personalized guidance from claims | **Met** | Coverage + denial data from EOB already works |
| Lab/condition awareness | Reference patient's actual data | **Partial** | Conditions from EOB diagnoses (no lab values) |
| Medication awareness | Know patient's active drugs | **Not met → Full** | Part D extraction gives diabetes medications |
| Diabetes classification | Classify patient status | **Not met → Full** | classifyDiabetesStatus() works once it gets conditions + medications |

### Diabetes & Obesity Criteria

| Criterion | Requirement | Status | How |
|-----------|-------------|--------|-----|
| Connect clinical record | FHIR data in diabetes dashboard | **Partial → Full** | EOB conditions + medications populate dashboard |
| Classification engine | Diabetic/pre-diabetic/at-risk | **Dead → Working** | classifyDiabetesStatus() gets real inputs |
| Personalized coaching | Based on classification + data | **Dead → Working** | DIABETES_PREVENTION_SKILL activates with classification |
| Risk alerts | Proactive alerts from data | **Dead → Working** | RiskAlerts component gets real conditions/medications |
| Screening reminders | Due date tracking | **Partial** | Can detect A1C procedure dates from EOB (not values) |
| Medication coaching | Reference active diabetes meds | **Dead → Working** | Part D extraction identifies diabetes drugs |
| MDPP eligibility | Pre-diabetic detection + referral | **Dead → Working** | Pre-diabetic ICD-10 codes trigger MDPP coaching |

### What Remains Impossible (Without Lab Values)

- A1C trend chart with actual values (need Observation resource)
- A1C range highlighting on diabetes page (need value, not just "test was done")
- Lab-based classification thresholds (A1C >= 6.5 → diabetic)
- interpretLabValue() in context.ts (no values to interpret)

**Mitigation:** Classification still works via:
1. ICD-10 diagnosis codes (most direct — doctor already diagnosed)
2. Active diabetes medications (implies diabetes)
3. Obesity diagnosis codes (at-risk)

These are actually MORE reliable than lab thresholds because they reflect physician assessment.

## Extraction Architecture

### New Module: `src/lib/fhir/eob-clinical.ts`

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

### Data Flow

```
Blue Button EOBs
  → transformEOB() [adds diagnosisCodes[], procedureCodes[]]
  → extractConditionsFromClaims() → DiagnosisSummary[]
  → extractMedicationsFromClaims() → MedicationSummary[]
  → Cache in fhir_cache (conditions, medications)
  → getCachedHealthData() reads them
  → /api/fhir/data returns them
  → useHealthData() sets state
  → Downstream: diabetes page, chat page, context.ts, skills
```

### Changes Required

| File | Change |
|------|--------|
| `transforms.ts` | Add `diagnosisCodes?: string[]`, `procedureCodes?: string[]` to ClaimSummary |
| `transforms.ts` | Extract codes in transformEOB alongside display names |
| `eob-clinical.ts` | **New** — extraction functions |
| `sync.ts` | Call extraction, cache conditions/medications |
| CLAUDE.md | Update sync.ts description |

### No Changes Needed (Already Wired)

- `getCachedHealthData()` — already reads conditions/medications from cache
- `/api/fhir/data` — already returns conditions/medications
- `useHealthData()` — already has setConditions/setMedications
- `diabetes/page.tsx` — already passes to classifyDiabetesStatus()
- `chat/page.tsx` — already bridges to initialSessionState
- `context.ts` — already injects conditions/medications into Claude prompt
- `DIABETES_PREVENTION_SKILL` — already uses classification for coaching
- `RiskAlerts`, `ScreeningReminders` — already consume this data
