# Denali.health

<!-- CLAUDE.md — Project instructions for Claude Code (the coding assistant).
     This file is auto-loaded into every Claude Code context window.
     Keep it accurate to the ACTUAL codebase, not aspirational.
     Maintainer: @cvr
-->

<!-- AWS MIGRATION ✅ COMPLETE (2026-03-03). API routes + auth on AWS:
     Auth: getAuthUser() from lib/auth-server.ts (Cognito httpOnly cookies).
     DB:   query() from lib/db.ts (pg pool → RDS PostgreSQL).
     DOMAIN ROUTING: denali.health / www.denali.health → AWS ALB → ECS Fargate.
                     staging.denali.health → same ALB, separate cluster.
     Detailed history: see docs/history/sessions-2026-04.md
-->

<!-- IMPORTANT FOR CLAUDE CODE:
     - Read this file carefully before making changes to the codebase
     - Sections are ordered by importance: critical rules first, reference material last
     - If a section says "CRITICAL" or "MUST", treat it as a hard constraint
     - The "Key Files" section tells you where to look for specific logic
-->

> Medicare claims intelligence PWA. Claude is the brain — driving conversations, calling tools, synthesizing coverage guidance, and learning from interactions. Focus: **proactive denial prevention** through plain English.

## Design Reference

The product scope, guardrails architecture, safety triggers, pipeline
design, and build sequencing are maintained in the design doc:

`docs/design/denali-design-v1.1.md`

This doc is the source of truth. When a Claude Code prompt conflicts
with the doc, the doc wins — update the doc first if a change is
genuinely intended. When making substantive changes, bump the version
and add a dated changelog entry per Part 13 of the doc.

## Quick Reference

* Target User: Medicare patients & caregivers
* Focus: Pre-diabetes, Diabetes & Obesity coverage guidance
* Backend: Next.js 16, React 19, TypeScript strict, AWS ECS Fargate
* Database: PostgreSQL 16.9 on RDS (AES-256 encryption)
* AI: Claude Haiku 4.5 (free-tier trial chat) + Sonnet 4.6 (paid chat) + Opus 4.6 (appeals) via AWS Bedrock
* Auth: AWS Cognito + SES (OTP, HttpOnly cookies, 30-min HIPAA timeout)
* Payments: Stripe (test mode until CMS production approval)
* Email: AWS SES (BAA signed Feb 25, 2026)
* Data Sources: Blue Button 2.0 API (FHIR R4), ICD-10, CPT, NPI Registry, NCD/LCD, SAD list, PubMed
* Payer: Original Medicare (Medicare Advantage support in appeal letters)
* Infrastructure: AWS VPC, ECS Fargate, RDS, Secrets Manager, CloudWatch, EventBridge
* CMS Status: Production access **GRANTED 2026-04-29**, prod credentials rotated 2026-05-01 (staging stays on sandbox)

---


## Reference docs

Full topical reference under `docs/reference/`. Hub keeps summaries; reference docs have full content.

- [Key Files](docs/reference/key-files.md) · [Architecture](docs/reference/architecture.md) · [Tools & Data Sources](docs/reference/tools.md)
- [Database Schema](docs/reference/db-schema.md) · [Skills & Prompt System](docs/reference/skills.md) · [Orchestration Flows](docs/reference/orchestration.md)
- [Business Model, Auth & Payments](docs/reference/business-model.md) · [Infrastructure](docs/reference/infrastructure.md) · [Blue Button 2.0](docs/reference/blue-button.md)
- [UI/UX Guidelines](docs/reference/ui.md) · [PWA Offline](docs/reference/pwa.md) · [Coding Standards](docs/reference/coding-standards.md)
- [Testing](docs/reference/testing.md) · [Learning System](docs/reference/learning-system.md) · [CMS Interoperability Framework](docs/reference/cms-framework.md) · [Merge Patterns](docs/reference/merge-patterns.md)

History: [Chunk 3 (demographics capture, 2026-06-02)](docs/history/chunk-3-demographics-2026-06-02.md) · [Chunk 2 (cohort gate + non-Medicare trial + Haiku routing, 2026-05-27→28)](docs/history/chunk-2-cohort-gate-2026-05-27.md) · [Phase 3 (BILLING + SP migrations, 2026-05-11→13)](docs/history/phase-3.md) · [CMS compliance log](docs/history/cms-compliance-log.md) · [Sessions 2026-04](docs/history/sessions-2026-04.md)

Phase 1 mobile (in progress): spec at [docs/design/phase-1-45plus.md](docs/design/phase-1-45plus.md); path-scoped rules in [mobile/CLAUDE.md](mobile/CLAUDE.md) (auto-loaded under `mobile/`); agent topology in `.claude/agents/mobile-*.md`; decisions in [docs/history/phase-1-mobile-decisions.md](docs/history/phase-1-mobile-decisions.md).

---
## Critical Rules

These cause bugs or bad UX if violated. Read before every coding session.

### ⛔ NO HARDCODED / MOCK / TEMPLATE PAGES — EVER

**This is the #1 rule. Violating it wastes time and ships broken UX.**

- **NEVER create pages with hardcoded/mock data.** Every page MUST pull real data from auth state (`useAuth`), health data (`useHealthData`), or API routes. No exceptions.
- **NEVER use placeholder names, fake counts, or template strings** like "Good morning, Venkata" or "3 new claims" unless they come from real API data.
- **NEVER ship a page that works without authentication when it should require it.** If a page shows user-specific content, it MUST check auth and redirect anonymous users.
- **Mock data factories** (e.g., `getMockDashboardContext()`) are ONLY for unit tests and Storybook — NEVER for production page rendering.
- **If data isn't available yet**, show a proper loading/empty state — not fake data that looks real.
- **Auth-gated pages** (`/app/*`) MUST redirect to `/` or show sign-in prompt when user is not authenticated. No page under `/app/` should ever render meaningful content for anonymous users.

**Pattern to follow:**

```tsx
// CORRECT — real data, auth-gated
const { user, isLoading } = useAuth();
const { healthData } = useHealthData();
if (isLoading) return <Skeleton />;
if (!user) return <Redirect to="/" />;
return <Dashboard data={healthData} userName={user.email} />;

// WRONG — hardcoded mock data, no auth check
const ctx = getMockDashboardContext(); // ← NEVER in production
return <Dashboard data={ctx} />; // ← shows fake data to everyone
```

### Stage 2 — Medicare cohort gate (landed prod 2026-05-28)

The app now branches on `users.is_on_medicare` (NULLABLE since Chunk 2) across middleware, appeals, paywall, chat-tool selection, and trial rate limiting. Full history: `docs/history/chunk-2-cohort-gate-2026-05-27.md`. Rules future sessions must honor:

