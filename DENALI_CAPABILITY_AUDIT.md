# Denali Health — Capability Audit for HHS0017223 (Method F)

**Date:** 2026-05-05
**Audience:** Internal — for rural hospital CMIO/CFO conversations
**Method:** Read actual source code at `/Users/cvr/Documents/Project/Denali/app`. README claims and CLAUDE.md notes were not trusted; every rating below was verified in the source tree.

**Rating legend:**
- **WORKING** — end-to-end path exists and is wired up in production
- **PARTIAL** — primary path works, with material gaps for the hospital use case
- **STUBBED** — UI scaffold or schema column exists; no working backend
- **NOT BUILT** — no code found

---

## 1. Patient-Facing Capabilities

### 1.1 Voice-driven health questioning — **NOT BUILT**
- No `SpeechRecognition`, `webkitSpeechRecognition`, `getUserMedia`, `MediaRecorder`, ElevenLabs, or Whisper code in `src/`. Verified by grep.
- The only "voice" reference in the codebase is `users.voiceover_optimization` (an accessibility flag for screen-reader optimization) at `src/types/database.ts:1711`, and an equipment description string `"Blood glucose monitor with integrated voice synthesizer"` in `src/lib/medicare-codes-extended.ts:747`.
- Chat input is keyboard-only via `src/components/chat/ChatInput.tsx`.
- **Question domains the chat actually covers** (from `src/lib/skills-loader.ts` and `src/skills/`): Medicare coverage guidance for procedures (LCD/NCD lookup), denial code translation (CARC/RARC), appeal letter generation (Original Medicare and MA), EOB explanation, diabetes prevention coaching, obesity prevention coaching, screening reminders, prior auth checks, SAD list (Part B vs D drug routing). Not a generalist clinical chatbot.

### 1.2 Self-reported data capture — **PARTIAL**
- **Working:** glucose (with context: fasting / before meal / after meal / bedtime / other), activity (minutes + type), meal (free-text), generic note. Path: `src/app/api/diabetes/log/route.ts` → RDS `diabetes_log` table. UI: `src/components/diabetes/QuickLog.tsx`. Hook: `src/hooks/useDiabetesLog.ts`. Offline write queue: `src/lib/offline-sync.ts` → `public/sw.js` `SYNC_QUEUE`.
- **Missing for Method F:** weight (no log entry type — `extractPatientWeight()` in `src/lib/fhir/eob-clinical.ts` is a placeholder against EOB `supportingInfo:patientweight` which CMS does not populate), blood pressure, medication adherence (the structured field `daysSupply`/`gapDays` from PDE claims is read but not user-loggable), structured symptom diary, mood/PHQ-2.

### 1.3 Cross-condition analysis (pre-dia / dia / obesity) — **PARTIAL**
- Three skill files load **independently** based on triggers in `src/lib/skills-loader.ts`: `DIABETES_PREVENTION_SKILL` (`src/lib/skills/diabetes-prevention.ts`), `OBESITY_PREVENTION_SKILL` (`src/lib/skills/obesity-prevention.ts`), `HEALTH_RECORDS_SKILL` (`src/lib/skills/health-records.ts`).
- Triggers are boolean flags (`hasDiabetesContext`, `hasObesityContext`) — when both fire, both skill blocks are concatenated into the system prompt. Claude can synthesize across them at inference time, but **there is no deterministic code that combines diabetes + obesity into a single risk score, joint care plan, or unified longitudinal view**. No code path joins glucose + weight + medication adherence into a single dashboard tile.
- Pre-diabetes is detected via R73 ICD-10 codes and A1C 5.7–6.4 inference inside `diabetes-prevention.ts`; obesity detection in `obesity-prevention.ts` uses E66.* ICD-10 codes and BMI keyword matching. The two operate on the same EOB feed but do not cross-reference.

