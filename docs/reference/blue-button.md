# Blue Button 2.0 Reference

Full OAuth flow detail, EOB extraction pipeline (8 extractors),
transformEOB enrichments, condition severity classification.
Extracted from CLAUDE.md.

For the active subset (data availability constraints + consent
gate + key flow), see CLAUDE.md "Blue Button 2.0 (summary)".

---


Blue Button connects patients to their Medicare claims data via FHIR APIs. It is the **only** external health data source — Denali does not integrate with any EHR platforms or third-party health data services.

### Data Availability

What Blue Button provides and what it does not:

| Data                                               | Available                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Medicare claims, denials, what was billed/paid     | ✅                                                                       |
| Actual lab values (A1C, glucose, reference ranges) | ❌ — only that the lab was performed (CPT code), not the value           |
| Vitals (BP, weight, BMI)                           | ❌                                                                       |
| Conditions                                         | ⚠️ Inferred from EOB ICD-10 codes, not a formal diagnosis list           |
| Medications                                        | ⚠️ Part D claims only — no dosing, prescriber, or full medication record |
| Immunizations                                      | ❌                                                                       |
| Clinical notes                                     | ❌                                                                       |
| Visit history                                      | ⚠️ Claims-derived (service dates + CPT codes), no chief complaint        |

Note: `diabetes_snapshots` table stores longitudinal lab history but actual lab values are not available from Blue Button — only the dates labs were performed.

### OAuth Flow (PKCE)

**Prerequisite (DEPRECATED — NOT REQUIRED per CMS April 2026)**: Historically, when `REQUIRE_IDENTITY_VERIFICATION=true`, users had to be ID.me verified (`user_verification.idme_verified = true`); otherwise `/api/fhir/authorize` redirected to `/app/settings?idme_required=true`. Admin users bypassed this gate. The flag is now permanently `false` in all envs, so this gate is inactive. Code path retained pending removal in a future commit.

```
1. User clicks "Connect Medicare" on /app/health
2. GET /api/fhir/authorize (checks ID.me verification first):
   - Generate state (CSRF) + code_verifier (PKCE)
   - Compute code_challenge = SHA256(code_verifier) → base64url
   - Store state + code_verifier in httpOnly cookies (10 min TTL)
   - Build redirect_uri from request origin (no BLUEBUTTON_CALLBACK_URL env var set)
   - Redirect to CMS: /v2/o/authorize/?client_id=...&code_challenge=...&code_challenge_method=S256
3. User authorizes on CMS site → redirected to /api/fhir/callback?code=...&state=...
4. GET /api/fhir/callback:
   - Validate state cookie
   - Read code_verifier cookie
   - POST /v2/o/token/ with {code, code_verifier, redirect_uri} + Basic Auth
   - If access_token expired during OAuth redirect, inline refresh via refreshCognitoTokens()
   - Encrypt tokens (AES-256-GCM) → upsert ehr_connections
   - Clear cookies → redirect to /app/health?connected=true
```

**Callback URL auto-detection**: `BLUEBUTTON_CALLBACK_URL` env var is NOT set in ECS. The authorize route auto-detects from request origin: `${origin}/api/fhir/callback`. When user is on `staging.denali.health`, the redirect_uri sent to CMS is `https://staging.denali.health/api/fhir/callback`.

**Registered callback URLs** (Blue Button sandbox at `https://sandbox.bluebutton.cms.gov`): `https://denali.health/api/fhir/callback`, `http://localhost:3000/api/fhir/callback`, `https://stage.denali.health/api/fhir/callback`, `https://www.denali.health/api/fhir/callback`, `https://staging.denali.health/api/fhir/callback`.

### Scopes

`patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read profile openid`

### Token Security

- Access & refresh tokens encrypted at rest via `FHIR_TOKEN_ENCRYPTION_KEY` (AES-256-GCM)
- Token writes use pg pool to RDS with explicit `WHERE user_id = $1`; reads use same pool with `getAuthUser()` + `WHERE user_id = $1` (RDS has no RLS)
- Auto-refresh on expired access tokens via `refreshAccessToken()` in `lib/fhir/tokens.ts`