- **`users.is_on_medicare` is NULLABLE.** `null` = user hasn't answered yet; `true` = Medicare; `false` = explicitly not Medicare. **Strict `=== true` check** gates all Medicare-only features — `null` and `false` BOTH suppress the Medicare surface. Treat unknown as non-Medicare for safety.
- **Middleware gate uses a cookie, business logic uses the DB.** `medicare_status` cookie (`"yes"`/`"no"`/absent) drives the `/app/*` → `/onboarding/medicare` interstitial redirect for routing performance. **Never read the cookie in business logic** — `/api/appeals`, `/api/appeal-outcome`, `/api/checkout` (Starter), chat tool filter, paywall filter all re-fetch from DB. Cookie is set at three sites: `verify-otp` (post-auth), `/api/profile` PATCH (toggle sync), `/api/profile` GET (legacy session heal). HttpOnly + Secure (prod) + SameSite=Lax + 30d.
- **Non-Medicare trial = 3 days from `users.created_at`, 3 msgs/day, no weekly cap.** Independent of `subscriptions.trial_end` (Medicare path keeps that for 14-day trial). Past window → 403 `TRIAL_EXPIRED` with paywall. Within window + 3 msgs used → 429 `NON_MEDICARE_DAILY_LIMIT` with copy "You've used your 3 messages for today. Come back tomorrow." — **no upgrade CTA, no `upsell` field**.
- **Appeals are Medicare-only.** `/api/appeals` GET, `/api/appeal-outcome` POST, and `/api/checkout` POST (only for `plan=starter`) return 403 `appeals_require_medicare` / `starter_requires_medicare` for `is_on_medicare !== true`. Chat route filters `generate_appeal_letter` out of the tool list for non-Medicare users — the model never sees the tool. Empty-state "Appeal a Denial" card hidden client-side.
- **PaywallModal cohort-filters via `filterPlansForCohort(plans, isOnMedicare)`.** Non-Medicare users see Plus + Unlimited only (Starter omitted entirely); bullets matching `/appeal/i` are stripped from Plus/Unlimited. Pure helper in `lib/banner-visibility.ts` is the sibling pattern for the consent banner.
- **Model routing is PLAN-based, not cohort-based** (Chunk 2.5a, landed prod 2026-06-02 on `denali:197`). Trial users (Medicare or not) → Haiku 4.5; paid users (`plus`/`unlimited`/`starter`) → Sonnet 4.6; appeals → Opus 4.6. Precedence: appeal > trial > paid. Strict `userProfile != null && (userProfile.plan ?? "trial") === "trial"` check — RDS-timeout `userProfile=null` is treated as paid (Sonnet) to protect paying users from silent Haiku downgrade. `ANTHROPIC_TRIAL_MODEL` env var on task def selects the Bedrock profile.
- **Three test accounts on prod** — see "Known test accounts on prod" section below for the canonical list. The third is an operator-known trial account; identifying details are intentionally omitted from this public doc. It follows the non-Medicare cohort path post-Chunk-2.

### Stage 3 — Demographics capture (landed prod 2026-06-02)

Two USCDI-aligned demographic fields added to `users` and a new cookie-gated onboarding flow. The 1-question Medicare interstitial from Chunk 2 became a 3-question interstitial. Full history: `docs/history/chunk-3-demographics-2026-06-02.md`. Rules future sessions must honor:

- **`users.sex_at_birth` and `users.gender_identity` are nullable TEXT columns** with no DB CHECK constraints. Validation lives in `app/src/types/user-demographics.ts` as TypeScript string-literal unions (`SexAtBirth`, `GenderIdentity`) plus `isValidSexAtBirth` / `isValidGenderIdentity` type guards. Rationale: USCDI value sets occasionally evolve; app-layer validation is more flexible than `ALTER CONSTRAINT`, and the type guards double as defense against schema drift. Narrowing fires at every read/write boundary (PATCH/GET `/api/profile`, `verify-otp`, `useAuth.ts` cached-profile and API-response paths).
- **Middleware now requires BOTH `medicare_status` AND `sex_at_birth_status` cookies on `/app/*`.** Missing either one → redirect to `/onboarding/medicare`. Cookie is presence-checked only, never read for business logic. Same write-site discipline as Chunk 2: `verify-otp` (post-auth, set when DB value is non-null), `/api/profile` PATCH (set when non-null, **clear with `Max-Age=0` when set to null** — asymmetric vs. medicare_status because sex_at_birth at the API layer accepts null), `/api/profile` GET (legacy session heal). HttpOnly + Secure (prod) + SameSite=Lax + 30d.
- **`PATCH /api/profile` honors additive semantics — omitted keys = "don't touch column".** The onboarding form's `buildOnboardingPayload` exploits this: required fields (`is_on_medicare`, `sex_at_birth`) always included; optional `gender_identity` included only when the user picked a value. Skipping the optional dropdown sends a partial payload, no unintended UPDATE.
- **The `SexAtBirth` enum has 4 values but v1 UI exposes only 3.** `SEX_AT_BIRTH_UI_OPTIONS` (shared by onboarding form + Settings) = `["male", "female", "unknown"]` with label "Prefer not to say" for `unknown`. The `"intersex"` value is API-settable but absent from the v1 picker. Documented edge in Settings: when `authState.sexAtBirth === "intersex"`, dropdown shows blank (conditional empty `<option>` prevents wrong-option auto-select).
- **"Required" affordance differs by surface, deliberately.** Onboarding interstitial signals required via disabled-Continue button (`canSubmitOnboarding` gate). Settings signals required via red asterisk on the label + bold-red "Required." prefix in helper text + `aria-required="true"` on the `<select>` (asterisk is `aria-hidden="true"` so screen readers announce required via ARIA, not the literal character). Color uses Tailwind `text-red-600 dark:text-red-400` matching 9 existing sibling error-text usages, not the `--color-error` CSS variable.
- **Pure-helper extraction pattern for onboarding form testability.** `MedicareOnboardingForm.tsx` exports `canSubmitOnboarding`, `buildOnboardingPayload`, `submitOnboarding`, `healMedicareCookie` for vitest (node env). Render + interaction tests are deferred to Playwright. Same convention as Chunk 2's onboarding helpers.

### Guardrails

- **Never give medical advice** — only Medicare coverage guidance
- **Never show codes to user** — translate ICD-10, CPT, CARC/RARC to plain English
- **Never ask user for codes** — translate from plain English
- Always end with an actionable next step
- Ask one clarifying question at a time
- Acknowledge what the user said before moving on

### Prompt Rules

- **CRITICAL: Never hardcode tool names in system prompts.** Use action descriptions instead so prompts remain robust as the tool set evolves.
  - DO: "Look up ICD-10 diagnosis codes for the symptoms"
  - DON'T: "Call search_icd10 to find codes"
  - WHY: Tool names in `src/lib/tools/index.ts` may change. Hardcoding them in prompts causes Claude to call non-existent tools when names drift.
