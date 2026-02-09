# Denali Feature Review — February 9, 2026

> Comprehensive code review of every feature, file, and Supabase integration.
> Generated from full codebase audit across chat/AI, auth/payment, FHIR/health, UI, and database layers.
> **All issues resolved**: 16 Pass 1 bugs, 11 Pass 2 critical/high/medium issues, and 4 Pass 3 pipeline fixes — all applied, verified, and committed.

### Status Summary

| Category | Count | Status |
|----------|-------|--------|
| Fully Implemented & Working | 38 | Verified |
| Bugs Found & Fixed (Pass 1) | 16 | All Fixed |
| Critical/High Issues Found & Fixed (Pass 2) | 9 | All Fixed |
| Medium Issues Found & Fixed (Pass 2) | 2 | All Fixed |
| Skill Pipeline Fixes (Pass 3) | 4 | All Fixed |
| Design Decisions Pending | 7 | Open |
| Dead Code Candidates | 9 | Not yet removed |
| **Total Fixes Applied** | **31** | |

---

## Fully Implemented Features (Working End-to-End)

| # | Feature | Key Files | Notes |
|---|---------|-----------|-------|
| 1 | Chat with Claude (MCP + local tools) | `route.ts`, `claude.ts`, `tools/index.ts`, `skills-loader.ts` | Full tool loop, extraction pipeline, rate limiting, learning persistence |
| 2 | Conversation persistence | `conversation-service.ts`, `/api/conversations` | Create, load, claim, save messages, grouped history |
| 3 | Sidebar + history | `Sidebar.tsx`, `useConversationHistory.ts` | Server route fetch, auth-aware, date grouping, bidirectional refresh |
| 4 | Email OTP auth | `useAuth.ts`, `settings/page.tsx` | Send code, verify, upsert user, module-level cache |
| 5 | TOTP MFA (opt-in) | `useAuth.ts`, `TOTPEnrollModal`, `TOTPChallengeModal` | Enroll, challenge, verify, AAL2 gating on FHIR |
| 6 | Supabase SSR middleware | `middleware.ts` | Token refresh, cookie forwarding, race prevention |
| 7 | Profile server route | `/api/profile/route.ts` | Plan, role, isAdmin, appealCount via cookie-auth |
| 8 | Admin bypass | `route.ts`, `useAuth.ts`, `settings/page.tsx`, `AppHeader.tsx` | Unlimited chat + appeals, "Admin" label in UI |
| 9 | Daily chat rate limiting | `route.ts`, `useChat.ts`, `check_and_increment_chat` RPC | 3/anon, 10/free, unlimited/paid, 429 handling |
| 10 | 14-day free trial | `/api/trial/route.ts` | Start, check, duplicate prevention, audit logged |
| 11 | Blue Button OAuth (PKCE) | `fhir/authorize`, `fhir/callback`, `fhir/crypto.ts` | S256, encrypted tokens, state/verifier cookies, audit |
| 12 | Token encryption | `fhir/crypto.ts` | AES-256-GCM, proper IV/authTag handling |
| 13 | Token auto-refresh | `fhir/tokens.ts` | 5-min pre-expiry window, marks expired on failure |
| 14 | FHIR data sync + caching | `fhir/sync.ts`, `fhir/transforms.ts` | 6 resource types in parallel, 24h TTL, graceful degradation |
| 15 | Health page | `health/page.tsx`, `useHealthData.ts` | Patient, coverage, claims, labs, conditions, medications |
| 16 | Diabetes classification | `fhir/transforms.ts` (`classifyDiabetesStatus`) | 6-tier: diabetic/pre-diabetic/at-risk/none with evidence |
| 17 | Diabetes dashboard | `diabetes/page.tsx`, `components/diabetes/*` | A1C trend, risk alerts, screening reminders, quick log, insights |
| 18 | Diabetes daily log | `/api/diabetes/log`, `useDiabetesLog.ts`, `QuickLog.tsx` | Full CRUD, input validation, audit logged |
| 19 | AI diabetes insights | `diabetes-insights.ts`, `/api/diabetes/insights`, `InsightsCard.tsx` | Claude-generated, hash-dedup, consent-gated |
| 20 | Longitudinal lab snapshots | `fhir/snapshots.ts`, `diabetes_snapshots` table | Append-only, conflict-safe, auto-populated on sync |
| 21 | Health context in AI | `fhir/context.ts`, `buildHealthContextForPrompt()` | Labs + conditions + meds + classification + trends, consent-gated |
| 22 | Chat + health data bridge | `useChat.ts`, chat `page.tsx` | `initialSessionState` + async sync via useEffect |
| 23 | Consent preferences | `/api/consent`, `useConsent.ts`, Settings UI | Fetch, toggle, audit-logged, enforced in FHIR pipeline |
| 24 | Audit logging | `audit.ts`, 7+ API routes | Who, what, when, why (IP, user agent, metadata) |
| 25 | Denial code lookup | `tools/index.ts`, `denial-patterns.ts` | CARC/RARC/EOB search, appeal strategy, success rates |
| 26 | Appeal letter generation | `tools/index.ts` (`generate_appeal_letter`) | Inline codes, policy refs, PubMed citations, deadline |
| 27 | Appeal gating | `AppealGate.tsx`, `PaywallModal.tsx` | Email OTP -> TOTP -> access check -> paywall pipeline |
| 28 | Appeal outcome reporting + incentive | `AppealOutcomePrompt.tsx`, `/api/appeal-outcome` | 3 outcomes, days to decision, learning system, free appeal credit on report |
| 29 | Appeal letter PDF | `AppealLetterModal.tsx`, `buildPDF()` | jsPDF download, PDF-in-new-tab print, copy, deadline banner |
| 30 | Skills system | `skills-loader.ts`, `src/skills/*`, `src/lib/skills/*` | 20+ skills, gate-based loading, learning context |
| 31 | Pre-diabetes risk test | `PreDiabetesRiskCard.tsx` | CDC 7-question test, scoring, chat routing |
| 32 | CMS pledges | `CmsPledge.tsx` | AI Assistant + Diabetes pledge text on relevant pages |
| 33 | Legal pages | `privacy/`, `hipaa/`, `faq/` | Comprehensive, BRAND config, CSS variables |
| 34 | Blog (CMS-driven) | `blog/page.tsx`, `blog/[slug]/page.tsx` | Server-rendered from `blog_posts` Supabase table |
| 35 | Landing page (CMS-driven) | `app/page.tsx` | `site_settings`, `landing_content`, `pricing_plans`, `testimonials` |
| 36 | Theme support | `useSettings.ts`, CSS variables | Dark/light/system, text scale |
| 37 | Mobile responsive | `BottomTabs.tsx`, `AppHeader.tsx` | 4-tab bottom nav, hamburger, sidebar |
| 38 | Request purpose tagging | `fhir/client.ts` | `X-Request-Purpose` header on FHIR calls |

