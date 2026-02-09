# Denali Feature Review — February 9, 2026

> Comprehensive code review of every feature, file, and Supabase integration.
> Generated from full codebase audit across chat/AI, auth/payment, FHIR/health, UI, and database layers.
> Updated with second pass findings (critical server-side auth bugs, payment pipeline issues).

### Status Summary

| Category | Count |
|----------|-------|
| Fully Implemented | 38 |
| Bugs Fixed (Pass 1) | 16 |
| Critical/High Issues (Pass 2) | 9 |
| Medium Issues (Pass 2) | 2 |
| Design Decisions Pending | 8 |
| Dead Code Candidates | 9 |

---

## Fully Implemented Features (No TODOs, No Stubs, No Gaps)

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
| 28 | Appeal outcome reporting | `AppealOutcomePrompt.tsx`, `/api/appeal-outcome` | 3 outcomes, days to decision, learning system |
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

## Bugs Found and Fixed (Feb 9)

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

## Second Pass Findings (Feb 9 — Critical/High)

### CRITICAL: Server routes using browser Supabase client

The `createClient()` browser client has NO auth context in server route handlers — `auth.uid()` is always NULL. This means all DB operations silently fail under RLS. Three server routes have this bug:

| # | Route | File | Impact | Fix |
|---|-------|------|--------|-----|
| 1 | `DELETE /api/account/delete` | `account/delete/route.ts:11,16` | **Account deletion is completely non-functional.** All `.delete()` calls run as anon → RLS blocks every row → user data remains. GDPR/CCPA violation. | Migrate to `createServerSupabaseClient()` + `createAdminClient()` for cascade |
| 2 | `POST /api/checkout` | `checkout/route.ts:12,55` | **Stripe metadata.user_id is empty string.** `fulfillCheckoutSession()` skips when `!userId`. Payments succeed but plan is never upgraded. | Migrate to `createServerSupabaseClient()` |
| 3 | `POST /api/outcome-report` | `outcome-report/route.ts:11,36` | **Token lookups and outcome recording silently fail** if `outcome_followups` table has user-scoped RLS. `recordAppealOutcome()` calls into `learning.ts` which also uses browser client. | Migrate to `createServerSupabaseClient()` for lookups, `createAdminClient()` for incentive |

### CRITICAL: learning.ts uses browser client throughout

| # | Issue | File | Impact |
|---|-------|------|--------|
| 4 | **Entire `learning.ts` uses `createClient()`** (17 call sites) | `lib/learning.ts:18,265,300,343,372,414,492,510,544,577,640,721,741,802,867,884,911` | Called from server `route.ts` via `persistLearning()`. All learning writes (symptom mappings, procedure mappings, coverage paths, feedback, flywheel) silently fail. Learning system is non-functional. |

### HIGH: Pricing & Payment Issues

| # | Issue | File | Impact | Fix |
|---|-------|------|--------|-----|
| 5 | `MONTHLY.appealLimit: 6` contradicts CLAUDE.md, FAQ, Settings ("unlimited") | `pricing.ts:38` | PaywallModal shows "6 appeals per month" — misleading if plan is unlimited. FAQ says "unlimited." | Change to `Infinity` or `0` (unlimited) |
| 6 | **Dev paywall bypass**: When `STRIPE_SECRET_KEY` missing, checkout returns `{ url: null }`, PaywallModal calls `onSuccess()` | `checkout/route.ts:42-48`, `PaywallModal.tsx:60-63` | In dev/staging without Stripe key, users get free access to paid features. No error shown. | Return error response instead of `{ url: null }` |
| 7 | Stripe price IDs are placeholders | `pricing.ts:30,39` | `"price_single_appeal"` and `"price_unlimited_monthly"` — Stripe will reject checkout.sessions.create | Need real Stripe dashboard price IDs |
| 8 | `stripe-fulfillment.ts` never populates `period_end` | `stripe-fulfillment.ts:50,95` | Subscription records have NULL end date — can't detect expired subscriptions | Parse `subscription.current_period_end` from Stripe object |
| 9 | Missing webhook handlers | `webhooks/stripe/route.ts` | No `invoice.payment_failed` (can't detect failed renewals) or `customer.subscription.trial_will_end` (can't notify before trial expiry) | Add event handlers |

### MEDIUM: UI & UX Issues

| # | Issue | File | Impact | Fix |
|---|-------|------|--------|-----|
| 10 | PaywallModal hardcoded dark theme (`slate-900`, `blue-500/600`) | `PaywallModal.tsx:82+` | Broken in light mode — dark background on light page | Rewrite with CSS variables |
| 11 | PaywallModal lists phantom features: "Priority support", "Appeal tracking" | `PaywallModal.tsx:234,248` | Features not implemented — misleading to users | Remove or replace with real features |

---

## Known Issues (Not Fixed — Design Decisions or External Dependencies)

| # | Issue | File | Why Not Fixed |
|---|-------|------|---------------|
| 1 | `useSettings` only persists `textScale` to localStorage, not synced to DB | `useSettings.ts` | Design decision: cross-device sync needed? |
| 2 | No forced FHIR refresh (24h cache can't be bypassed) | `/api/fhir/data` | Design decision: add `?force=true` param? |
| 3 | No SQL migration files in repo (schema not version-controlled) | -- | Process: export from Supabase dashboard |
| 4 | Wildcard CORS `*` on edge functions | `_shared/cors.ts:6` | Needs domain restriction for prod |
| 5 | No `payment=success` handler after Stripe redirect | chat page | Needs payment confirmation UX |
| 6 | Home page has no personalized greeting with user name | `app/page.tsx` | Needs auth hook integration |
| 7 | `consent/route.ts` never increments `version` column | `consent/route.ts:75` | Needs DB trigger or explicit increment |
| 8 | FHIR Condition fetch uses `category=encounter-diagnosis` only (misses problem-list-item) | `fhir/sync.ts:69` | Needs Blue Button sandbox testing first |

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