### 1.4 Daily engagement loops and notification delivery — **PARTIAL**
- **Working (single channel):** Daily SES email checklist via Lambda + EventBridge fires `POST /api/alerts/process` once per day at 08:00 CDT. Code: `src/app/api/alerts/process/route.ts`. Alert types from `src/config/alerts.ts`: `appeal_deadline`, `med_refill` (7-day refill gap), `new_denial`, `data_refresh` (30-day Blue Button stale).
- **Plan-gated:** `unlimited` gets all 4 alerts; `plus` gets 2; `trial`/`starter` get 0. Max 3 alerts per user per day.
- **Missing:** No web push (`pushManager.subscribe`, `applicationServerKey`, VAPID — none in `src/` or `public/sw.js`). No SMS. No in-app notification center. No daily check-in prompt ("Did you log your glucose today?"). No A1C-screening reminder cadence. The "engagement loop" is single-channel email, sent only when an alert fires.

### 1.5 Educational content — **STUBBED**
- Schema and infrastructure exist: `blog_posts` table, public route at `src/app/blog/`, components `BlogGrid` / `BlogCard` / `BlogArticle`, topic-personalization logic (`getPersonalizedBlogPosts()` in `src/lib/cms.ts`).
- **No seed data:** No SQL migration that inserts blog rows. `blog_posts` table schema supports content, but I found no script that populates it. The route renders an empty grid against the live DB unless content was added through some out-of-band path.
- Direction implied by schema (`category` enum, `denial codes / coverage / appeals / prior auth`) is Medicare-literacy, **not clinical patient education** (no diabetes self-management, carb counting, exercise progression, etc.).

### 1.6 Multi-language support — **NOT BUILT**
- Zero i18n infrastructure. No `next-intl`, `react-i18next`, locale files, translation keys, language toggle. All UI strings are hardcoded English in the JSX. Adding Spanish (which is the realistic ask for rural Texas) would require an i18n library setup plus a full translation pass on every component file.

---

## 2. Clinician / Care-Team Capabilities

This section is the one that determines whether a hospital believes Denali can support **active remote monitoring**. The honest answer is: **today, it cannot.** What exists is a counselor-facing case-tracking surface, not a clinician monitoring platform.

### 2.1 Clinician dashboard with patient panel — **PARTIAL**
- A dashboard exists at `src/app/app/dashboard/page.tsx`. Role check at line ~48: `if (role !== "counselor" && role !== "provider") redirect("/app")`.
- It shows the **counselor's own cases only**, scoped by `WHERE counselor_id = $userId` against the `counselor_cases` table. Columns: case reference, denial code, procedure description, status, outcome, date.
- Component: `src/components/dashboard/CaseList.tsx`. Stats: open / filed-this-month / outcomes-reported / avg resolution days.
- **What's missing for Method F:** There is no patient-level view. There is no list of *patients* with vitals, last-check-in, A1C trend, glucose log compliance, or risk score. The "panel" is a list of denial-appeal cases, not a remote-monitoring panel.

### 2.2 Alert and escalation rules — **STUBBED for clinical, WORKING for billing**
- Alerts in `src/config/alerts.ts` are **patient-facing only** — they email the patient about Medicare administrative events (refill gaps, appeal deadlines, new denials, stale data).
- **No clinician-side escalation.** There is no rule engine that says "A1C ≥ 12 → page provider," "missed glucose log for 3 days → notify care team," "post-discharge no follow-up in 14 days → flag." None of these exist in code.
- Severity color-coding (red/amber/green) on `src/components/health/DiagnosisSummaryCard.tsx` is purely visual on the patient side.

### 2.3 Care team ↔ patient messaging — **NOT BUILT**
- Searched: `provider-message`, `secure-message`, `clinician-message`, `care-team`. No code found.
- `/api/chat` is patient ↔ Claude. There is no human-clinician inbox, no message thread between counselor and patient, no PHI-safe messaging surface.
- `src/skills/channel/provider.ts` is a **prompt template** that adjusts Claude's tone when a clinician chats with Claude — not a messaging channel between two humans.