---

## Bugs Found and Fixed — Pass 1 (Feb 9)

All 16 bugs fixed, committed, and verified.

| # | Bug | File:Line | Severity | Fix |
|---|-----|-----------|----------|-----|
| 1 | FHIR OAuth scopes missing `Observation.read`, `Condition.read`, `MedicationRequest.read` — labs/conditions/meds silently return empty | `config/api.ts:34` | **HIGH** | Added missing scopes |
| 2 | Checkout redirect URLs point to `/chat` not `/app/chat` — post-payment 404 | `checkout/route.ts:73-74` | **HIGH** | Fixed to `/app/chat` |
| 3 | `per_appeal` plan not recognized in `checkAppealAccess` — paid users hit paywall again | `useAuth.ts:500-510` | **HIGH** | Added `per_appeal` branch returning `"allowed"` |
| 4 | `logAudit` userId always `undefined` — ternary is `email ? undefined : undefined` | `route.ts:400` | Medium | Changed to `authUser?.id` |
| 5 | `privacyPolicyUrl` points to `/faq` instead of `/privacy` in CMS metadata | `cms-metadata/route.ts:20` | Medium | Fixed URL + used BRAND config |
| 6 | Trial duration hardcoded as 30 days in CMS metadata; actual is 14 | `cms-metadata/route.ts:35,44` | Medium | Used `PRICING.TRIAL_DURATION_DAYS` |
| 7 | Edge function writes `processed_at` column that doesn't exist (should be `completed_at`) | `process-learning-queue:63` | Medium | Fixed column name |
| 8 | Edge function writes `error` column (should be `last_error`) | `process-learning-queue:76` | Medium | Fixed column name |
| 9 | Lab date sorting compares locale-formatted strings lexicographically | `fhir/transforms.ts:301` | Medium | Sort by ISO date string instead |
| 10 | `useDiabetesSnapshots` uses `createClient()` browser query (violates CLAUDE.md rule) | `useDiabetesSnapshots.ts:4,27` | Medium | Switched to `getClient()` singleton |
| 11 | FAQ says "30-day free trial" — actual is 14 days | `faq/page.tsx:65` | Low | Fixed to 14-day |
| 12 | Privacy page says "30-day free trial" — actual is 14 days | `privacy/page.tsx:187` | Low | Fixed to 14-day |
| 13 | HIPAA page HHS OCR complaints URL not clickable | `hipaa/page.tsx:297-299` | Low | Made into clickable link |
| 14 | "Get Help Appealing" link to `/app/claims` redirect (no claim context) | `ClaimDetail.tsx:120` | Low | Changed to `/app/chat` with context message |
| 15 | Disconnect doesn't clean up `diabetes_snapshots`, `diabetes_log`, `diabetes_insights` | `fhir/disconnect/route.ts` | Medium | Added cascade deletion |
| 16 | `appeal-outcome/route.ts` has no authentication check | `appeal-outcome/route.ts` | Medium | Added auth verification |

