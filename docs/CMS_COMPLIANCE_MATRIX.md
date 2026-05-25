# CMS Compliance Matrix

Denali.health participates as a **Patient-Facing App** under two CMS early adopter categories:

1. **Conversational AI Assistants** -- Ask Denali (chat)
2. **Diabetes & Obesity Prevention** -- Diabetes Care feature

Key dates:
- **Q1 2026**: CMS early adopter showcase target
- **July 4, 2026**: FHIR API mandate (Criteria 13-16)

> **Update — May 24, 2026:** Vercel and Supabase are no longer in use. All infrastructure (staging and production) now runs on AWS exclusively (ECS Fargate, RDS Postgres, Cognito, Bedrock, SES; AWS BAA executed 2026-02-25). Row-Level Security has been replaced by explicit `WHERE user_id = $1` clauses in application code. Strikethroughs below preserve the original text as historical record.

---

## Overall App Criteria (A1-A6)

All patient-facing apps must meet the full list of criteria to qualify.

| # | Requirement | Status | Evidence | Gaps |
|---|-------------|--------|----------|------|
| **A1** | IAL2/AAL2 identity verification via intermediary PHR app or CMS-approved service | **MET** | Blue Button OAuth via Medicare.gov provides IAL2/AAL2 through the intermediary PHR path. PKCE (S256) + AES-256-GCM encrypted token storage. TOTP MFA available as opt-in extra security in Settings > Security. | None. TOTP is opt-in, not CMS-required. |
| **A2** | Medicare.gov connectivity -- notify beneficiaries of communications (notices, EOBs, fraud alerts) | **PARTIAL** | `MEDICARE_NOTIFICATIONS_SKILL` detects EOB and coverage changes from FHIR data. `hasRecentChanges` trigger is wired. | No direct Medicare.gov notification bridge API integration. Relies on FHIR change detection only. |
| **A3** | CMS review participation -- disclose data sources, terms/agreements, security checklist | **PARTIAL** | `/api/cms-metadata` endpoint exposes app metadata for CMS directory. | Terms of service document and security self-assessment not yet completed. |
| **A4** | Trial access for Medicare patients if app charges a fee | **MET** | 30-day free trial via `/api/trial` (GET status, POST start). Trial status tracked in `subscriptions` table (`trial_start`, `trial_end`, `trial_converted`). Settings page shows trial days remaining. | None. |
| **A5** | CMS discovery experience -- allow app to be listed on Medicare.gov | **PARTIAL** | `/api/cms-metadata` returns app listing metadata (name, description, categories, data sources). | CMS submission with screenshots and descriptions not yet completed. |
| **A6** | HIPAA compliance when provided by a covered entity or business associate | ~~**IN PROGRESS**~~ **PARTIAL** | ~~Row-level security on all tables.~~ Explicit `WHERE user_id = $1` clauses on all queries (RDS has no RLS). AES-256-GCM token encryption. Audit logging on all sensitive operations. Consent management with enforcement. | ~~BAA with Supabase and Vercel pending.~~ AWS BAA executed 2026-02-25 (covers RDS, ECS, Bedrock, Cognito, SES); Supabase + Vercel removed. HITRUST certification needed. Breach notification plan needed. HIPAA compliance documentation incomplete. |

---

## Conversational AI -- Category-Specific Criteria

| # | Requirement | Status | Evidence | Gaps |
|---|-------------|--------|----------|------|
| **1** | Personalized AI support across clinical record -- symptom checking, care planning, coordination, chronic disease | **PARTIAL** | Coverage guidance, denial analysis, and lab data (A1C, glucose via `extractDiabetesLabs()`) flow to AI context. Skills system provides personalized coaching. | Full clinical record integration not yet complete. Lab trend analysis is contextual only (no charts). |
| **2** | Must connect to CMS Aligned Network directly or via PHR app | **MET** | Blue Button 2.0 (PHR path) with PKCE OAuth, encrypted tokens, audit logging. FHIR resources: Patient, Coverage, ExplanationOfBenefit, Observation. | Future: direct CMS Aligned Network connection. |
| **3** | Responses must clearly indicate AI-generated + disclaimers when not replacing clinical judgment | **MET** | SparkleIcon + "AI-generated . Not medical advice" displayed on every assistant message in chat. | None. |
| **4** | Clearly distinguish educational content from clinical guidance; guide to health professional when needed | **MET** | Coverage guidance framing throughout skills. Consistent "ask your doctor" and "consult specialist" patterns. Skills direct users to providers for clinical decisions. | None. |

---

## Diabetes & Obesity Prevention -- Category-Specific Criteria