### 2.4 Multi-patient triage view — **NOT BUILT**
- The case list at `src/components/dashboard/CaseList.tsx` is a row-per-case table. There is no patient-roster view, no urgency sort, no clinical-severity coloring driven by clinical data, no patient-contact info, no last-seen timestamp at the patient level. Columns are billing-flow status (open/filed/reported/closed), not clinical status.

### 2.5 Role-based access control — **MINIMAL**
- `users.role` is a free-string column. Two values are recognized in code: `"counselor"`, `"provider"`. Plus `users.is_admin` boolean.
- There is **no organization or hospital scoping**. There are no `hospital_id`, `team_id`, `supervisor_id`, or `organization_id` foreign keys on `users` (verified against `src/types/database.ts`). `users.organization` and `users.counselor_state` exist as denormalized strings, but no code enforces org-scoped data isolation. A counselor can only see their own cases via `counselor_id = userId` — there is no team or hospital boundary to enforce above that.
- **Missing for hospital deployment:** Any concept of "Hospital A's care team can see Hospital A's patients only." That has to be built.

### 2.6 Audit trail of clinician actions — **PARTIAL**
- `src/lib/audit.ts` defines ~22 audit action types: `FHIR_CONNECT`, `FHIR_DISCONNECT`, `FHIR_DATA_ACCESS`, `APPEAL_GENERATED`, `APPEAL_OUTCOME`, `CONSENT_UPDATED`, `ACCOUNT_DELETED`, `LOGIN`, `LOGOUT`, `CHECKOUT_STARTED`, `TRIAL_STARTED`, `DIABETES_INSIGHT_GENERATED`, `DIABETES_LOG_ENTRY`, `SETTINGS_CHANGED`, `PREFERENCES_UPDATED`, `POLICY_CHANGE_EMAIL`, `HEALTH_REPORT_GENERATED`, `IDME_VERIFY`, `ALERT_BATCH_PROCESSED`, `REPORT_SHARED_ACCESS`, `REPORT_EMAILED`.
- Storage is append-only — `scripts/migrate-audit-logs-baseline.sql` REVOKEs UPDATE/DELETE/TRUNCATE on `audit_logs` from `denali_admin` and grants only INSERT/SELECT. ✓ HIPAA-compliant.
- **Missing:** No clinician-specific actions (`CASE_VIEWED_PATIENT`, `CLINICIAN_LOGIN`, `OUTCOME_REPORTED`, `MESSAGE_SENT_TO_PATIENT`). Until clinician workflows exist, there is nothing clinician-specific to log.

---

## 3. Integration Readiness

### 3.1 FHIR R4 resources actually implemented
| Resource | Status | Implementation |
|---|---|---|
| Patient | **WORKING** (PII-stripped) | `transformPatient()` in `src/lib/fhir/transforms.ts` extracts age + gender ONLY. Name, DOB, Medicare ID, address are intentionally discarded per Privacy §2. |
| Coverage | **WORKING** | `transformCoverage()`. Detects Part A/B/C/D, plan name, status. |
| ExplanationOfBenefit | **WORKING** | `transformEOB()` + 8 extractors in `src/lib/fhir/eob-clinical.ts` (conditions, medications, screenings, providers, hospitalizations, DME, weight placeholder, hospice status). |
| Observation | **NOT BUILT** | Blue Button does not expose Observation resources. No A1C/BP/glucose values are retrievable — only the *fact that a lab was performed* (CPT code on EOB). |
| Condition | **NOT BUILT** | Inferred from EOB ICD-10 only. No FHIR Condition resource fetched. |
| MedicationRequest | **NOT BUILT** | Inferred from EOB Part D items only. No prescriber, dose, or route. |
| AllergyIntolerance, CarePlan, Goal, DiagnosticReport, ImagingStudy, etc. | **NOT BUILT** | None implemented. |

