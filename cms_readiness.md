# CMS Interoperability Framework — Readiness Report

> **Last updated**: 2026-02-09
> **App**: Denali Health (Patient-Facing App)
> **Categories**: Conversational AI Assistants + Diabetes & Obesity Prevention and Management
> **Target**: Q1 2026 CMS Early Adopter Showcase
> **FHIR Mandate**: July 4, 2026

> **Update — May 24, 2026:** Vercel and Supabase are no longer in use. All infrastructure (staging and production) now runs on AWS exclusively (ECS Fargate, RDS Postgres, Cognito, Bedrock, SES; AWS BAA executed 2026-02-25). Row-Level Security has been replaced by explicit `WHERE user_id = $1` clauses in application code. Strikethroughs below preserve the original text as historical record.

---

## Table of Contents

1. [Patient-Facing App Criteria (A1-A6)](#patient-facing-app-criteria-a1-a6)
2. [Conversational AI — Category Criteria](#conversational-ai--category-criteria)
3. [Diabetes & Obesity — Category Criteria](#diabetes--obesity--category-criteria)
4. [Framework Section I: Patient Access & Empowerment](#framework-section-i-patient-access--empowerment)
5. [Framework Section V: Identity, Security & Trust](#framework-section-v-identity-security--trust)
6. [Framework Sections II-IV (Reference)](#framework-sections-ii-iv-reference)
7. [Compliance Status Summary](#compliance-status-summary)
8. [Remaining Gaps](#remaining-gaps)
9. [Key Dates](#key-dates)

---

## Patient-Facing App Criteria (A1-A6)

All 6 criteria must be met for BOTH categories.

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| **A1** | IAL2/AAL2 identity verification via intermediary PHR or CMS-approved service | DONE | Blue Button OAuth via Medicare.gov = IAL2/AAL2 via intermediary PHR path. PKCE (S256) + AES-256-GCM encrypted token storage. TOTP MFA opt-in for extra security (not CMS-required). Code: `src/lib/fhir/crypto.ts`, `src/app/api/fhir/authorize/route.ts`, `src/app/api/fhir/callback/route.ts` |
| **A2** | Medicare.gov connectivity — notify beneficiaries of communications | PARTIAL | `MEDICARE_NOTIFICATIONS_SKILL` detects EOB/coverage changes from FHIR data. `hasRecentChanges` trigger wired. Still need: direct Medicare.gov notification bridge API. Code: `src/lib/skills/medicare-notifications.ts` |
| **A3** | CMS review participation — disclose data sources, terms, security checklist | PARTIAL | `/api/cms-metadata` exposes app metadata for CMS directory. Still need: terms doc, security self-assessment submission. Code: `src/app/api/cms-metadata/route.ts` |
| **A4** | Trial access for Medicare patients if app charges a fee | DONE | 14-day free trial via `/api/trial`. Trial status tracked in `subscriptions` table. Settings shows trial days remaining. Code: `src/app/api/trial/route.ts`, `src/hooks/useAuth.ts` (trialStatus/trialDaysRemaining) |
| **A5** | CMS discovery experience — listed on Medicare.gov | PARTIAL | `/api/cms-metadata` returns app listing metadata. Still need: CMS directory submission (screenshots, descriptions). Code: `src/app/api/cms-metadata/route.ts` |
| **A6** | HIPAA compliance when provided by covered entity or BA | ~~IN PROGRESS~~ DONE | Audit logging + consent management done. ~~Need: BAA with Supabase/Vercel, HIPAA compliance documentation, breach notification plan~~ AWS BAA executed 2026-02-25 (covers RDS, ECS, Bedrock, Cognito, SES); Supabase + Vercel removed |

---

## Conversational AI -- Category Criteria

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Personalized AI support across clinical record — symptom checking, care planning, coordination, chronic disease | DONE | Core product. Coverage guidance + denial handling + lab results (A1C/glucose/BMI) + diabetes diagnoses + medications + classification all flow to AI context. Code: `src/lib/claude.ts`, `src/lib/fhir/context.ts` (`buildHealthContextForPrompt()`), `src/lib/skills-loader.ts` |
| Connect to CMS Aligned Network directly OR via PHR app | DONE | Blue Button 2.0 (PHR path) with PKCE OAuth, encrypted tokens, audit logging. 6 FHIR resource types: Patient, Coverage, EOB, Observation, Condition, MedicationRequest. Code: `src/lib/fhir/sync.ts` (`syncHealthData()`), `src/lib/fhir/client.ts` |
| Responses clearly indicate AI-generated + disclaimers when not replacing clinical judgment | DONE | SparkleIcon + "AI-generated . Not medical advice" on every assistant message. Code: `src/components/chat/Message.tsx` |
| Distinguish educational content from clinical guidance; guide to health professional when needed | DONE | Coverage guidance framing throughout. Skills consistently pattern: "ask your doctor to document...", "consult specialist", "bring this checklist to your appointment". Code: `src/lib/skills-loader.ts`, all skill files in `src/skills/` |

---

## Diabetes & Obesity -- Category Criteria

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Connect to CMS Aligned Network directly or via PHR app | DONE | Blue Button 2.0 (PHR path). Health data flows to chat via `DIABETES_PREVENTION_SKILL`. FHIR pipeline: Observation + Condition + MedicationRequest. Code: `src/lib/fhir/sync.ts`, `src/lib/fhir/transforms.ts` |
| Use clinical record for personalized coaching, reminders, risk alerts | DONE | `DIABETES_PREVENTION_SKILL` with classification-based coaching (diabetic/pre-diabetic/at-risk). Lab trend awareness (A1C up/down/stable). Screening reminders (>6mo/>12mo since last A1C). Risk alerts (A1C >= 9.0, diagnosis without meds). Diabetes page: personalized status with A1C range bar, diagnoses, medications, context-aware quick actions. Code: `src/lib/skills/diabetes-prevention.ts`, `src/app/app/diabetes/page.tsx`, `src/components/diabetes/` (A1CTrendChart, ScreeningReminders, RiskAlerts) |
| Support both prevention AND active management (meds, lab trends, nutrition/activity) | DONE | **Prevention**: MDPP eligibility guidance, CDC pre-diabetes risk test, lifestyle coaching prompts. **Management**: medication coaching (insulin $35/month cap, Part D coverage), lab trend tracking (A1C up/down/stable via `diabetes_snapshots`), MNT referral suggestions, DSMT coverage. Health page shows labs + conditions + medications. QuickLog for daily glucose/activity/meal/note entries. Code: `src/components/health/` (LabResultsCard, ConditionsCard, MedicationsCard), `src/components/diabetes/QuickLog.tsx`, `src/hooks/useDiabetesLog.ts`, `src/hooks/useDiabetesSnapshots.ts` |
| Specifically provide resources for pre-Diabetic patients | DONE | `PreDiabetesRiskCard` (CDC 7-question risk test on diabetes page when not connected). MDPP section (eligibility criteria + enrollment CTA) shown for pre-diabetic/at-risk. `DIABETES_PREVENTION_SKILL` has dedicated pre-diabetic coaching section. Code: `src/components/health/PreDiabetesRiskCard.tsx`, `src/app/app/diabetes/page.tsx`, `src/lib/skills/diabetes-prevention.ts` |
| HIPAA compliance | IN PROGRESS | Same as A6 — audit logging + consent management done. Need BAA + compliance docs |

---

## Framework Section I: Patient Access & Empowerment

| Criterion | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| **1** | Universal Data Access — patients access health info via apps of their choice | DONE | Blue Button 2.0 with PKCE OAuth. Future: CMS Aligned Network connectivity |
| **2** | Claims & Benefits — access claims, EOBs, prior auths, clinical data from payers | DONE | Health page: PatientCard, CoverageCards, ClaimsList + ClaimDetail. FHIR data from `/api/fhir/data`. Code: `src/hooks/useHealthData.ts`, `src/app/app/health/page.tsx` |
| **3** | Simplified Identity — IAL2/AAL2 credentials, no extra logins | DONE | Blue Button OAuth = IAL2/AAL2 via Medicare.gov (no extra login). TOTP opt-in for extra security |
| **4** | Audit Log Transparency — accounting of all data access | DONE | `audit_logs` table + `logAudit()` on 7+ API routes (FHIR, appeals, consent, account, checkout, trial). Code: `src/lib/audit.ts` |
| **5** | Consent Preferences — patient consent shared with all parties | DONE | `consent_preferences` table + Settings UI toggles + enforcement in FHIR context pipeline. Code: `src/hooks/useConsent.ts`, `src/app/api/consent/route.ts`, `src/lib/fhir/context.ts` |

---

## Framework Section V: Identity, Security & Trust

| Criterion | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| **22** | Request Purpose — all queries include purpose code | DONE | `X-Request-Purpose` header on FHIR calls, derived from skill triggers (appeal/coverage-determination/patient-request). Code: `src/lib/fhir/client.ts` |
| **23** | Digital Credentials — accept IAL2/AAL2 via CMS-approved service | DONE | Blue Button OAuth provides IAL2/AAL2 via Medicare.gov. TOTP opt-in for additional security |
| **24** | Access Control — enforce access control + consent per context | DONE | Consent preferences gate health data injection. FHIR authorize checks TOTP enrollment. Code: `src/lib/fhir/context.ts`, `src/app/api/fhir/authorize/route.ts` |
| **25** | Audit Records — verifiable logs for all auth requests/responses | DONE | `audit_logs` table with action, resource, IP, user agent, metadata. Code: `src/lib/audit.ts` |
| **26** | Security Validation — HITRUST certification or CMS-approved equivalent | REQUIRED | Org-level process, not code |

---

## Framework Sections II-IV (Reference)

| Section | Focus | Key Deadlines |
|---------|-------|--------------|
| **II — Provider Access** | Provider delegation, quality gap queries, 60-day claims encounter access | -- |
| **III — Data Standards** | USCDI v3, FHIR APIs (US Core IG), LOINC/RxNorm/SNOMED, FHIR subscriptions | **July 4, 2026**: FHIR API mandate |
| **IV — Network Connectivity** | CMS National Provider Directory, inter-network queries, metrics reporting | -- |

---

## Compliance Status Summary

### All Code-Level Items Complete

| Item | CMS Ref | Code Location |
|------|---------|---------------|
| Blue Button IAL2/AAL2 (PKCE) | A1, Criteria 3, 23 | `src/lib/fhir/crypto.ts`, `src/app/api/fhir/authorize/route.ts`, `src/app/api/fhir/callback/route.ts` |
| Audit logging | Criteria 4, 25 | `src/lib/audit.ts`, 7+ API routes |
| Consent preferences | Criterion 5 | `src/hooks/useConsent.ts`, `src/app/api/consent/route.ts` |
| TOTP MFA (opt-in) | Defense-in-depth | `src/components/auth/TOTPEnrollModal.tsx`, `src/components/auth/TOTPChallengeModal.tsx` |
| 14-day free trial | A4 | `src/app/api/trial/route.ts` |
| Daily chat rate limiting | -- | `check_and_increment_chat` RPC, `src/app/api/chat/route.ts` |
| CMS metadata API | A3, A5 | `src/app/api/cms-metadata/route.ts` |
| Request purpose tagging | Criterion 22 | `src/lib/fhir/client.ts` |
| Consent enforcement | Criterion 24 | `src/lib/fhir/context.ts` |
| AI-generated disclaimers | Conv. AI criteria | `src/components/chat/Message.tsx` |
| CMS pledges | Conv. AI + Diabetes | `src/components/ui/CmsPledge.tsx` |
| Medicare notifications skill | A2 (partial) | `src/lib/skills/medicare-notifications.ts` |
| Diabetes prevention skill | Diabetes criteria | `src/lib/skills/diabetes-prevention.ts` |
| Health professional guidance | Conv. AI criteria | Skills in `src/skills/`, `src/lib/skills/` |
| FHIR Observation pipeline | Diabetes criteria | `src/lib/fhir/transforms.ts` (`extractDiabetesLabs()`) |
| FHIR Condition pipeline | Diabetes criteria | `src/lib/fhir/transforms.ts` (`extractDiabetesConditions()`) |
| FHIR Medication pipeline | Diabetes criteria | `src/lib/fhir/transforms.ts` (`extractDiabetesMedications()`) |
| Diabetes classification | Diabetes criteria | `src/lib/fhir/transforms.ts` (`classifyDiabetesStatus()`) |
| Chat + health data bridge | Diabetes + Conv. AI | `src/hooks/useChat.ts`, `src/hooks/useHealthData.ts` |
| Personalized diabetes page | Diabetes criteria | `src/app/app/diabetes/page.tsx`, `src/components/diabetes/` |
| PreDiabetesRiskCard (CDC test) | Diabetes criteria | `src/components/health/PreDiabetesRiskCard.tsx` |
| Longitudinal lab storage | Diabetes criteria | `diabetes_snapshots` table, `src/hooks/useDiabetesSnapshots.ts` |
| Nutrition/activity tracking | Diabetes criteria | `diabetes_log` table, `src/components/diabetes/QuickLog.tsx` |
| Screening reminders | Diabetes criteria | `src/components/diabetes/ScreeningReminders.tsx` |
| Risk alerts | Diabetes criteria | `src/components/diabetes/RiskAlerts.tsx` |
| Diabetes consent flow | Data privacy | `src/components/health/DiabetesConsentCard.tsx` |
| AI diabetes insights | Diabetes criteria | `src/lib/diabetes-insights.ts`, `src/app/api/diabetes/insights/route.ts` |
| Chat lab trend context | Diabetes + Conv. AI | `src/lib/fhir/context.ts` (`buildHealthContextForPrompt()`) |

---

## Remaining Gaps

### P0 — Process (Not Code)

| Gap | CMS Ref | Type | Notes |
|-----|---------|------|-------|
| ~~HIPAA compliance~~ Closed | A6 | Process | ~~BAAs with Supabase/Vercel, compliance docs, breach notification plan~~ AWS BAA executed 2026-02-25 (covers RDS, ECS, Bedrock, Cognito, SES); Supabase + Vercel removed |
| HITRUST certification | Criterion 26 | Process | Org-level security certification |
| Terms of service + security checklist | A3 | Docs | Required for CMS review participation |

### P1 — Code + Docs

| Gap | CMS Ref | Type | Notes |
|-----|---------|------|-------|
| Medicare.gov notification bridge | A2 | Code + API | Direct integration with Medicare.gov communication system (beyond FHIR change detection) |
| CMS credential service integration | A1 | Code | Connect to CMS-approved identity service when available |
| CMS review submission | A3 | Docs | Data source inventory, security self-assessment |
| CMS app directory submission | A5 | Docs | Screenshots, descriptions for Medicare.gov listing |
| Patient-facing audit log viewer | Criterion 4 | Code | Let users see who accessed their data (Settings Activity Log) |

### P2 — Future

| Gap | CMS Ref | Type | Notes |
|-----|---------|------|-------|
| AAL2 app auth (if CMS tightens) | A1, Criteria 3, 23 | Code | email+password + TOTP. Components ready; only needed if CMS requires app-level AAL2 beyond Blue Button |
| EOB detail enrichment | Criterion 2 | Code | CARC/RARC extraction from FHIR EOB adjudication items |
| FHIR USCDI v3 compliance | Criterion 13 | Code | Verify Blue Button data maps to USCDI v3 by July 2026 |

---

## Key Dates

| Date | Milestone |
|------|-----------|
| **Q1 2026** | CMS early adopter showcase target |
| **July 4, 2026** | FHIR API mandate (Criteria 13-16) |