---

## Critical/High Issues Found and Fixed — Pass 2 (Feb 9)

All 9 critical/high and 2 medium issues fixed, committed, and verified.

### Server Routes Using Browser Client (FIXED)

Three server routes were using `createClient()` (browser Supabase client) which has NO auth context server-side — `auth.uid()` is always NULL, so all DB operations silently fail under RLS.

| # | Route | File | Impact | Fix Applied |
|---|-------|------|--------|-------------|
| 1 | `DELETE /api/account/delete` | `account/delete/route.ts` | **Account deletion was completely non-functional.** All `.delete()` calls ran as anon → RLS blocked every row → user data remained. GDPR/CCPA violation. | **FIXED**: Migrated to `createServerSupabaseClient()` for auth + `createAdminClient()` for cascade deletion |
| 2 | `POST /api/checkout` | `checkout/route.ts` | **Stripe metadata.user_id was empty string.** `fulfillCheckoutSession()` skipped when `!userId`. Payments succeeded but plan was never upgraded. | **FIXED**: Migrated to `createServerSupabaseClient()` |
| 3 | `POST /api/outcome-report` | `outcome-report/route.ts` | **Token lookups and outcome recording silently failed** under RLS. | **FIXED**: Migrated to `createServerSupabaseClient()` for lookups, `createAdminClient()` for writes |

### learning.ts Browser Client (FIXED)

| # | Issue | File | Impact | Fix Applied |
|---|-------|------|--------|-------------|
| 4 | **Entire `learning.ts` used `createClient()` browser client** (17 call sites) | `lib/learning.ts` | Called from server `route.ts` via `persistLearning()`. All learning writes (symptom mappings, procedure mappings, coverage paths, feedback, flywheel) silently failed. Learning system was non-functional. | **FIXED**: All 17 call sites migrated to `createAdminClient()` |

### Pricing & Payment Issues (FIXED)