### 3.2 Epic FHIR connectivity — **NOT BUILT**
- Searched for `epic`, `Epic`, `MyChart`, `fhir.epic.com`. No code found. No Epic OAuth client. No app registered in Epic on FHIR. **Hospital deployment will require Epic integration to be built from zero** if the partner is on Epic (likely for any rural Texas hospital that took the EHR Incentive money).

### 3.3 Cerner / Oracle Health — **NOT BUILT**
- Searched `cerner`, `oracle`, `oracle-health`. No code found.

### 3.4 Apple HealthKit — **NOT BUILT**
- Searched `HealthKit`, `HKQuantityType`, `apple-health`. No code found. The app is a PWA with no Capacitor wrapper; HealthKit access requires a native iOS app.

### 3.5 Google Health Connect — **NOT BUILT**
- Searched `HealthConnect`, `health-connect`. No code found. Same constraint — would require Capacitor + Android plugin.

### 3.6 SMART on FHIR launch support — **NOT BUILT**
- Searched `smart-launch`, `smart-on-fhir`, `.well-known/smart-configuration`, `launch-context`, `ehr-launch`, `standalone-launch`. No code found. Denali has not been built as a SMART app.

### 3.7 Synthetic FHIR data pipeline — **PARTIAL**
- Staging environment is wired to `sandbox.bluebutton.cms.gov` with sandbox-issued credentials (`config/api.ts`, `BLUEBUTTON_BASE_URL`). CMS provides synthetic beneficiaries (BBUser00000…) for sandbox testing.
- **No Synthea / synthetic data ingestion of our own.** No way to load a custom test patient outside the CMS sandbox set.

### 3.8 Blue Button OAuth — **WORKING**
- PKCE S256 authorize: `src/app/api/fhir/authorize/route.ts`. Sets `state` and `code_verifier` in 10-min httpOnly cookies.
- Callback + token exchange + AES-256-GCM token encryption: `src/app/api/fhir/callback/route.ts`.
- 24h cached data fetch: `src/app/api/fhir/data/route.ts`.
- Disconnect (deletes `ehr_connections` + `fhir_cache`): `src/app/api/fhir/disconnect/route.ts`.
- Scopes: `patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read profile openid`.
- Production credentials rotated 2026-05-01 into `denali/prod/app` Secrets Manager.

---

## 4. Security & Compliance

### P0 findings: NONE.
No PHI is logged to CloudWatch beyond redacted metadata (`audit.ts` writes action + resource type + minimal context, never message bodies). No PHI is sent to non-AWS services in core flows. IndexedDB writes are consent-gated by the `health_data_storage` toggle. Stripe metadata contains no PHI. Telemetry is CloudWatch-only — no Sentry, Datadog, PostHog, Amplitude, Segment, or Mixpanel imports.

### 4.1 AWS Bedrock & AWS services — **WORKING**
- `src/lib/claude.ts` lines ~78–86: if `ANTHROPIC_API_KEY` is unset (which it is in the prod ECS task secrets), the SDK swaps to `AnthropicBedrock` with IAM auth. This is verifiable in code, not just claimed.
- Models invoked from `denali/prod/app` secrets:
  - Chat: `arn:aws:bedrock:us-east-1:236823123138:inference-profile/global.anthropic.claude-sonnet-4-6`
  - Appeals: `arn:aws:bedrock:us-east-1:236823123138:inference-profile/global.anthropic.claude-opus-4-6-v1`
- AWS services with active code paths: **RDS** (`pg` driver in `src/lib/db.ts`), **Cognito** (`@aws-sdk/client-cognito-identity-provider` in auth routes), **SES** (`@aws-sdk/client-sesv2`), **CloudWatch** (`@aws-sdk/client-cloudwatch` for custom metrics), **Bedrock** (`@anthropic-ai/bedrock-sdk`), **Secrets Manager** (loaded by `db.ts`), **ECS Fargate** (deployment platform).