### Health Data in AI

- Client-side `useHealthData()` fetches from `/api/fhir/data` → populates sessionState fields (`healthDataAvailable`, `activeCoverage`, `recentDenials`, `labs`, `conditions`, `medications`, `screenings`, `providers`, `hospitalizations`, `diabetesClassification`, `obesityClassification`)
- Chat page bridges health data into `useChat` via `initialSessionState` (built with `useMemo`, synced via `useEffect` for async loading). **Consent-gated**: when `health_data_ai` is OFF, returns minimal state with `healthDataAvailable: false` + `blueButtonConnected: true` (no health fields sent to server). `useChat.ts` overlays latest consent before each API call for mid-session toggle support. Also auto-detects Medicare type from Blue Button coverage: Part C → `medicareType: "advantage"` + `maPlanName`; Part A/B → `medicareType: "original"`. `recentClaims` includes `denialReasons` for denied claims.
- Server-side `buildHealthContextForPrompt()` injects health context into Claude system prompt: active coverage (+ MA plan name if present), lab results (with clinical interpretations), diabetes diagnoses, obesity conditions, active medications (with PDE supply/gap data + separate obesity medication section), screenings (with overdue alerts including obesity counseling G0447/G0473), care team providers, recent hospitalizations (with follow-up flags), diabetes classification with action directives, obesity classification with action directives, recent denials (gated by `health_data_ai` consent), denial reasons on individual claims
- `HEALTH_RECORDS_SKILL` loaded when `hasHealthData` or `hasRecentDenials` triggers fire
- `EOB_EXPLAINER_SKILL` loaded when `hasEOBQuestion && hasHealthData` — user asks about bills/claims with Blue Button connected
- `DIABETES_PREVENTION_SKILL` loaded when `hasDiabetesContext` triggers (from conditions, labs, or user keywords)
- `OBESITY_PREVENTION_SKILL` loaded when `hasObesityContext` triggers (from E66 conditions, obesity medications like Wegovy/Zepbound, or user keywords like weight loss/bariatric/BMI). `classifyObesityStatus()` provides 3-tier classification: obese/at-risk/none

### EOB Extraction Pipeline

