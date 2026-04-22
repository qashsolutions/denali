# Denali Design Document v1.1

**Master reference for product scope, guardrails, safety, pipeline architecture, and sequencing**

*Version 1.2 — April 22, 2026*
*Status: Living document. Every Claude Code prompt after this references this doc.*
*Prior basis: CMS demo Q&A (Apr 15), discovery inventory (Apr 17), research memos A and B (Apr 17)*
*Related repo reference: also referenced in CLAUDE.md*

---

## Part 1 — North Star

**Product:** Denali is the personalized health intelligence engine for adults 55+ with metabolic disease.

**Positioning:** "Your health records live in dozens of places. Denali is where your coverage gets figured out, your care gaps get caught, your trajectory gets analyzed, and your denials get fought."

**The pipeline:** User-permissioned inputs → normalized longitudinal record → deterministic analysis + LLM reasoning → prognostic trajectories with confidence + caveats + clinician handoff.

**The bet:** Compounding longitudinal data per user, starting at 55, creates a defensible moat nobody else has when the user transitions to Medicare at 65.

**What we are not:** Not a general chatbot, not a diagnostic tool, not a telehealth service, not a mental health provider, not a general-purpose health app, not a symptom checker, not a pediatric or maternity tool.

---

## Part 2 — Target User

**Primary cohort:** Adults aged 55+ managing any of the conditions in Part 3.

**Age floor:** 55 at signup. Soft gate — informational messaging at onboarding, no hard ID verification.

**Medicare status:** Two signals work together —
1. `users.birth_year` (single integer, collected at signup, confirmable at intervals or contextual moments)
2. `users.is_on_medicare` (BOOLEAN, user-editable flag — lets a 63-year-old retiring early with Medicare flip it on; lets a 67-year-old without Medicare coverage turn it off)

Features that depend on Medicare-specific data or appeals gate on `is_on_medicare = true`, not on age alone.

**Out of scope:** Anyone under 55, children, pregnancy care, primary cancer management, COPD as primary condition, osteoporosis, arthritis/pain management, dementia as primary target, non-metabolic conditions.

---

## Part 3 — Condition Scope

### Current (shipped)
- Prediabetes
- Type 2 diabetes (primary) / Type 1 (secondary)
- Obesity (BMI ≥30)

### Next to add (wave 1)
- **Hypertension** — 70-80% prevalence in 65+; near-universal comorbidity; same infrastructure as current scope
- **Dyslipidemia / high cholesterol** — 60% prevalence in 65+; co-occurs with diabetes; same payers, same formularies

### Subsequent additions (wave 2)
- **Chronic kidney disease** — 40%+ of T2DM adults; requires KFRE calculator and CKD-specific LCDs
- **Cardiovascular disease (umbrella: MI, stroke, angina, heart failure)** — 32% prevalence in 65+ diabetics; requires ASCVD calculator and cardiology corpus
- **Depression screening** — 29.2% prevalence in diabetic adults; safety-critical; screening + referral only, not treatment

### Deferred (revisit later, not part of current plan)
Heart failure as primary focus, COPD, osteoporosis, arthritis, chronic pain, dementia, cancer.

### Activation mechanism
Each user has a `user_conditions` record listing active conditions (inferred from claims or self-reported). The AI's data-access scope, skill loading, analyzer eligibility, and card selection all read from this. Adding a condition = one skill file + one analyzer + one or more cards + activation of the condition flag.

---

## Part 4 — Pipeline Architecture

Four layers, each independently modifiable. Clean contracts between them.

### Layer 1 — Data Collection + Normalization

**Sources (all opt-in, individually revocable, consent-toggled):**