### 4.2 BAA scope — **WORKING**
- AWS BAA executed 2026-02-25 covers: RDS, ECS, Bedrock, Cognito, SES.
- Verified by grep that no third-party SDK that could receive PHI is imported. Stripe is in scope but receives no PHI (no claim/diagnosis fields cross the Stripe boundary in `src/lib/stripe-fulfillment.ts`).
- Public government APIs called by tools (`src/lib/tools/index.ts`) — NPI Registry, ICD-10 NLM, CMS coverage finder — receive only generic search terms, never patient identifiers.

### 4.3 Encryption — **WORKING**
- **At rest (FHIR tokens):** AES-256-GCM with randomized 12-byte IV and 16-byte auth tag. `src/lib/fhir/crypto.ts`. Key sourced from Secrets Manager via `FHIR_TOKEN_ENCRYPTION_KEY`.
- **At rest (RDS):** AWS-default RDS encryption (KMS). Not visible in repo — set at infrastructure layer; AWS BAA requires this.
- **In transit (RDS):** SSL enforced in prod with CA bundle at `certs/rds-global-bundle.pem`, `rejectUnauthorized: true`. `src/lib/db.ts:38–42`.
- **In transit (everything else):** TLS via ALB / API Gateway. No plaintext HTTP listeners.

### 4.4 Audit logging — **WORKING**
- `src/lib/audit.ts` writes to RDS `audit_logs` table via `query()`. Append-only enforced by SQL (`scripts/migrate-audit-logs-baseline.sql`): `REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM denali_admin; GRANT INSERT, SELECT…`.
- Dedup window of 5 min on `FHIR_DATA_ACCESS` to prevent log flooding.
- Captures: action, user_id, resource_type, resource_id, IP, user-agent, timestamp, metadata JSON. **Does not capture message content.**

### 4.5 PHI handling — **WORKING**
- Logs in `claude.ts` and `chat/route.ts` were grepped: only token counts, durations, and tool names are logged, never message content.
- IndexedDB stores in `src/lib/offline-cache.ts` are gated by the `health_data_storage` consent toggle (default OFF). 24h TTL on health/conversation stores; 4h on profile.
- localStorage is only used for theme preference.
- Stripe metadata contains email and plan only — no clinical data.

### 4.6 User consent flows — **WORKING**
- Three toggles default OFF, defined in `consent_preferences` table: `health_data_ai`, `health_data_storage`, `analytics`.
- Hook: `src/hooks/useConsent.ts`. API: `src/app/api/consent/route.ts` (audit-logged via `CONSENT_UPDATED`).
- Server-side enforcement: `src/lib/fhir/context.ts:19` — `if (sessionState.consentHealthDataAi !== true) return null;` — strict allow-list (null/undefined fails closed).
- Client-side enforcement: `src/app/app/chat/page.tsx` strips health fields before each send; `src/hooks/useChat.ts` overlays latest consent on every API call (supports mid-session toggle).
- Versioning column exists; consent updates are audit-logged.

### 4.7 SOC 2 / HITRUST — **NOT BUILT**
- No SOC 2 attestation. No HITRUST certification. AWS provides SOC 2 / HIPAA-eligible infrastructure for the underlying services, but Denali as an application has no third-party audit. CMS readiness doc lists HITRUST as P0 unfinished.

---

## 5. Mobile

### 5.1 PWA installability — **WORKING**
- `public/manifest.json`: name "Denali Health", short_name "Denali", display "standalone", start_url "/app", maskable 192/512 icons, 3 shortcut entries, categories `["health", "medical", "utilities"]`.
- Service worker registers from `src/app/layout.tsx` via inlined `navigator.serviceWorker.register('/sw.js')`.
- Cache version v3 in `public/sw.js`. 4 strategies: network-only (chat/auth/webhooks), network-first with cache fallback (data APIs), cache-first (static), offline page fallback.