- LCD/NCD coverage requirements must be shown **AS-IS** (not simplified). Doctors need exact medical language.
- Include policy numbers (e.g., "LCD L35936") in guidance output.

### Privacy

- Do NOT store: Full names, dates of birth, addresses, SSN, insurance IDs, medical records
- **FHIR Patient resource**: Only `age` and `gender` are extracted and cached. Full name, DOB, Medicare ID, and address are intentionally NOT extracted from the Blue Button FHIR Patient resource (Privacy §2 compliance). `transformPatient()` discards all PII — the raw FHIR resource is processed transiently and never persisted.
- OK to store: Email, phone (for auth), anonymized phrases, conversation content
- Account deletion: Cascade delete all user-linked data, cancel Stripe, retain anonymized learning data + audit logs (6-year HIPAA). Admin accounts return 403 — cannot self-delete through the app. Cognito user deleted via `CognitoIdentityProviderClient.AdminDeleteUser()` as final step so no login credentials remain.

### Consent Toggle Enforcement (Privacy & Data)

Three toggles in Settings → Privacy & Data. **All default OFF.** Enforcement is multi-layered:

| Toggle                | Enforcement Point                              | Mechanism                                                                                                                                               |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `health_data_ai`      | `chat/page.tsx` → `initialSessionState`        | When OFF: strips ALL health fields, sets `healthDataAvailable: false`, keeps `blueButtonConnected: true`                                                |
| `health_data_ai`      | `useChat.ts` → before each API call            | Overlays latest consent on sessionState (supports mid-session toggle changes)                                                                           |
| `health_data_ai`      | `context.ts` → `buildHealthContextForPrompt()` | Gate: `consentHealthDataAi !== true` → returns null (server-side backup)                                                                                |
| `health_data_ai`      | `skills-loader.ts`                             | When `blueButtonConnected && !healthDataAvailable`: injects prompt telling Claude to direct user to Settings toggle, NOT suggest Blue Button connection |
| `health_data_ai`      | `chat/page.tsx` UI                             | Grey banner: "Your Medicare data is connected but not shared with AI. Enable in Settings"                                                               |
| `health_data_storage` | `useHealthData.ts` → `cacheSet()`              | `healthDataStorageRef.current === true` gates IndexedDB writes (useRef pattern for stable useCallback)                                                  |
| `analytics`           | `conversation-service.ts` → `trackEvent()`     | `analyticsConsent !== true` → early return. Passed from `useChat.ts` via `useConsent().analytics`                                                       |

**CRITICAL: Data minimization** — when `health_data_ai` is OFF, health data never leaves the client. The client strips it before sending to `/api/chat`, so server-side trigger detection (`hasHealthData`, `hasDiabetesContext`, etc.) never fires and no health skills load.

### Performance & Reliability

- **CRITICAL: Never block UI rendering on database operations.** In `useChat.ts`, `setMessages()` must run IMMEDIATELY after parsing the API response. Database saves and `claimConversation()` must be fire-and-forget (`.then()/.catch()`, not `await`). Blocking causes the "Thinking..." spinner to hang indefinitely even when the API returns 200.
- **CRITICAL: Server route creates conversations using `query()`, not client-side code.** `route.ts` creates conversations directly via `query()` (RDS), setting `user_id = authUser.userId` at creation time. Never do DB writes in client hooks. `claimConversation()` in `conversation-service.ts` calls `POST /api/conversations/claim` which calls the `claim_conversation()` RDS function with the explicit `p_user_id` param (no `auth.uid()` — RDS has no RLS).
- **CRITICAL: Auth detection pattern — custom DOM event.** Client auth uses `window.dispatchEvent(new CustomEvent('auth-state-change', { detail: user|null }))`. All auth-dependent hooks (`AppHeader`, `useConversationHistory`, `useIdleTimeout`) listen to this event via `addEventListener('auth-state-change', handler)`. Rules:
  1. **`useAuth.ts` dispatches on verify success and signOut.** On mount, call `GET /api/profile` to restore session from httpOnly cookie — do NOT block UI on this.
  2. **Set UI state immediately, then fetch DB data non-blocking.** `setBasicAuth()` sets email+userId+isLoading=false instantly; `loadProfileData()` enhances with plan/trial/MFA afterward.
  3. **No direct DB calls from client.** All data flows through API routes → Cognito + RDS.
  - **DO:** `window.addEventListener('auth-state-change', (e) => { const user = (e as CustomEvent).detail; ... })`
  - **DON'T:** Any direct DB calls from client components — always go through `/api/*` routes