| Source | What it provides |
|---|---|
| CMS Blue Button 2.0 | Medicare claims, Part D, coverage, diagnoses, procedures |
| Commercial payer FHIR APIs | Same class for pre-65 users (CMS Interoperability Rule) |
| Apple Health / Google Health Connect | Wearables, user-logged readings, some clinical |
| EHR (Epic on FHIR, Cerner) | Labs, vitals, notes, meds |
| Lab-direct (Quest, LabCorp) | Lab results |
| Pharmacy pricing (GoodRx) | Live drug prices |
| User-captured (OCR, voice, manual) | Glucometer, BP, pills, documents |
| Denali proprietary | Appeal outcomes, care gap closures, user feedback |

**Canonical schema:** Single unified `HealthRecord` internal data model. Every entity carries provenance (source), confidence (0-1), timestamp captured, and raw source ID.

**Connector pattern:** Every source implements the same interface (`connect`, `disconnect`, `sync`, `getConnectionStatus`). Rewrap existing BB2.0 code as `CMSBlueButtonConnector`; add sources by writing new connectors.

### Layer 2 — Intelligence

**Deterministic analyzers:**
- `MedicationAdherenceAnalyzer`
- `A1CTrajectoryAnalyzer`
- `CareGapAnalyzer`
- `DenialPatternAnalyzer`
- `DrugCostOptimizerAnalyzer`
- `CVRiskCalculator` (ASCVD, UKPDS)
- `KidneyRiskCalculator` (KFRE)
- `HospitalReadmissionRisk` (LACE)

Each declares data dependencies, has `canRun()` guard for sparse users, outputs typed insight with confidence + provenance.

**LLM-augmented reasoners:**
- `CoverageReasoner` — combines LCDs + user claims
- `AppealLetterGenerator` — existing, enhanced with task budgets + precedent retrieval
- `LongitudinalWikiSynthesizer` — leverages 1M context to narrate user's full history
- `PreVisitBriefingGenerator` — structured summary for doctor visits
- `PredictionNarrator` — converts deterministic predictions to plain English

### Layer 3 — Presentation

**Card system:** Self-contained components with shared layout primitives (shadcn/ui + Tailwind), unified spacing/typography/accessibility (large touch targets for 55+), responsive breakpoints, and interaction patterns.

**Card registry + composer:** Adding a new card = register in `cardRegistry`, define `canRender(insight)` guard, done. Composer selects which cards to show per user per session based on data availability + insight confidence + priority.

**Card categories:** Trend, Gap, Risk, Cost, Action, Prediction.

### Layer 4 — User Agency

The user sees their profile. Can edit. Can correct. Can mark data as outdated. Their corrections feed back as signals. The profile is theirs; we organize it.

---

## Part 5 — Guardrails Architecture

Six-layer defense. v1 ships Layers 1, 2, 5. v2 adds Layers 3, 4, 6.

### Layer 1 — Input Classification (v1)

Every user message runs through a classifier before reaching Claude. Classifier produces one of:
- **In-scope** → proceed to LLM
- **Ambiguous** → proceed with caution prompt
- **Out-of-scope** → deterministic redirect
- **Safety-critical** → deterministic response (Layer 5)

Classification uses regex + keyword + light LLM classifier.

**Scope definition (verbatim):** "Medicare coverage questions, pre-Medicare health coverage questions, management of prediabetes/diabetes/obesity/hypertension/cholesterol (plus CKD/CVD when activated), medication coverage and cost, claim denials and appeals, care gaps and preventive services, and general education about these topics." Everything else is out-of-scope.

### Layer 2 — Prompt Construction (v1)

System prompts include explicit refusals, few-shot examples of correct scope adherence, and never include raw user content in positions that could override instructions. Existing `BASE_PROMPT` extended with explicit scope boundaries.

### Layer 3 — Tool-Use Guards (v2)

Every tool call checks: user permission, rate limit, scope match, admin-only flags. Rate limits extend to per-model, per-endpoint, per-IP.

### Layer 4 — Output Filters (v2)

Response validation before streaming to user: PHI of another user (leakage), medical advice crossing lines, hallucination markers (drugs/doses not in context), jailbreak success markers.

### Layer 5 — Safety Interrupts (v1)