### 5.2 iOS push notifications — **NOT BUILT**
- iOS 16.4+ supports Web Push for installed PWAs. Denali has no push code (`pushManager.subscribe`, VAPID, `applicationServerKey` — all absent). No `push` event handler in `public/sw.js`. No `/api/push/subscribe` route.

### 5.3 Android push — **NOT BUILT**
- Same code path as iOS Web Push. Not implemented.

### 5.4 Native app status — **NONE**
- No `capacitor.config.ts`, no `ios/`, no `android/`, no React Native / Expo / EAS configuration. Pure Next.js PWA.

### 5.5 Capacitor wrapper effort to TestFlight + Play Store internal track
- **Estimate: 1 engineer, 4–6 weeks of work + 2–4 weeks wall-clock for review queues.**
- Work items:
  1. `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`; `npx cap init`; `npx cap add ios android`. (1 day)
  2. Static export shim or Next.js standalone build embedded in WebView. Cookie behavior in WKWebView/WebView for Cognito sessions has known quirks — needs testing. (4–6 days)
  3. OAuth deep-link handling: register custom URL scheme (`denali://auth-callback`, `denali://fhir-callback`) for Blue Button and any future SMART launches. (2–3 days)
  4. Apple Developer Program enrollment ($99/yr) + Google Play Console ($25 one-time). Cert generation, App Store Connect setup. (3–5 days, includes paperwork wait)
  5. App Privacy nutrition labels (App Store Connect) and Data Safety form (Play Console) — important for HIPAA-adjacent claims. (2 days)
  6. CapacitorPushNotifications plugin (APNs + FCM) only if push is added. Not required for first submission. (5–7 days if pursued)
  7. Apple review (~3 days median, can be 1–2 weeks if rejected for medical-content compliance); Google review (~3–7 days for first submission).
- Risks: HIPAA disclosures + medical claims may attract App Review scrutiny — mitigated by existing `/hipaa`, `/privacy`, `/terms` pages.

---

## 6. Deployment & Operations

### 6.1 Production environment — **WORKING**
- ECS Fargate cluster `denali`, service `denali-web`. ALB → https://denali.health.
- RDS PostgreSQL 16.9 instance `denali-prod.ca5m0qc8e5h8.us-east-1.rds.amazonaws.com`.
- Staging cluster split 2026-04-23 (separate ECR + IAM + RDS).
- Cost-optimization scheduler shuts down service nightly 23:00–08:00 CDT (Lambda-driven `denali-shutdown` / `denali-startup`). **This will block 24/7 patient monitoring claims** until removed.

### 6.2 Live user count — **NOT DERIVABLE FROM CODE**
- No analytics dashboard or aggregation view ships in the repo. `audit_logs` is append-only and `users` table has no MAU export. We have not run the production query for this audit. State the count honestly to hospital partners as "early access; in pilot prep" until a real count is published.

### 6.3 CI/CD — **PARTIAL**
- Single deploy workflow at `.github/workflows/deploy.yml`. Trigger: push to `main` + manual dispatch. Steps: Docker build → ECR push (SHA + `latest` + `prod-stable` after stability) → ECS deploy with `wait-for-service-stability: 15min`. SHA-pinned third-party actions. OIDC trust scoped to `refs/heads/main` only.
- **No PR-time test gate.** No Vitest run, no `tsc --noEmit`, no Playwright in CI. Tests exist in the repo (575 unit, 212 E2E per CLAUDE.md) but they don't run automatically. **This is a hospital-credibility risk.**

### 6.4 Observability — **PARTIAL**
- CloudWatch custom metrics in `Denali/App` namespace via `src/lib/metrics/cloudwatch.ts` (buffered, flush every 60s).
- Structured JSON logs (`_m` discriminator for Logs Insights queries).
- No Sentry / Datadog / OpenTelemetry / APM. No P99 latency tracking, no distributed tracing, no error grouping UI.
- 3 CloudWatch alarms feed SNS topic `denali-prod-alerts` → email `admin@denali.health` and `ramanac@gmail.com`: ECS running-below-desired, ALB 5xx > 5%, ECS task-failed-to-start.