- **Timeout guards on pre-Claude async calls**: `route.ts` uses `withFallback()` for RDS queries before the Claude API call: profile/plan lookup at 5s (falls back to trial-level limits), `getUnreportedOutcome` at 5s, `buildSystemPromptWithLearning` at 10s. Falls back to defaults on timeout instead of blocking.
- **AbortController for Claude API**: `withTimeout()` in `claude.ts` uses `AbortController` to truly cancel hung requests (not just `Promise.race`). 60s per iteration for Sonnet, 120s for Opus.
- **CRITICAL: `src/middleware.ts` refreshes Cognito tokens.** On every request, middleware calls `POST /api/auth/refresh` if `access_token` cookie is expired, then sets fresh cookies. Prevents 401s mid-session. Without it, expired access tokens cause all API routes to return 401 silently. **Transient failure resilience**: refresh route returns 503 (not 401) when Cognito is unreachable, preserving cookies so the session auto-recovers. Middleware treats 503 and network errors as transient — user stays on the page instead of being redirected to landing.
- **CRITICAL: Never call RDS from client-side code.** All data access goes through API routes. Pattern: client calls `fetch("/api/route", { credentials: "include" })` → server route calls `getAuthUser(request)` + `query()` → returns JSON. Examples: `useConversationHistory` → `/api/conversations`, `useHealthData` → `/api/fhir/data`, `useAuth` → `/api/profile`, `loadConversation()` → `/api/conversations/[id]`.
- **Client-side timeout**: `useChat.ts` wraps `fetch()` with a 330s `AbortController` to prevent infinite hangs on the client.
- **CRITICAL: SSR-safe hooks must initialize with server-matching values.** `useOnlineStatus` must use `useState(true)` — NOT `useState(typeof navigator !== "undefined" ? navigator.onLine : true)`. The latter reads `navigator.onLine` on the client during hydration, which may return `false` (flaky connection, SW cached page), causing React hydration mismatch (#418) because the server rendered `null` but the client renders a div.
- **All AI calls route through Bedrock in production.** ECS has no `ANTHROPIC_API_KEY` → `getClaudeClient()` returns `AnthropicBedrock` (IAM auth). Chat model resolves per the `modelOverride` precedence (`chat/route.ts:596`): appeals → Opus 4.6 (`global.anthropic.claude-opus-4-6-v1`); free-tier trial users → Haiku 4.5 (`global.anthropic.claude-haiku-4-5-20251001-v1:0`); paid users → Sonnet 4.6 (`global.anthropic.claude-sonnet-4-6`). Non-chat-route callers (`health-report.ts`, `diabetes-insights.ts`) use `getClaudeClient()` directly and resolve to whatever `API_CONFIG.claude.model` is (Sonnet by default). Bedrock model access is auto-enabled (no manual activation needed); controlled via IAM policies on `denali-ecs-task-role`. MCP servers were fully replaced by local tool executors calling public government APIs directly — no data leaves AWS for AI processing.

### Commit conventions

- **CRITICAL: Never include the literal substring `[skip ci]` anywhere in a commit message — including inside negation phrases like "NO `[skip ci]`".** GitHub Actions matches the substring anywhere in the body and silently skips CI. Use phrasings like "deploy enabled" or "no skip marker" instead. The skip-CI directive belongs only in commit titles, as a deliberate directive.
  - Lesson: 2026-05-25 develop→main merge skipped CI due to "NO [skip ci]" in the commit body; recovery via `gh workflow run deploy.yml --ref main`. Second occurrence in this work stream (also B.18 on 2026-05-18). See `docs/reference/merge-patterns.md` § 5 for the full pattern.

---

## Archived files (not in use)

The following files exist in the repo but are NOT wired up to any
code path. They were originally deleted by f855322/da87818
(pre-demo security hardening) and have been preserved as
commented-out archival references with NOT-IN-USE banners.
Do not modify or wire up without team review.

- `app/email-templates/otp-magic-link.html` — OTP email template, archived 2026-05-11
- `terms_privacy.md` — root terms/privacy markdown source, archived 2026-05-11

To inspect original content: `git show origin/main~1:<path>` (where `origin/main~1` is before the archival commit), or check the file contents directly — the original body is preserved inside the HTML comment block.

---

## Scheduled cleanup scripts

`scripts/delete-squash-backup-2026-05-26.sh` is a one-shot launchd-fired
cleanup tied to a specific date (2026-06-25). It deletes the
`backup/develop-pre-squash-2026-05-26` branch (local + origin), drops
the corresponding Claude memory entry, self-unloads from launchd, and
removes its own plist — true one-shot, no recurrence.

Paired plist: `~/Library/LaunchAgents/health.denali.backup-cleanup.plist`
(intentionally **not** committed — machine-local, recreated by hand if
needed; the plist body is small and the script comments show its content).

**Re-test the script's logic anytime without destructive side effects:**

```bash
DRY_RUN=1 bash scripts/delete-squash-backup-2026-05-26.sh
```

The `DRY_RUN` flag stubs every destructive command (`git branch -D`,
`git push --delete`, `rm`, `launchctl`) with `DRY-RUN would run:`
echoes and keeps output on the terminal instead of redirecting to
`/tmp/denali-backup-cleanup.log`. Use it to verify that the SHA
defensive check still passes and the deletion logic would fire
correctly before the scheduled date.

**Policy — future one-shot scheduled scripts should be kept
*untracked*.** They self-delete on first fire and have no recurring
use; committing them adds long-term repo noise. This one is committed
as a documented reference for the pattern (launchd plist +
`do_or_dry` wrapper + SHA-defensive deletion + memory-entry cleanup).
After 2026-06-25 fires, `git rm` this file too.

---

## Known test accounts on prod

Three trial users currently exist on prod RDS — two operator-owned admin/test accounts plus one additional operator-known trial account. There are zero paying customers and zero unknown end-user accounts:

- `ramanac@gmail.com` — operator (Venkata) personal account; `users.plan='trial'`, `is_admin=TRUE`, `is_on_medicare=NULL` (post-Chunk-2 — cleared by 2026-05-28 migration so the operator exercises the interstitial path on next sign-in)
- `ceeveear@yahoo.com` — operator secondary test account; `users.plan='trial'`, `is_admin=FALSE`, `is_on_medicare=true` (post-Chunk-2 — set by 2026-05-28 migration so the operator exercises the Medicare-bypass path)
- One additional operator-known trial account; identifying details intentionally omitted from this public doc. `users.plan='trial'`, `is_admin=FALSE`, `created_at=2026-05-26`. Pre-existing `is_on_medicare=false` (Stage-1 default) carried through the 2026-05-28 migration untouched. Post-Chunk-2 cohort path: middleware redirects to `/onboarding/medicare`, page sees `is_on_medicare=false` (not null) and bounces to `/app/chat` with the non-Medicare cohort UX. Non-Medicare trial window (3 days from `created_at`) runs ~2026-05-29.

All three have one `subscriptions` row each, auto-created by `verify-otp` from their last sign-in (plan='trial', status='trialing', no `stripe_customer_id`). Clean trial state — ready to exercise the Stripe Live upgrade flow.

**Post-Chunk-3 cohort path (2026-06-02 onward):** All three accounts have `sex_at_birth = null` and `gender_identity = null` (newly-added columns, no backfill). All three lack the `sex_at_birth_status` cookie, so they will hit the 3-question onboarding interstitial on their next `/app/*` navigation. Intentional — they pick up the new gate as they return, same pattern as Chunk 2's interstitial rollout. Staging-side V1 verification on 2026-06-02 confirmed ramanac's row updated to `sex_at_birth='male', gender_identity=null` after completing the interstitial.

### History (2026-05-12 cleanup)

Six operator/test accounts were deleted from prod RDS on 2026-05-12 to clear stale pre-Live-mode Stripe customer ID references that were blocking real paid-flow verification: `matthew.kail@id.me`, `ramanac+a@gmail.com`, `ramanac+b@gmail.com`, `ramanac+kk@gmail.com`, `ramanac+zz@gmail.com`, `admin@myguide.health`.

Atomic single-transaction DELETE:
- 15 FK CASCADE child tables auto-cleaned (subscriptions, alert_preferences, consent_preferences, conversations, diabetes_*, ehr_connections, fhir_cache, health_reports, etc.)
- 4 FK SET NULL tables anonymized rows for HIPAA retention: `audit_logs` (76 rows), `usage` (6), `appeals` (4), `user_feedback` (0)

Pre-cleanup, ramanac and ceeveear were also reset to trial state (subscription rows deleted, `users.plan` reverted to 'trial') to remove their stale test-mode `stripe_customer_id` values, which had been causing the Customer Portal endpoint to 500 with "No such customer" in live Stripe. Migration scripts on develop that include backfill UPDATEs targeting `ramanac@gmail.com` / `ceeveear@yahoo.com` must still be stripped before any prod application (see `scripts/migrate-*-prod.sql` for the pattern).

### Gmail+ normalization

`normalizeEmail()` in `app/src/lib/normalize-email.ts` has been applied at signup since well before the 2026-05-03 CMS launch. It trims Gmail plus-tag addresses to the base inbox: any `ramanac+anything@gmail.com` is routed to `ramanac@gmail.com`. One Gmail inbox cannot create multiple Denali accounts. The legacy `ramanac+a/+b/+kk/+zz` rows that pre-dated this enforcement were deleted in the 2026-05-12 prod cleanup pass.

---

## Key Files (summary)

Most-touched files during coding sessions:

**Backend / API:** `src/app/api/chat/route.ts` (rate-limit → skills → Claude → persist), `src/app/api/profile/route.ts`, `src/app/api/auth/*` (Cognito send-otp/verify-otp/refresh/signout), `src/middleware.ts` (JWT validation + silent refresh).

**Claude integration:** `src/lib/claude.ts` (client + tool-use loop + SessionState), `src/lib/skills-loader.ts`, `src/lib/tools/index.ts` (16 local tool executors), `src/lib/skills/*` and `src/skills/*`.

**Data layer:** `src/lib/db.ts` (RDS pool, `query`/`transaction` helpers), `src/lib/auth-server.ts` (`getAuthUser()`), `src/lib/audit.ts` (fire-and-forget + write-side dedup), `scripts/migrate-*.sql` (run manually in order).

**FHIR / Blue Button:** `src/lib/fhir/` (crypto, tokens, transforms, context, sync, eob-clinical, snapshots), `src/lib/health-report.ts`.

**Stripe & payments:** `src/lib/stripe-fulfillment.ts`, `src/components/payment/PaywallModal.tsx`.

**Frontend (most edited):** `src/app/app/page.tsx` (dashboard), `src/app/app/chat/page.tsx` (sign-in gate + consent banner + paywall intercept), `src/components/layout/AppHeader.tsx` (auth-aware), `src/components/landing/LandingFooter.tsx` (import directly in `"use client"` components, NOT from barrel — barrel pulls `pg` into client bundle), `src/hooks/useAuth.ts` (`auth-state-change` custom event), `src/hooks/useHealthData.ts`, `src/hooks/useConsent.ts`.

**Offline / PWA:** `src/lib/offline-cache.ts` (IndexedDB wrapper, 6 stores), `src/lib/offline-sync.ts`, `public/sw.js`.

**See [docs/reference/key-files.md](docs/reference/key-files.md)** for the comprehensive file map (every route, every hook, every component) and full behavioral notes per file.

---


## Architecture

```
User (Chat UI) ──> Claude Agent (Brain) ──> Tools (APIs + RDS)
                          │
                          v
                    RDS PostgreSQL (Memory)
                    Cognito (Auth/Sessions)
```

Frontend is dumb (renders what Claude returns); all intelligence in Claude + skills + tools. Domain skills via tool calling in `/api/chat`, NOT separate edge functions. Tools interchangeable. **Auth** = Cognito + httpOnly cookies. **DB** = RDS via `query()`. No browser SDK.

**See [docs/reference/architecture.md](docs/reference/architecture.md)** for Tool System internals, SessionState fields, population sources.


## Tools & Data Sources

16 local tool executors handled by `processToolCalls()` in chat loop. Government API tools call free public endpoints with generic search terms — no patient data sent. MCP servers replaced by local executors 2026-03-04.

- **Government APIs**: ICD-10 (NLM), LCD/NCD (CMS), NPI (NPPES)
- **Local**: CPT mapping, prior auth, preventive, SAD list, PubMed, appeal-letter generator
- **RDS-backed**: CARC/RARC lookup, denial patterns

Inventory: ICD-10 Full, CPT dev-only, NPI Full, NCD/LCD Full, PubMed Full, CARC 90 codes, RARC 195 codes, 1,873 EOB mappings (versioned by `effective_date`).

**See [docs/reference/tools.md](docs/reference/tools.md)** for the full tool table + data inventory.

## Database Schema (summary)

PostgreSQL 16.9 on RDS. **RDS has no Row-Level Security** — legacy "RLS:" notes in the reference file are pre-AWS Supabase-era; current code uses explicit `WHERE user_id = $1` clauses. Server routes use `query()` from `@/lib/db`.

### Core tables (one-liners)

- `users` — auth + plan (`trial`/`starter`/`plus`/`unlimited`, CHECK constraint), `is_admin` (bypass all limits)
- `user_verification` — OTP + ID.me status (ID.me deprecated 2026-04-21, columns retained)
- `subscriptions` — plan + Stripe customer ID + trial dates
- `usage` — appeal count + appeal credits per email
- `conversations`, `messages` — chat history
- `appeals` — generated appeal letters with `carc_codes TEXT[]`, `rarc_codes TEXT[]`
- `audit_logs` — CMS audit trail. **Append-only**: `denali_admin` only has INSERT+SELECT (UPDATE/DELETE/TRUNCATE revoked 2026-04-10). Write-side dedup on `FHIR_DATA_ACCESS` within 2h window
- `consent_preferences` — three toggles (`health_data_ai`, `health_data_storage`, `analytics`). Versioned, audit-logged
- `ehr_connections` — Blue Button OAuth tokens (AES-256-GCM encrypted)
- `fhir_cache` — transformed FHIR data, 24h TTL, deleted on disconnect
- `diabetes_snapshots` — append-only longitudinal labs, unique on `(user_id, loinc_code, observed_date)`
- `diabetes_log`, `diabetes_insights`, `chat_daily_usage`, `health_reports`, `blog_posts`, `user_topic_preferences`, `user_feedback`

### Denial code tables (CMS-sourced, versioned)

`carc_codes` (90), `rarc_codes` (195), `eob_denial_mappings` (1,873), `denial_patterns` (12), `appeal_levels` (5).

**Versioning rule (load-bearing):** All five tables have an `effective_date` column. Views `*_latest` always return `WHERE effective_date = MAX(effective_date)`. Insert new rows with newer date; old rows stay for history. **Never UPDATE or DELETE existing rows.**

### Learning tables (no user link, anonymized)

`symptom_mappings`, `procedure_mappings`, `coverage_paths`, `conversation_patterns`, `appeal_outcomes`, `policy_cache`, `user_events`, `learning_queue`.

### Key functions

`check_and_increment_chat`, `check_weekly_frequency`, `decrement_appeal_credit`, `add_appeal_credits`, `reset_monthly_appeal_credits`, `process_feedback`, `record_appeal_outcome`, `get_grouped_audit_logs`, `delete_user_cascade` (also exists as 11-step inline cascade in `account/delete/route.ts`).

**See [docs/reference/db-schema.md](docs/reference/db-schema.md)** for full per-column commentary, all 18+ function signatures, indexes, CHECK constraints, seed migration list.

---

## Skills & Prompt System (summary)

Skills are conditional prompt sections loaded by `skills-loader.ts` based on `SkillTriggers` detected in `route.ts`. `buildSystemPromptWithLearning()` calls the loader and injects learned context.

### Skill loading order (load-bearing — early gates prevent later skills)

| Priority | Trigger | Skill | Notes |
|---|---|---|---|
| 1 | Emergency symptoms | RED_FLAG_SKILL | Overrides all |
| 2 | Missing name/ZIP | ONBOARDING + TOOL_RESTRAINT | No tool calls allowed |
| 3 | Has procedure, missing symptoms | SYMPTOM_GATHERING + TOOL_RESTRAINT | No tool calls allowed |
| 4 | Symptoms but no provider | PROVIDER_VERIFICATION | NPI tools only |
| 5 | Has procedure / clarification | PROCEDURE_SKILL | Disambiguate |
| 6 | Procedure/coverage/appeal | CODE_VALIDATION | ICD-10↔CPT + PA + preventive + SAD |
| 7 | Coverage, not all reqs verified | REQUIREMENT_VERIFICATION | Ask 1 at a time |
| 8 | Specialty mismatch | SPECIALTY_VALIDATION | Warn about ordering risk |
| 9 | Coverage + `verificationComplete` | GUIDANCE_DELIVERY | Proactive checklist |
| 10 | Appeal detected | APPEAL_SKILL | MA-aware |
| 11 | EOB question + health data | EOB_EXPLAINER_SKILL | Plain-English claim explainer |

### Load-bearing rules

**TOOL_RESTRAINT** (priorities 2–3): forbids all tool calls during onboarding and symptom gathering. **Requirement Verification Pipeline** (7→9): Claude MUST emit `[REQUIREMENTS]` block after coverage lookup; GUIDANCE_DELIVERY only loads when `verificationComplete === true` (never on empty requirements — vacuous truth fix).

### Contextual skills (data-dependent)

`HEALTH_RECORDS_SKILL`, `MEDICARE_NOTIFICATIONS_SKILL`, `DIABETES_PREVENTION_SKILL` (urgent A1C: ≥12% contact doctor, ≥14% DKA warning), `OBESITY_PREVENTION_SKILL`, `EOB_EXPLAINER_SKILL`, `OUTCOME_PROMPTING_SKILL`, `COUNSELOR_SKILL` / `PROVIDER_PILOT_SKILL` (role-based).

Base prompt always loaded: identity & mission, conversation rules (one question, brief, explain why), error handling.

**See [docs/reference/skills.md](docs/reference/skills.md)** for full priority table with gate-behavior detail.

---


## Orchestration Flows

5 end-to-end flows. Claude follows these sequences depending on user intent.

1. **Coverage Guidance** (proactive denial prevention): intake → NPI verify → ICD-10/CPT + PA/preventive/SAD → LCD/NCD → requirement Q&A → `get_common_denials` → personalized checklist
2. **Appeal** (reactive): `lookup_denial_code` FIRST → details → ICD-10/CPT → coverage → `generate_appeal_letter` → PAYWALL GATE
3. **Quick Denial Code Lookup**: single `lookup_denial_code` call
4. **Coverage→Appeal Bridge**: returning user, reuse `sessionState`
5. **EOB Explainer**: regex trigger + `hasHealthData`, no tools

Medicare Advantage branching: when `sessionState.medicareType === "advantage"`, appeal uses "Request for Reconsideration" semantics + 42 CFR §422 references.

**See [docs/reference/orchestration.md](docs/reference/orchestration.md)** for full per-flow detail.

## Business Model, Auth & Payments (summary)

### Pricing

| Plan | Price | Appeals/30d | Chat/Day | Weekly | Auth |
|---|---|---|---|---|---|
| Trial (14 days) | $0 | 0 | 10 | 1 day/wk | Email OTP |
| Expired | — | — | 0 (locked) | — | Email OTP |
| Starter | $10 one-time | 1 credit | 20 | 1 day/wk | Email OTP |
| Plus | $20/mo | 2 credits | 20 | every day | Email OTP |
| Unlimited | $60/mo | unlimited | unlimited | unlimited | Email OTP |
| **Admin** | — | unlimited | unlimited | unlimited | `users.is_admin = TRUE` |

**Sign-in required for all chat.** Gmail plus normalization (`user+tag@gmail.com` → `user@gmail.com`) via `normalizeEmail()`. Every signup auto-creates 14-day trial inline in `verify-otp`. **Starter is one-time pay-per-claim**; **Plus and Unlimited are monthly subscriptions**. Appeal access credit-based via `usage.appeal_credits`; `unlimited` bypasses credit check.

Chat rate limiting: `check_weekly_frequency` + `check_and_increment_chat`. Returns 401 `AUTH_REQUIRED`, 429 `WEEKLY_LIMIT`/`RATE_LIMITED`, 403 `TRIAL_EXPIRED`. Admin bypasses both.

**AI model**: Haiku 4.5 for free-tier trial chat (Chunk 2.5a, landed prod 2026-06-02); Sonnet 4.6 for paid-plan chat; Opus 4.6 for appeal letters regardless of plan.

### Appeal gating logic

User requests appeal letter → check email: not verified = signup wall; verified+unlimited = generate (no credit); verified+credits>0 = generate, decrement, increment count; verified+credits=0 = show paywall.

### AAL2 (CMS A1 / NIST 800-63B)

**Blue Button OAuth via Medicare.gov satisfies IAL2/AAL2.** ID.me **DEPRECATED 2026-04-21** — NOT REQUIRED per CMS. `REQUIRE_IDENTITY_VERIFICATION=false` permanently.

### Stripe (critical rules)

- **`checkout/route.ts` MUST use `getAuthUser()`** — auth required so `fulfillCheckoutSession()` can look up the user.
- **Never return `{ url: null }` from checkout** — would grant free access. Return 503 when Stripe not configured.
- **Stripe SDK v20**: `current_period_end` lives on `subscription.items.data[0]`, NOT on `subscription`.
- **`fulfillCheckoutSession()` is idempotent**.
- Webhook events: `checkout.session.completed` → fulfill; `customer.subscription.*` → sync; `invoice.payment_failed` → marks `past_due`.

**See [docs/reference/business-model.md](docs/reference/business-model.md)** for full pricing narrative, Stripe architecture, env vars, ECS gotchas, AWS resource inventory.

---


## Infrastructure Architecture

**Prod**: cluster `denali` / service `denali-web` / RDS `denali-prod` / https://denali.health  
**Staging**: cluster `denali-staging` / service `denali-staging-web` / RDS `denali-staging` (split from prod 2026-04-23) / https://staging.denali.health

- **ECR lifecycle**: prod-stable never expires; SHA tags keep last 5 (tightened from 10 on 2026-06-10); untagged 1 day. Staging keeps last 10.
- **IAM (split 2026-04-23)**: `denali-prod-deploy-role` (refs/heads/main only), `denali-staging-deploy-role` (refs/heads/develop only).
- **Prod alarms** → `denali-prod-alerts` SNS: `healthy-hosts-below-1` (ALB HealthyHostCount; replaced `ecs-running-below-desired` 2026-06-10 when Container Insights was disabled on both clusters), `alb-5xx-rate-high` (>5%/5min, volume gate at 20 req), `ecs-task-failed-to-start`.
- **Cost schedule (2026-06-10)**: prod up 8:55am–10pm CT weekdays only (weekends off; manual start: `aws lambda invoke --invocation-type Event --function-name denali-startup /tmp/out.json`); staging up 8:55am–11pm CT every day. RDS backup windows must stay INSIDE running hours — stopped instances take no automated backups, and an overlapping window once made prod RDS silently skip its nightly stop. Schedule changes go through `infra/cfn-scheduler.json` + `deploy-scheduler.sh` (prod rules are CFN-managed; raw `put-rule` drifts the stack). Details: `docs/reference/infrastructure.md`.
- **Protected**: `prod-stable` tag is rollback floor. Docker base + GitHub Actions both SHA-pinned.
- **CloudWatch retention**: app log groups 30 days. Audit logs separate, 6-year HIPAA retention in RDS.
- **Terraform IaC (staging)**: foundation in `infra/staging/`. S3 backend, `use_lockfile = true`.
- **Tool integration**: MCP servers replaced by local executors 2026-03-04 — no third-party intermediary receives patient data.

**See [docs/reference/infrastructure.md](docs/reference/infrastructure.md)** for full AWS inventory.

## Blue Button 2.0 (summary)

Blue Button is the **only** external health data source. Connects patients to their Medicare claims via FHIR APIs.

### Environment routing — load-bearing

Prod and staging point at **different CMS environments** and use **different CMS-issued credentials**. No automatic promotion path; staging stays on sandbox indefinitely.

| Env | Secrets Manager | `BLUEBUTTON_BASE_URL` | `BLUEBUTTON_CALLBACK_URL` |
|---|---|---|---|
| Prod | `denali/prod/app` | `https://api.bluebutton.cms.gov` | *(empty — host detection)* |
| Staging | `denali/staging/app` | `https://sandbox.bluebutton.cms.gov` | `https://staging.denali.health/api/fhir/callback` |

`FHIR_TOKEN_ENCRYPTION_KEY` independent of CMS rotation. Prod credentials rotated 2026-05-01 (CMS access granted 2026-04-29).

### Data availability — load-bearing constraints

- ✅ Medicare claims, denials, what was billed/paid
- ❌ **Actual lab values (A1C, glucose) are NOT available** — only that the lab was performed (CPT code on claim). `diabetes_snapshots` stores procedure dates, not values.
- ❌ Vitals (BP, weight, BMI), immunizations, clinical notes
- ⚠️ Conditions inferred from EOB ICD-10 codes only
- ⚠️ Medications: Part D claims only (no dosing, prescriber)

### OAuth + consent (PKCE)

`GET /api/fhir/authorize` generates state + code_verifier, sets httpOnly cookies (10 min TTL), redirects to CMS. Callback validates state, exchanges code, encrypts tokens (AES-256-GCM via `FHIR_TOKEN_ENCRYPTION_KEY`), upserts `ehr_connections`.

Scopes: `patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read profile openid`. Tokens auto-refresh via `refreshAccessToken()` in `lib/fhir/tokens.ts`.

**Consent gate**: when `consent.health_data_ai` is OFF, client strips ALL health fields before sending to server. Server-side `buildHealthContextForPrompt()` uses `!== true` allow-list pattern.

### EOB extraction + condition severity

Since Blue Button doesn't provide Observation/Condition/MedicationRequest resources, we mine claims data via 8 functions in `eob-clinical.ts` (`extractConditions`, `extractMedications`, `extractScreenings`, `extractProviders`, `extractHospitalizations`, `extractDME`, `extractPatientWeight`, `detectHospiceStatus` — hospice **SAFETY** gate suppresses risk alerts). `fhir_cache` stores 11 resource types (24h TTL).

Condition severity (DiagnosisSummaryCard): structured `category` → 21 RED keywords (cancer, stroke, heart failure) → 27 AMBER keywords (hypertension, COPD) → gray.

**See [docs/reference/blue-button.md](docs/reference/blue-button.md)** for full PKCE sequence, all 8 extractors with input/output detail, transformEOB enrichment, full keyword lists.

---

## UI/UX Guidelines (summary)

### Principles

- Minimal interface, mobile-first (Medicare patients on phones/tablets)
- No forms, no dropdowns, no medical jargon
- 16px min body text, 44×44px touch targets, screen-reader compatible

### Layout

- **AppHeader** (`src/components/layout/AppHeader.tsx`): universal, root layout. Auth-aware via `auth-state-change` event. Sign In → `/app/settings` (email OTP).
- **LandingFooter** (`src/components/landing/LandingFooter.tsx`): used across ALL pages. **CRITICAL**: in `"use client"` components, import directly — NOT from barrel `"@/components/landing"` (barrel pulls `pg` into client bundle).
- **BottomTabs** (`src/components/layout/BottomTabs.tsx`): mobile only on `/app/*` — Home, Health, Ask Denali, Settings.
- **Health Hub** (`/app/app/health`): 7 collapsible accordion cards with status dots (red/amber/green) computed via `computeCardStatuses()`.

### Theme tokens

Warm medical reference palette, applied across entire app. CSS variables — never hardcode colors.

- Light: `--bg-primary: #FEFCF8`, `--text-primary: #2C1810`, `--accent-primary: #C26A3E` (warm amber)
- Dark: `--bg-primary: #1A1612`, `--accent-primary: #D4845A`
- `--brand-purple: #7c3aed` for "Health" text in logo
- Fonts: Instrument Serif (headings) + DM Sans (body) + monospace (prices/step labels)

**See `docs/reference/ui.md`** for full landing page
component breakdown, icon list, typography sizing,
section background alternation, and accessibility detail.
---

## PWA Offline & Low-Bandwidth (summary)

Designed for rural Medicare patients on spotty connections. Caches API responses in IndexedDB, queues writes for replay on reconnect, network-aware UI. Dependency: `idb` (~1KB gzipped). No Workbox.

### Key strategies

| Pattern | Strategy |
|---|---|
| `/api/chat`, `/api/fhir/authorize|callback`, `/api/checkout`, `/api/webhooks/*` | Network-only |
| `/api/conversations`, `/api/fhir/data`, `/api/profile`, diabetes GETs | Network-first → cache fallback |
| Navigation | Network-first → cached page → `/offline` |
| Static assets | Cache-first |

`public/sw.js`, plain JS. `CACHE_VERSION = "v3"` — bump on deploy.

### Load-bearing rules

- **CRITICAL: clone responses synchronously in SW caching strategies.** `response.clone()` MUST happen BEFORE any async `caches.open().then()` — otherwise the body may be consumed by the client first, causing "Response body is already used" TypeError.
- **CRITICAL: never `await` IndexedDB writes before `setState()`.** Fire-and-forget pattern `setState() → cacheSet()`. Blocking causes UI hangs.
- **`sw.js` excluded from middleware matcher** (`sw\\.js` in regex).
- **HIPAA inactivity timeout** (`useIdleTimeout`): warn at 27 min, sign out at 30 min. Auth-gated only.

### IndexedDB

`denali-offline-cache` v1, 6 stores: `conversations`, `health-data`, `diabetes-log`, `diabetes-insights`, `profile`, `offline-queue`. TTLs: profile 4h, others 24h. All ops try/catch guarded.

### Offline write queue

Only diabetes log POSTs are queued. On reconnect: `window` `online` event → `sw.postMessage({type:"SYNC_QUEUE"})` → SW replays from IndexedDB, drops after 3 retries. Chat is online-only by design.

**See `docs/reference/pwa.md`** for full URL→strategy table,
all 6 store schemas, queue flow detail, hook integration
pattern table, and the "what's NOT offline" list.
---


## Coding Standards

**Modular** · **props-driven** · **separation of concerns** · **DRY**.

Project structure: `src/app/api/` (routes), `src/app/app/` (shell), `src/components/`, `src/hooks/`, `src/lib/` (core libs + fhir/ + skills/ + tools/), `src/config/`, `src/types/`, `src/styles/`.

Domain skills via Claude tool calling in `/api/chat`, NOT separate edge functions. Background/async tasks (email checklists, learning queue) via API routes. Legacy Supabase edge functions removed.

**See [docs/reference/coding-standards.md](docs/reference/coding-standards.md)** for full principles + project tree + background-task pattern.

## Testing (summary)

**Frameworks:** Vitest (unit), Playwright (E2E), tsc (types).

Commands: `npx vitest run` (575 unit tests), `npm run test:coverage`, `npx playwright test` (212 E2E tests / 44 spec files), `npx tsc --noEmit`.

### Unit coverage targets (per-file thresholds)

Global floor: 33% stmts / 32% branch / 33% lines / 29% functions. Critical files enforced via `@vitest/coverage-v8`:
- `claude.ts`, `chat/route.ts` — 65–85% (extraction pipeline, tool loop)
- `middleware.ts`, `auth/refresh/route.ts`, `health/route.ts` — 100% (every-request guards)
- `auth-server.ts`, `stripe-fulfillment.ts`, `account/delete/route.ts` — 95–100% (auth, financial, GDPR)
- `fhir/crypto.ts`, `fhir/context.ts`, `fhir/transforms.ts` — 45–100% (PII, consent, encryption)
- `eob-clinical.ts`, `learning.ts`, `rate-limiter.ts` — 60–95%

### Critical patterns

- **Route handler tests**: mock `getAuthUser` and `query()` via `vi.mock()`; import the route and call directly with `new Request()`.
- **SSE mocks (E2E)**: `text/event-stream` with `event: delta\ndata: {...}\n\n` + `event: done\ndata: {...}\n\n`; trailing `\n\n` required.
- **Auth in E2E**: `page.context().addCookies([{name:"access_token", value:"fake", domain:"localhost", path:"/"}])` before `/app/*`.
- **Mock the right shape**: `/api/profile` MUST include `userId`. `/api/conversations` returns `{authenticated, conversations: [...]}` not flat array.
- **Test isolation**: use `test.use({ serviceWorkers: "block" })` when SW caching contaminates runs.

### Security tests (load-bearing)

- **XSS**: `parseMarkdown()` / `parseTable()` in `MarkdownContent.tsx` MUST escape `&`, `<`, `>` before any bold/inline processing.
- **Spoofing**: unauth requests to `/api/conversations`, `/api/profile`, `/api/consent`, `/api/diabetes/log` MUST return 401 or `{authenticated: false}` empty shape.
- **Payment**: `/api/checkout` MUST require auth + Stripe key. Webhook MUST verify signature.
- **Consent**: PUT `/api/consent` MUST require auth.

**See [docs/reference/testing.md](docs/reference/testing.md)** for full E2E spec inventory, per-test descriptions, mocking helpers, coverage assessment, lessons learned.

---


## Learning System

5 layers persisted across conversations: Language (`symptom_mappings`, `procedure_mappings`), Clinical (`coverage_paths`, `appeal_outcomes`), Conversation (`conversation_patterns`), Policy (`policy_cache`), User Behavior (`user_events`).

Triggers: every message extracts entities + queues mapping updates; thumbs-up reinforces (+0.1); thumbs-down penalizes (-0.15); appeal generation stores coverage path; outcome reports update success/failure; nightly batch processes queue.

`persistLearning()` runs non-blocking after every chat response — updates ICD-10/CPT mappings, records coverage paths as pending.

**See [docs/reference/learning-system.md](docs/reference/learning-system.md)** for trigger detail + persistence flow.


## CMS Interoperability Framework

Denali = **Patient-Facing App** in 2 categories: **Conversational AI** + **Diabetes & Obesity Prevention**. Must meet 6 app criteria (A1–A6) + category-specific.

Current status (compressed):
- **A1 Identity/Security**: Blue Button OAuth via Medicare.gov satisfies IAL2/AAL2. ID.me deprecated 2026-04-21 (NOT REQUIRED per CMS).
- **A3–A5 Trial & Discovery**: 14-day trial, `/api/cms-metadata`, `CmsPledge` component.
- **AWS BAA executed 2026-02-25** (RDS, ECS, Bedrock, Cognito, SES). Audit log append-only REVOKE applied 2026-04-10.

Remaining gaps: HITRUST (P0), CMS security self-assessment (P0), Medicare.gov notification bridge (P1), CMS review submission (P1), CMS app directory (P1), FHIR USCDI v3 (P2 — July 2026 mandate).

**See [docs/reference/cms-framework.md](docs/reference/cms-framework.md)** for full criteria table + key dates + gap detail.