12 triggers detailed in Part 6. Deterministic responses, not LLM-generated. Bypasses Claude entirely.

### Layer 6 — Audit + Anomaly Detection (v2)

Every LLM call logged (prompt, response, tools, latency, tokens). Anomaly detection flags abusive patterns.

### Runtime Agents (new class, distinct from dev-time agents)

| Agent | Role | Version |
|---|---|---|
| `scope-guard` | Enforces topical boundaries | v1 |
| `safety-trigger` | Detects crisis signals | v1 |
| `phi-leak-scanner` | Output-side PHI check | v2 |
| `prompt-injection-detector` | Input-side injection check | v2 |
| `rate-limit-anomaly` | Behavioral pattern detection | v2 |

---

## Part 6 — Safety Triggers (v1 ships all 12)

Design principles:
1. Deterministic responses, not LLM-generated
2. No diagnosis, no medical advice
3. Audit log fires (trigger name + user ID + timestamp); message content NOT logged
4. Fail open on false positives; never miss a real crisis

### The 12 triggers

**Trigger 1 — Suicidal ideation / self-harm intent**
Detects: direct statements of wanting to end life, plans to self-harm, references to means, hopelessness + plan.
Route: Bypass LLM.
Response: acknowledges concern, routes to 988 Suicide & Crisis Lifeline (call/text), Crisis Text Line (HOME to 741741), 911 for immediate danger. States the AI is not the right resource.

**Trigger 2 — Active cardiac/stroke emergency**
Detects: chest pain/pressure + sweating/nausea/SOB/arm-jaw pain (current); sudden one-sided weakness, facial droop, slurred speech, "worst headache of my life"; sudden severe SOB + leg swelling.
Route: Bypass LLM.
Response: routes to 911; instructs not to drive self; offers to help with Medicare questions after safety.

**Trigger 3 — Severe hypoglycemia / DKA**
Detects: low sugar + impairment symptoms; blood sugar <54 with active context; blood sugar >400 + fruity breath / extreme thirst-urination / vomiting; self-reported DKA; unconsciousness in diabetic context.
Route: Bypass LLM.
Response: hypoglycemia — 15g fast-acting carbs if swallowing safe, glucagon if available, 911 if unresolved. DKA — 911 immediately, hydration if possible, don't self-dose insulin without sick-day rules.

**Trigger 4 — Medication overdose**
Detects: "took too many," "overdosed," accidental double doses, too much insulin, "doubled up on" medication.
Route: Bypass LLM.
Response: Poison Control 1-800-222-1222; 911 if symptomatic.

**Trigger 5 — Anaphylaxis / severe allergic reaction**
Detects: can't breathe / throat closing / tongue swelling + allergy context; hives + breathing trouble; reaction getting worse; EpiPen used without improvement.
Route: Bypass LLM.
Response: 911 immediately; EpiPen into outer thigh if available; second dose in 5-15 min if needed; ER even after EpiPen.

**Trigger 6 — Pediatric context (<18)**
Detects: references indicating patient is a child ("my child," "he's 8," "my grandchild").
Route: Redirect, block medical specifics.
Response: Denali is for adults 55+; redirect to pediatrician; 911 for emergency.

**Trigger 7 — Pregnancy context**
Detects: "I'm pregnant," "she's pregnant," current gestational diabetes.
Route: Redirect.
Response: refer to OB/GYN or maternal-fetal medicine.

**Trigger 8 — Mental health crisis (non-suicidal)**
Detects: "having a breakdown," current panic attack, hallucinations, prolonged uncontrolled distress.
Route: Bypass LLM.
Response: 988 (handles general emotional crises), SAMHSA 1-800-662-4357, PCP referral for Medicare-covered mental health.

**Trigger 9 — Stopping critical medication unilaterally**
Detects: plans to stop insulin / blood thinners / heart meds / BP meds / "feel fine so quitting."
Route: LLM engages with caveats.
Response: steers toward prescriber contact; offers to help prepare questions; explicit risk acknowledgment.