### 6.5 On-call — **MINIMAL**
- "On-call" is a two-address email list (above). No PagerDuty, no escalation policy, no rotation, no SLA contract.
- Runbooks in `docs/runbooks/`: `ecr-eviction-recovery.md`, `rollback-artifacts/`. Limited operational coverage.

### 6.6 Known scaling constraints
- **RDS pool: 10 max connections** (`src/lib/db.ts:32–46`). With 60s Claude timeout per chat turn, this caps concurrent active chats around 10 before contention. Bedrock has its own request quotas at the AWS account level.
- External API rate limits in `config/rate-limits.ts`: NPI 60/min, PubMed 3/min (NCBI policy), CMS 30/min, Claude 50/min.
- Single-AZ deployment (us-east-1). No DR plan committed in code.

---

## 7. Gap Analysis for HHS0017223 Method F (Active Remote Monitoring)

Method F asks for **active** remote monitoring of high-acuity patients by a clinical team. Today Denali is a patient-facing Medicare-literacy + appeal app with diabetes self-logging. Closing the gap by 2026-09-30 is achievable but real.

### MUST BUILD — blocks credible deployment
1. **Clinician-facing patient roster.** A web view scoped to a hospital's patients showing: last check-in, glucose log compliance, last A1C date (from EOB), open alerts, appeal status, last contact. This does not exist. ETA: 4–6 weeks.
2. **Threshold-based clinical alerts that fire to the care team, not just the patient.** Rule engine for: A1C ≥ 9% (high) or ≥ 12% (urgent); 3+ days no glucose log; 7+ days medication refill gap; 30 days post-discharge with no follow-up CPT seen. Routing destination must be configurable (in-app inbox + email; SMS optional). ETA: 3–4 weeks once the roster exists.
3. **Hospital / organization scoping in RBAC.** Add `organization_id` to `users` and to `counselor_cases`; add an `organizations` table; gate every clinician query by org. Without this, you cannot honestly tell a hospital "your team sees only your patients." ETA: 2 weeks including data migration.
4. **Patient–clinician messaging surface.** PHI-safe message thread, audit-logged, retention policy. This can be in-app initially (no SMS). ETA: 3–4 weeks.
5. **Clinical action audit log types.** Add `CASE_VIEWED`, `MESSAGE_SENT_TO_PATIENT`, `ALERT_ACKNOWLEDGED`, `THRESHOLD_OVERRIDE`. Trivial once messaging exists. ETA: 1 week.
6. **Remove the nightly shutdown** for any clinician-monitoring tier, or document it as a non-monitoring window. Operationally easy; needs cost re-baseline.
7. **CI test gate on every PR.** `tsc --noEmit`, Vitest, smoke E2E. ETA: 2–3 days.

### SHOULD BUILD — materially strengthens the pitch
8. **Spanish UI.** Rural Texas Spanish-speaking patient share is non-trivial. Add `next-intl`, translate the patient surfaces (chat, diabetes log, alerts, settings, /hipaa, /privacy). Clinician surface can stay English. ETA: 3–4 weeks once the i18n harness is in.
9. **Web push notifications.** iOS 16.4+ and Android Chrome both support it for installed PWAs. Adds a daily-engagement channel that today is email-only. ETA: 1 week (VAPID + SW handler + opt-in UI).
10. **Self-reported weight + BP entry types.** Reuse the diabetes-log pattern. Two new entry types in `diabetes_log` (or rename to `health_log`). ETA: 1 week.
11. **Capacitor iOS/Android wrappers in TestFlight + Play internal track.** Improves home-screen install rate, unlocks future HealthKit / Health Connect integration. ETA: 4–6 weeks (per §5.5).
12. **Synthea-driven synthetic patient pipeline** for hospital demo + evaluation without exposing real PHI. ETA: 1–2 weeks.
13. **CMIO sandbox account** (a deterministic demo cohort wired up so a CMIO can sign in and see "her" patients with realistic data). ETA: 1 week after Synthea pipeline.
14. **Voice input on mobile** via Web Speech API (Chrome on Android works; Safari on iOS supports `webkitSpeechRecognition` in 14.5+). Adds accessibility for older patients. ETA: 1 week (input only — TTS optional).