`eob-clinical.ts` mines clinical intelligence from EOB claims data (since Blue Button doesn't provide Observation/Condition/MedicationRequest resources directly). Four extraction layers:

| Function                              | Input                       | Output                     | Key Logic                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | --------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extractConditionsFromClaims()`       | All claims                  | `DiagnosisSummary[]`       | Scans `diagnosisCodes[]` for diabetes ICD-10 prefixes (E10, E11, E13, R73, E66). Dedupes by code, keeps most recent date                                                                                                                                                                                   |
| `extractMedicationsFromClaims()`      | Part D claims               | `MedicationSummary[]`      | Filters PDE claims, matches drug name patterns (DIABETES_DRUG_PATTERNS + OBESITY_DRUG_PATTERNS). Dual-flagging: `isDiabetesMed` + `isObesityMed` (GLP-1s like semaglutide can be both). Enriched with PDE data: daysSupply, refillNumber, brand/generic, estimatedRunOutDate, gapDays (positive = overdue) |
| `extractScreeningsFromClaims()`       | Carrier/Outpatient claims   | `ScreeningHistory[]`       | Matches `procedureCodes[]` against `SCREENING_CPT_MAP` (20 CPT codes → 9 screening types: A1C, eye-exam, kidney, ECG, office-visit, nutrition, DSMT, metabolic-panel, obesity-counseling). Dedupes by type, computes monthsSinceLast + isOverdue                                                           |
| `extractProvidersFromClaims()`        | All claims with careTeam    | `ProviderDetail[]`         | Aggregates by NPI, tracks specialty, visit count, claim types. From `careTeam[]` extracted in `transformEOB()`                                                                                                                                                                                             |
| `extractHospitalizationsFromClaims()` | Inpatient/SNF claims        | `HospitalizationSummary[]` | Filters inpatient claims, computes LOS, daysSinceDischarge, needsFollowUp (< 30 days). Admission type + discharge status from `supportingInfo[]`                                                                                                                                                           |
| `extractDMEFromClaims()`              | DME claims                  | `DMESummary[]`             | Maps HCPCS codes (E0607, E2100, A4253, E0601, E0784, etc.) to categories (glucose-monitor, cpap, insulin-pump, test-strips, etc.) with diabetes/obesity relevance flags                                                                                                                                    |
| `extractPatientWeight()`              | Professional/Carrier claims | `WeightMeasurement[]`      | Scans `supportingInfo` for `patientweight` category. Returns empty if BB doesn't populate (placeholder)                                                                                                                                                                                                    |
| `detectHospiceStatus()`               | All claims                  | `boolean`                  | Returns true if ANY hospice claim exists. **SAFETY**: triggers hospice gate in AI prompt + suppresses risk alerts                                                                                                                                                                                          |

**Data flow**: Blue Button FHIR → `transformEOB()` (extracts PDE/careTeam/POS/inpatient/diagnosis-types/NDC/network fields onto `ClaimSummary`) → `eob-clinical.ts` extractors (8 functions) → `sync.ts` caches 11 resource types (patient, coverage, eob, conditions, medications, screenings, providers, hospitalizations, dme, hospice_status, sync_meta) → `useHealthData` hook → `context.ts` prompt injection + `chat/page.tsx` SessionState bridge

**`transformEOB()` enrichments** (in `transforms.ts`):

- `extractPDEInfo()`: Reads `supportingInfo[]` for dayssupply, refillnum, brandgenericindicator → `ClaimSummary.pdeInfo`
- `extractCareTeam()`: Maps `careTeam[]` to NPI + name + role + specialty → `ClaimSummary.careTeam`
- `extractPlaceOfService()`: Maps `item[].locationCodeableConcept` via `POS_CODE_MAP` → `ClaimSummary.placeOfService`
- Inpatient: `extractAdmissionType()`, `extractDRGCode()`, `extractDischargeStatus()` from `supportingInfo[]` → `ClaimSummary` fields (only populated for inpatient claim types)
- Diagnosis types: `extractDiagnosisTypes()` maps `diagnosis[].type` to primary/secondary, populates `primaryDiagnosis`, `diagnosisTypes`, `presentOnAdmission` on `ClaimSummary`
- NDC codes: `extractNDCCodes()` extracts 11-digit NDC from PDE `item.productOrService.coding` → `ClaimSummary.ndcCodes`
- Network status: `extractNetworkStatus()` reads `item.adjudication[billingnetworkstatus]` → `ClaimSummary.networkStatus` ("in"/"out"/null)

### Condition Severity Classification

`DiagnosisSummaryCard.tsx` color-codes conditions in the health page. Priority chain:

1. **Structured match** — `DiagnosisSummary.category` from `eob-clinical.ts` (type1/type2 → red, pre-diabetic/obesity → amber)
2. **RED keywords** (21 terms) — neoplasm, malignant, cancer, carcinoma, lymphoma, melanoma, hemorrhage, elevated prostate, acute kidney, renal failure, pulmonary embolism, stroke, cerebrovascular, heart failure, cardiac arrest, sepsis, septicemia, tumor, morbid obesity, severe obesity, obesity class iii
3. **AMBER keywords** (27 terms) — hypertension, hypertensive, impaired glucose, hyperglycemia, thyroid, anemia, hyperlipidemia, cholesterol, chronic kidney, atrial fibrillation, arrhythmia, neuropathy, retinopathy, nephropathy, osteoporosis, COPD, depression, anxiety, bipolar, etc.
4. **Gray** — everything else (routine/stable conditions)

`cleanDiagnosisName()` strips U+25CC (dotted circle) combining mark artifacts from FHIR diagnosis names before display and matching.