**Trigger 10 — Disordered eating / unsafe weight loss**
Detects: extended not eating, purging, diabulimia signals, laxative misuse, extreme calorie restriction requests.
Route: Redirect, block nutrition specifics.
Response: National Alliance for Eating Disorders 1-866-662-1235; PCP referral.

**Trigger 11 — Elder abuse / exploitation**
Detects: financial exploitation signals, fear of caregiver/family, "won't let me" statements, locked-in language.
Route: Supportive redirect.
Response: Eldercare Locator 1-800-677-1116, National Elder Fraud Hotline 1-833-372-8311; 911 if immediate danger. Does not count toward abuse-pattern detection.

**Trigger 12 — Info requests enabling harm**
Detects: "lethal dose of X," "how to overdose," "how to harm."
Route: Firm refusal.
Response: declines information; redirects to 988 if self-harm context; pharmacist/prescriber for legitimate dosing questions.

### Implementation requirements

- Triggers execute at Layer 1 before any LLM call.
- Detection: regex + keyword + embedding similarity + light LLM classifier.
- Audit log writes `{action: SAFETY_TRIGGER_FIRED, trigger_name, user_id, timestamp}`; does NOT log message content.
- UI renders safety responses with distinct visual treatment (not a streamed LLM response).
- Fixture set of ~50 test inputs per trigger, owned by `negative-test-validator` subagent.
- Quarterly language review cadence.

---

## Part 7 — Prognosis Discipline

What prognosis IS:
- Trajectory projection from longitudinal data
- Risk stratification via validated calculators (KFRE, ASCVD, UKPDS, LACE)
- Cost trajectory (Plan Finder + claims pattern)
- Care gap forecast (ADA/USPSTF rules)
- Cohort comparison when data permits

What prognosis is NOT:
- Not diagnosis
- Not individualized medical prediction
- Not treatment recommendation
- Not mental health prognosis
- Not cancer prediction

Every prognostic output includes: model/logic cited, data points relied on, confidence level, plain-English caveat, clinician handoff path.

---

## Part 8 — Technology Stack

Confirmed from discovery. No changes planned.

- **Frontend:** Next.js 16, React 19, TypeScript strict, Tailwind, shadcn/ui
- **Hosting:** AWS ECS Fargate
- **Database:** PostgreSQL 16.9 on RDS (AES-256 at rest)
- **AI:** AWS Bedrock — Sonnet 4.6 (chat), Opus 4.6 (appeals); migrate appeals to Opus 4.7 for 1M context + task budgets + image improvements
- **Auth:** AWS Cognito (email OTP), optional ID.me (IAL2)
- **Email:** AWS SES
- **Payments:** Stripe (test mode until CMS production; switch to live post-approval)
- **Secrets:** AWS Secrets Manager
- **Monitoring:** CloudWatch + SNS

BAA: AWS (executed 2026-02-25), Stripe (PCI DSS L1). No PHI leaves AWS BAA boundary.

---

## Part 9 — Build Order (Not Scheduled)

Sequenced by dependency, not by calendar. Timing is decided by the operator.

### Prerequisites (before anything else)
- Sign CARIN Code of Conduct pledge
- Submit Denali to myhealthapplication.com
- Collect `birth_year` at signup
- Add `user_conditions` table + `is_on_medicare` flag
- Establish design doc as source of truth (this commit)

### Foundation (next logical block)
- Canonical `HealthRecord` schema + storage
- Base `HealthDataConnector` interface
- Rewrap BB2.0 code as `CMSBlueButtonConnector`
- Guardrail Layer 1 + Layer 2 + Layer 5 (all 12 triggers)
- Scope expansion: HTN + dyslipidemia activated

### Reference vertical slice
- Medication Adherence Card end-to-end (claims → analyzer → insight → card)
- Validates full architecture before scaling

### Second vertical
- A1c Trajectory Card (forces first non-BB data source decision)