| # | Requirement | Status | Evidence | Gaps |
|---|-------------|--------|----------|------|
| **1** | Must connect to CMS Aligned Network directly or via PHR app | **MET** | Blue Button 2.0 (PHR path). Health data flows to chat via `DIABETES_PREVENTION_SKILL`. Lab data (Observations) fetched and available. | None. |
| **2** | Use clinical record for personalized coaching, reminders, risk alerts | **PARTIAL** | `DIABETES_PREVENTION_SKILL` interprets A1C values + coaching prompts. `extractDiabetesLabs()` wired to fetch Observations (A1C LOINC 4548-4, glucose codes). Labs injected into AI context via `buildHealthContextForPrompt()`. | Lab trend charts not built for diabetes page. Personalized risk alert UI not implemented. |
| **3** | Support both prevention AND active management (meds, lab trends, nutrition/activity) | **PARTIAL** | A1C guide with 3 ranges (normal, pre-diabetic, diabetic). Medicare coverage reference table (6 items). MDPP references in skill prompts. | Nutrition and activity tracking features not built. Lab trend visualization missing. |
| **4** | Must specifically provide resources for pre-diabetic patients | **PARTIAL** | MDPP references exist in `DIABETES_PREVENTION_SKILL`. A1C guide includes pre-diabetic range (5.7-6.4%). | MDPP eligibility checker not built. MDPP enrollment flow not implemented. MDPP provider finder not built. |
| **5** | HIPAA compliance | ~~**IN PROGRESS**~~ **PARTIAL** | Same status as A6 above. ~~RLS~~ Explicit `WHERE user_id = $1` clauses, encryption, audit, consent all implemented. | ~~BAA~~ AWS BAA executed 2026-02-25; HITRUST, breach notification plan pending. |

---

## Framework Section I: Patient Access & Empowerment (Criteria 1-5)

Network-level criteria that affect how Denali interacts with CMS Aligned Networks.

| # | Criterion | Status | Evidence | Gaps |
|---|-----------|--------|----------|------|
| **1** | Universal Data Access -- patients access electronic medical info via apps of their choice | **MET** | Blue Button 2.0 with PKCE OAuth. Patient, Coverage, EOB, and Observation resources fetched and displayed. | Future: CMS Aligned Network connectivity beyond Blue Button. |
| **2** | Claims & Benefits -- access claims, EOBs, prior auths, clinical data from payers | **MET** | Health page displays patient info, coverage cards, claims list with detail view. EOB data from FHIR ExplanationOfBenefit resource. | EOB detail enrichment (CARC/RARC extraction from FHIR adjudication items) is P2. |
| **3** | Simplified Identity -- IAL2/AAL2 credentials, no extra logins | **MET** | Blue Button OAuth = IAL2/AAL2 via Medicare.gov (no extra login needed). TOTP MFA opt-in for additional security, never required. | None. |
| **4** | Audit Log Transparency -- accounting of all data access (who, when, why) | **MET** | `audit_logs` table with `logAudit()` calls on 7+ API routes (FHIR, appeals, consent, account deletion, checkout, trial). Logs include action, resource, IP, user agent, metadata. | Patient-facing audit log viewer not yet built (P1). |
| **5** | Consent Preferences -- patient consent preferences shared with all parties; honor restrictions | **MET** | `consent_preferences` table with Settings UI toggles (`health_data_ai`, `health_data_storage`, `analytics`). Versioned and audit-logged on change. Consent state enforced in FHIR context pipeline. | None. |

---

## Framework Section V: Identity, Security & Trust (Criteria 22-26)

| # | Criterion | Status | Evidence | Gaps |
|---|-----------|--------|----------|------|
| **22** | Request Purpose -- all queries include purpose code | **MET** | `X-Request-Purpose` header on FHIR calls. Purpose derived from skill triggers: `patient-request`, `appeal`, `coverage-determination`. | None. |
| **23** | Digital Credentials -- accept IAL2/AAL2 via CMS-approved service | **MET** | Blue Button OAuth provides IAL2/AAL2 via Medicare.gov. TOTP MFA opt-in for additional security. | CMS credential service integration when available (P1). |
| **24** | Access Control -- enforce access control + consent policy per context | **MET** | Consent preferences gate health data injection into AI prompts. FHIR authorize checks TOTP enrollment and requires AAL2 challenge if enrolled. ~~RLS on all tables.~~ Explicit `WHERE user_id = $1` clauses on all queries (RDS has no RLS). | None. |
| **25** | Audit Records -- verifiable logs for all auth requests/responses | **MET** | `audit_logs` table with action, resource, IP, user agent, metadata. Covers all auth-sensitive operations. | None. |
| **26** | Security Validation -- HITRUST certification or CMS-approved equivalent | **NOT MET** | No certification in place. | HITRUST certification is an org-level process. Required for full compliance. |

---

## Summary by Status

| Status | Count | Items |
|--------|-------|-------|
| **MET** | 15 | A1, A4, Conv AI 2-4, Diabetes 1, Criteria 1-5, Criteria 22-25 |
| **PARTIAL** | 6 | A2, A3, A5, Conv AI 1, Diabetes 2-4 |
| **IN PROGRESS** | 2 | A6, Diabetes 5 |
| **NOT MET** | 1 | Criterion 26 (HITRUST) |

---

## Priority Gaps

| Gap | CMS Ref | Priority | Type |
|-----|---------|----------|------|
| HIPAA compliance (BAAs, docs, breach plan) | A6, Diabetes 5 | P0 | Process |
| HITRUST certification | Criterion 26 | P0 | Process |
| Terms of service + security checklist | A3 | P0 | Documentation |
| Medicare.gov notification bridge API | A2 | P1 | Code + API |
| CMS credential service integration | A1 | P1 | Code |
| CMS review + app directory submissions | A3, A5 | P1 | Documentation |
| Patient-facing audit log viewer | Criterion 4 | P1 | Code |
| Lab trend charts on diabetes page | Diabetes 2-3 | P2 | Code |
| MDPP eligibility + enrollment flow | Diabetes 4 | P2 | Code |
| Nutrition/activity tracking | Diabetes 3 | P2 | Code |
| EOB detail enrichment (CARC/RARC from FHIR) | Criterion 2 | P2 | Code |