### NICE TO HAVE — post-launch, partner-driven
15. **Epic FHIR integration** as a SMART on FHIR app — but only if the partner hospital is on Epic and willing to sponsor the App Orchard / Showroom listing. Big lift (8–12 weeks + Epic review).
16. **Apple HealthKit / Google Health Connect** glucose + weight ingestion (requires Capacitor wrappers from #11).
17. **SOC 2 Type I** kickoff — useful for procurement at larger hospital systems. 6–9 months elapsed time, modest engineering load.
18. **HITRUST e1** — multi-quarter, expensive; defer until a deal demands it.
19. **In-app care plan + goal tracking** (FHIR Goal/CarePlan resources), shared between patient and clinician.
20. **Multi-AZ RDS + DR runbook.** Cheap insurance once user count grows.

---

## 8. One-Page Hospital Summary

A version of this you can hand to a CMIO. Plain language. No marketing.

### Available today

- Patients can sign in and connect their Medicare account through Blue Button (CMS production access, BAA in place).
- The app pulls each patient's Medicare claims, prescriptions (Part D), procedures, and providers, and explains them in plain English.
- A patient can chat with the app to understand a denial, generate an appeal letter, or get coverage guidance for a specific procedure. The app cites the relevant CMS policy.
- Patients can log glucose, activity, and meals from a phone or tablet; data is stored encrypted at rest in AWS RDS and works offline.
- Three privacy toggles let the patient control whether their health data is shared with the AI, cached on their device, and counted in analytics. All default off.
- Daily email alerts fire on Medicare events: appeal-deadline approaching, prescription refill gap, new denial, stale data feed.
- Audit log of every PHI access is append-only and HIPAA-compliant.
- AWS Bedrock + RDS + Cognito + SES are all under our AWS BAA executed February 2026.
- App is a PWA — installs on iPhone and Android home screens, works on rural cellular.

### In active development for September 30, 2026

- Clinician-facing patient roster: each care-team member sees only their hospital's patients, with status, alerts, and last contact.
- Threshold-based clinical alerts that route to the care team — high A1C, missed check-ins, post-discharge no follow-up, refill gaps.
- Hospital and organization scoping across the database, so multi-tenant isolation is enforced.
- Patient ↔ clinician secure messaging inside the app, audit-logged.
- Clinical-action audit log types (case viewed, message sent, alert acknowledged).
- 24/7 production posture (today the service is paused overnight for cost optimization).
- Pull request CI gate: type-check, unit tests, smoke E2E run before any merge.
- Spanish UI for the patient surfaces.
- Self-reported weight and blood pressure log entries.
- Web push notifications for daily engagement on installed phones.

### Roadmap (post-launch, partner-driven)

- Capacitor iOS and Android wrappers in TestFlight and Google Play internal track.
- Apple HealthKit and Google Health Connect glucose + weight ingestion (requires the wrappers above).
- Epic SMART on FHIR integration — only if the partner hospital is on Epic and sponsors the Epic listing.
- Cerner / Oracle Health integration on the same SMART pattern.
- SOC 2 Type I attestation; HITRUST when a contract demands it.
- Multi-AZ RDS, documented disaster-recovery runbook.
- In-app care plan and goal tracking shared between patient and care team.

---

*End of audit.*