### Image input
- Glucometer OCR via Opus 4.7 vision
- BP cuff OCR (same pattern)

### Expanded input
- Apple Health connector
- Voice glucose logging (in-app mic, not Alexa skill)

### Scope wave 2
- CKD scope: KFRE + CKD LCDs + CKD skills
- CVD scope: ASCVD + cardiology corpus + CV skills
- Depression screening: PHQ-2/PHQ-9 annual + Medicare mental health referrals
- Commercial payer FHIR for pre-Medicare users
- EHR aggregator (1upHealth or Flexpa)
- Longitudinal Wiki Synthesizer (Opus 4.7, 1M context)
- Pre-Visit Briefing Generator
- Universal Medical Document Capture (EOB, MSN, denial letter, lab printout OCR)
- Guardrail Layers 3, 4, 6
- Task-budgeted appeal agent (Opus 4.7)

### Later extensions
- Direct Epic + Cerner integration (only if aggregator demand proves it)
- Direct Quest + LabCorp lab integration
- Drug Cost + Plan Optimization (Medicare Plan Finder)
- Hospitalization Risk (LACE)
- Cognitive/Frailty Early Warning
- Lifestyle-Outcome Causal Engine
- Weekly Analyst Background Job
- Formal DirectTrust CARIN-CFA Accreditation

---

## Part 10 — Cleanup Backlog (from Discovery)

Sequenced by severity. Integrated into build order above.

### Critical
1. No DOB collected — **STILL OPEN** (`birth_year` column not yet added; planned in Foundation Stage 1)
2. No prompt injection defense → Foundation (Layer 1)
3. No output filtering → Scope wave 2 (Layer 4)
4. No mental health / self-harm detection → Foundation (Layer 5)
5. Send-OTP in-memory rate limit → Foundation (move to DB or Redis)

### Important
6. No canonical patient record → Foundation (schema work)
7. Appeal letters unredacted → Scope wave 2 (PHI redaction pass)
8. No body-size limit on chat text → Foundation (quick fix)
9. Off-topic relies on prompt → Foundation (Layer 1 scope enforcement)
10. `diabetes_snapshots` misleading name → Foundation (rename or populate via Apple Health)
16. Rate-limit check fail-open on RDS error in `/api/chat` — try/catch around `check_and_increment_chat` and `check_weekly_frequency` swallows errors and lets requests through unlimited. Comment says intentional, but means RDS outage = no rate limiting. Discovered 2026-04-22.
17. Appeal credit enforcement is client-only on server save path — `decrement_appeal_credit` returns -1 when balance is 0 but doesn't abort the transaction; appeal INSERT succeeds regardless. Gating enforced by `AppealGate.tsx` UI only. Direct API caller bypasses enforcement. Discovered 2026-04-22.

### Cleanup
11. `learning_queue` no consumer → Later extensions (wire up or drop)
12. Dormant TOTP code → Later extensions (re-enable or remove)
13. Phone OTP columns unused → Later extensions (remove if not wiring SMS)
14. `hipaa-security-reviewer` has write access — **STILL OPEN** (investigation planned in Foundation Stage 2)
15. Appeal letter hash not audit-logged → Scope wave 2 (extend audit metadata)
18. `scripts/seed-blog-posts.sql` is a duplicate of `scripts/migrate-blog.sql` without ON CONFLICT guards; never include in apply order.
19. `scripts/migrate-appeal-levels.sql` has obsolete `CREATE OR REPLACE FUNCTION` that conflicts with prod-evolved signature; header comment marks it obsolete (commit 322a4c9). File can be removed entirely in a cleanup pass.
20. `/api/auth/send-otp` route returns 200 even when `sendEmail()` returns null messageId — misleads user. Fix by checking return value and returning 500 on failure.

---

## Part 11 — Compliance Checklist