| # | Issue | File | Impact | Fix Applied |
|---|-------|------|--------|-------------|
| 5 | `MONTHLY.appealLimit: 6` contradicted CLAUDE.md, FAQ, Settings ("unlimited") | `pricing.ts:38` | PaywallModal showed "6 appeals per month" — misleading. FAQ says "unlimited." | **FIXED**: Changed to `0` (unlimited) |
| 6 | **Dev paywall bypass**: When `STRIPE_SECRET_KEY` missing, checkout returned `{ url: null }`, PaywallModal called `onSuccess()` | `checkout/route.ts`, `PaywallModal.tsx` | In dev/staging without Stripe key, users got free access to paid features. No error shown. | **FIXED**: Returns 503 error response instead of `{ url: null }` |
| 7 | Stripe price IDs were placeholders | `pricing.ts:30,39` | `"price_single_appeal"` and `"price_unlimited_monthly"` would be rejected by Stripe | **FIXED**: Now reads from `STRIPE_PRICE_*` env vars. Sandbox price IDs configured in Vercel |
| 8 | `stripe-fulfillment.ts` never populated `period_end` | `stripe-fulfillment.ts:50,95` | Subscription records had NULL end date — couldn't detect expired subscriptions | **FIXED**: Reads `current_period_end` from `subscription.items.data[0]` |
| 9 | Missing webhook handlers | `webhooks/stripe/route.ts` | No `invoice.payment_failed` (couldn't detect failed renewals). Missing `customer.subscription.trial_will_end` | **FIXED**: Added handlers for `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.trial_will_end`, `invoice.finalized`, `invoice.paid` |

### UI & UX Issues (FIXED)

| # | Issue | File | Impact | Fix Applied |
|---|-------|------|--------|-------------|
| 10 | PaywallModal hardcoded dark theme (`slate-900`, `blue-500/600`) | `PaywallModal.tsx` | Broken in light mode — dark background on light page | **FIXED**: Rewritten with CSS variables (`var(--bg-primary)`, etc.) |
| 11 | PaywallModal listed phantom features: "Priority support", "Appeal tracking" | `PaywallModal.tsx` | Features not implemented — misleading to users | **FIXED**: Replaced with real features: "Unlimited appeal letters", "Unlimited daily messages" |

---

## Skill Pipeline Fixes — Pass 3 (Feb 9)

4 pipeline gaps identified from skill design specs (`skills/domain/*/SKILL.md`), all fixed and committed.

| # | Gap | Severity | Files Modified | Fix Applied |
|---|-----|----------|---------------|-------------|
| 1 | **Requirement verification pipeline broken** — vacuous truth gate: `!triggers.hasRequirementsToVerify` evaluated to `true` when requirements array was empty (extraction never happened), causing system to skip directly to guidance delivery without verifying any LCD/NCD requirements | **HIGH** | `skills-loader.ts`, `claude.ts`, `coverage-check.ts` | **FIXED**: (a) Removed vacuous truth condition from guidance gate — guidance now only loads when `verificationComplete === true`. (b) Added step 9b flow reminder prompting Claude to emit `[REQUIREMENTS]` block after coverage lookup. (c) Added implicit skip safety valve in `extractUserInfo()` for stuck-state prevention. (d) Strengthened `COVERAGE_SKILL` prompt: `[REQUIREMENTS]` marked MANDATORY with "do this EVERY time" |
| 2 | **Outcome incentive never delivered** — `applyOutcomeIncentive()` existed in `learning.ts` but was never called anywhere. Users who reported appeal outcomes got no free appeal credit | **MEDIUM-HIGH** | `appeal-outcome/route.ts` | **FIXED**: Wired `applyOutcomeIncentive(user.email)` call after `recordAppealOutcome()`. Returns `incentiveApplied` flag + appropriate thank-you message |
| 3 | **Denial codes empty in appeals** — `denialCodes` only populated from `lookup_denial_code` tool results via `updateSessionFromToolResults()`. If user mentioned "CO-50" in text but Claude summarized without calling the tool, codes stayed empty | **MEDIUM** | `claude.ts` | **FIXED**: Added regex extraction in `extractUserInfo()` for CARC/RARC patterns (CO-50, PR-1, CARC 167, RARC N56, denial code 96). Gated on appeal/denial context to avoid false positives |
| 4 | **LCD prior auth extraction unreliable** — `COVERAGE_SKILL` prompt instructions for `[PRIOR_AUTH_LCD]` and `[REQUIREMENTS]` blocks were vague. Claude sometimes skipped emitting them | **LOW-MEDIUM** | `coverage-check.ts` | **FIXED**: Strengthened prompt: `[PRIOR_AUTH_LCD]` block clarified as "auto-parsed and removed". `[REQUIREMENTS]` section marked "MANDATORY — Do This EVERY Time After Coverage Lookup" with explicit format example |

---

## Known Issues (Design Decisions — Not Bugs)

| # | Issue | File | Status | Notes |
|---|-------|------|--------|-------|
| 1 | `useSettings` only persists `textScale` to localStorage, not synced to DB | `useSettings.ts` | Open | Design decision: cross-device sync needed? |
| 2 | No forced FHIR refresh (24h cache can't be bypassed) | `/api/fhir/data` | Open | Design decision: add `?force=true` param? |
| 3 | No SQL migration files in repo (schema not version-controlled) | -- | Open | Process: Supabase MCP `apply_migration` used instead |
| 4 | Wildcard CORS `*` on edge functions | `_shared/cors.ts:6` | Open | Needs domain restriction for prod |
| 5 | No `payment=success` handler after Stripe redirect | chat page | Open | Needs payment confirmation UX |
| 6 | `consent/route.ts` never increments `version` column | `consent/route.ts:75` | Open | Needs DB trigger or explicit increment |
| 7 | FHIR Condition fetch uses `category=encounter-diagnosis` only (misses problem-list-item) | `fhir/sync.ts:69` | Open | Needs Blue Button sandbox testing first |

---

## Dead Code (Candidates for Removal)

| # | Item | File | Notes |
|---|------|------|-------|
| 1 | `LandingHeader.tsx` | `components/landing/` | Replaced by AppHeader |
| 2 | `PhoneOTPModal.tsx` | `components/auth/` | Never imported by any page |
| 3 | `Suggestions.tsx` + `QuickAction` | `components/chat/` | Never imported (chat uses inline suggestions) |
| 4 | `Checklist` component | `components/chat/MarkdownContent.tsx` | Exported but never used |
| 5 | `PrintButton.tsx` | `components/ui/` | Appears unused |
| 6 | `getSiteUrl()`, `getBrandName()` | `config/brand.ts` | Never imported outside config barrel |
| 7 | `ACCESSIBILITY_CONFIG` | `config/ui.ts` | Never consumed by any component |
| 8 | `claim_learning_job`, `complete_learning_job` RPCs | DB functions | Never called by edge function |
| 9 | `pubmed` MCP URL | `config/api.ts:26` | PubMed uses local tool (NCBI E-utilities) |

---

## End-to-End Working Verification

These are the critical paths that are fully functional from user action to database write and back:

| Flow | Path | Verified |
|------|------|----------|
| **Anonymous chat** | User types → rate limit check (3/day) → Claude + MCP tools → response rendered → learning persisted | Yes |
| **Authenticated chat** | Email OTP → rate limit (10/day) → Claude + tools → conversation saved → sidebar updated | Yes |
| **Admin chat** | `is_admin=true` → no rate limit → unlimited messages | Yes |
| **Coverage guidance pipeline** | Onboarding → symptoms → provider NPI → ICD-10/CPT → LCD/NCD lookup → requirement extraction → requirement verification → guidance delivery | Yes (pipeline fix applied) |
| **Appeal flow** | Denial code from user text or tool → CARC/RARC lookup → strategy → gather details → generate letter → paywall gate → PDF | Yes |
| **Appeal outcome** | User reports outcome → `recordAppealOutcome()` → `applyOutcomeIncentive()` → free credit | Yes (incentive wired) |
| **Blue Button OAuth** | Connect Medicare → PKCE authorize → CMS login → callback → token encryption → FHIR sync (6 resources) → cache | Yes (sandbox) |
| **Health data in AI** | FHIR data → `useHealthData` → sessionState → `buildHealthContextForPrompt()` → Claude system prompt | Yes |
| **Diabetes classification** | FHIR Observations + Conditions + Medications → `classifyDiabetesStatus()` → dashboard + AI context | Yes |
| **Diabetes daily log** | QuickLog entry → `/api/diabetes/log` → `diabetes_log` table → entries list | Yes |
| **AI diabetes insights** | FHIR sync → hash-based dedup → Claude Sonnet → `diabetes_insights` table → InsightsCard | Yes |
| **Stripe checkout** | PaywallModal → `/api/checkout` (cookie-auth) → Stripe session → webhook → `fulfillCheckoutSession()` → plan upgrade | Yes (sandbox) |
| **Subscription lifecycle** | `invoice.payment_failed` → `handleSubscriptionEvent()` → status sync | Yes |
| **Account deletion** | Settings → 2-step confirm → `/api/account/delete` (server auth + admin cascade) → sign out → redirect | Yes |
| **Consent enforcement** | Settings toggles → `/api/consent` → `consent_preferences` → gates `buildHealthContextForPrompt()` | Yes |
| **Audit logging** | All sensitive operations → `logAudit()` → `audit_logs` table (admin client, bypasses RLS) | Yes |
| **TOTP MFA** | Settings > Security → enroll → QR code → verify → AAL2 challenge on FHIR authorize | Yes |
| **Learning system** | Chat response → `persistLearning()` → symptom/procedure mappings + coverage paths (admin client) | Yes (admin client fix applied) |

### Not Yet Working End-to-End (External Dependencies)

| Flow | Blocker |
|------|---------|
| **Stripe production payments** | Requires live Stripe keys + price IDs (sandbox works) |
| **Blue Button production** | Requires CMS production credentials (sandbox works) |
| **Medicare.gov notification bridge** | No CMS API available yet — skill detects FHIR changes only |
| **CMS app directory listing** | Requires CMS submission (metadata API ready) |
| **HIPAA/HITRUST certification** | Process — BAAs, compliance docs, breach plan |
| **Patient-facing audit log viewer** | UI not built (data exists in `audit_logs`) |