### Pre-production credentials
- ✅ AWS BAA executed (2026-02-25)
- ✅ Audit log append-only (3-layer, applied 2026-04-10)
- ✅ Consent architecture (3 toggles, default OFF)
- ✅ HIPAA session timeout (30 min)
- ✅ Encryption at rest (RDS AES-256) + in transit (TLS 1.2+)
- ✅ CMS Demo complete (2026-04-16)
- ⏳ Production access form (expected from CMS)
- ⏳ Sign CARIN Code of Conduct pledge
- ⏳ List on myhealthapplication.com

### Pre-scale (before 1K+ active users)
- DirectTrust CARIN-CFA Accreditation (formal)
- HITRUST preparation (separate workstream)
- FHIR USCDI v3 deadline readiness (July 2026)
- Incident response plan formalized in writing

---

## Part 12 — Open Questions

1. EHR aggregator: 1upHealth vs. Flexpa? Pricing + coverage comparison needed.
2. Voice stack: AWS Transcribe Medical (under BAA) vs. Whisper? Leaning Transcribe Medical.
3. Commercial payer FHIR sequencing: top 3 payers first or aggregator first?
4. Appeal engine: migrate from Opus 4.6 to Opus 4.7 — yes, just timing.
5. Longitudinal wiki UX: new primary surface or card within dashboard?
6. Prediction recompute cadence: real-time vs. weekly batch?
7. Voice input pricing: free differentiator or paid feature?

---

## Part 13 — Versioning

Every substantive change requires:
1. A new version number
2. A dated changelog entry
3. Review against North Star and Pipeline Architecture (stable; changes require explicit justification)

### Changelog
- **v1.0 (2026-04-17)** — Initial consolidated design doc. Synthesized from CMS demo Q&A, discovery inventory, research Memo A (condition scope), research Memo B (safety triggers), pipeline architecture discussions.
- **v1.1 (2026-04-17)** — North Star simplified: "Medicare and pre-Medicare" removed; "55+" covers both inherently. Build order converted from timed phases to dependency-sequenced blocks (operator decides pace). CLAUDE.md reference added.
- **v1.2 (2026-04-22)** — Added Part 14: Environment Status (staging operational, prod ANTHROPIC_MODEL fixed, CMS prod access in progress). Part 10 Cleanup Backlog: added items #16–20 discovered during staging bootstrap smoke-testing session. No scope changes to Parts 2, 3, 4, 5, 6, 7 (condition scope, pipeline, guardrails unchanged).

---

## Part 14 — Environment Status (as of 2026-04-22)

### Production
- Service: denali-web in cluster denali, task def denali:164
- ANTHROPIC_MODEL: Sonnet 4.6 (chat), Opus 4.6 (appeals) — fixed 2026-04-22 after discovering chat was misconfigured on Opus
- Stripe: live-mode webhook active
- CMS Blue Button 2.0: production access approved 2026-04-17 (transition in progress)

### Staging
- Service: denali-staging-web in cluster denali-staging, task def denali-staging:2
- URL: https://staging.denali.health
- Status: Smoke-tested 2026-04-22 — OTP sign-in + chat both end-to-end green on Sonnet 4.6
- RDS: 41 tables + 5 views + 1 matview + 37 functions + 4 extensions (pgcrypto, pg_trgm, btree_gin, plpgsql), identical schema to prod
- Secrets: denali/staging/app-IpWtpX (13 keys populated)
- SES: DKIM verified for staging.denali.health, IAM whitelist includes no-reply@staging.denali.health
- Stripe: test-mode webhook registered
- Test user: ramanac@gmail.com (trial plan)

### CARIN
- Submitted to CARIN myhealthapplication.com

### Known Gaps (Foundation-scope)
- Rate-limit fail-open on RDS error (both envs)
- Appeal credit enforcement client-only (both envs)
- STARTER Stripe checkout mode:subscription bug (both envs, pre-existing)
- ID.me code paths still present but flagged deprecated
- `sql/001-schema.sql` was Supabase-era stale; replaced with fresh prod pg_dump on 2026-04-22
