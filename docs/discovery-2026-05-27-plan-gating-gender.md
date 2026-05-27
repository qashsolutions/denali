# Discovery: plan-gating + gender capture (2026-05-27)

Read-only inventory pass on `develop` ahead of two related changes: refining plan-gating around non-Medicare users, and introducing gender capture. No code modified.

## Branch state

Clean, fully in sync. No divergence to flag.

- `git status` — clean (only untracked `Denali-a16z.pdf` and `deck/`, both unrelated).
- `HEAD`, `develop`, `main`, `origin/develop`, `origin/main` all at `1c7ba84b2935dd1f13ec7a9106d461154532e2fb`.
- `git fetch origin` produced no output (nothing to pull).

Develop and main are in sync as expected post this morning's merge. Safe to proceed.

## Schema state

**Migrations live in two places:**
- `/Users/cvr/dev/denali/sql/001-schema.sql` — full base schema dump (pg_dump style; 2867 lines)
- `/Users/cvr/dev/denali/scripts/migrate-*.sql` — additive incremental migrations applied manually in order
- `/Users/cvr/dev/denali/app/scripts/migrate-idme*.sql` — two ID.me-era migrations (now deprecated)

No `migrations/`, `db/migrations/`, or `scripts/migrations/` directories exist.

**Reconstructed `users` table columns (in load-order):**

From `sql/001-schema.sql` lines 1315–1338 (base):
- `id uuid NOT NULL` (PK)
- `phone text`
- `email text NOT NULL` (UNIQUE)
- `plan text DEFAULT 'trial' NOT NULL` (CHECK: trial/starter/plus/unlimited)
- `theme text DEFAULT 'auto'` (CHECK: auto/light/dark)
- `notifications_enabled boolean DEFAULT true`
- `text_size real DEFAULT 1.0` (CHECK: 0.8–1.5)
- `high_contrast boolean DEFAULT false`
- `reduce_motion boolean DEFAULT false`
- `autoplay_media boolean DEFAULT true`
- `voiceover_optimization boolean DEFAULT false`
- `created_at timestamptz DEFAULT now() NOT NULL`
- `updated_at timestamptz DEFAULT now() NOT NULL`
- `role text DEFAULT 'patient' NOT NULL` (CHECK: patient/counselor/provider)
- `organization text`
- `counselor_state text`
- `counselor_id text`
- `is_admin boolean DEFAULT false NOT NULL`

Added by `scripts/migrate-user-prerequisites.sql` (Stage 1):
- `birth_year integer` (nullable)
- `is_on_medicare boolean NOT NULL DEFAULT false`
- Plus the **backfill**: `UPDATE users SET is_on_medicare = true WHERE id IN (SELECT user_id FROM ehr_connections WHERE provider = 'blue_button' AND status = 'active')` — one-time, no ongoing trigger

Added by `scripts/migrate-birth-year-modal-cadence.sql` (Stage 1.C):
- `birth_year_modal_dismissed_at timestamp` (nullable)
- `birth_year_modal_disabled boolean NOT NULL DEFAULT false`

**`user_conditions` table — confirmed it exists.** Created in `scripts/migrate-user-prerequisites.sql` lines 34–61:
- `id uuid PK DEFAULT gen_random_uuid()`
- `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `condition_code text NOT NULL`
- `condition_category text NOT NULL` (CHECK: prediabetes/type1/type2/obesity/hypertension/dyslipidemia/ckd/cvd/depression)
- `source text NOT NULL` (CHECK: claims/self_reported/ehr)
- `started_at timestamptz NOT NULL DEFAULT now()`
- `ended_at timestamptz` (nullable; NULL = active)
- `confidence numeric(3,2)`
- `created_at`, `updated_at timestamptz NOT NULL DEFAULT now()`
- UNIQUE `(user_id, condition_category, started_at)`
- Indexes on `(user_id, condition_category)` and on `(user_id) WHERE ended_at IS NULL`

Migration comment notes: "Populated by Stage 9 extractors, not here." So today the table exists but is unwritten by the live app (Stage 9 not shipped).

**Gender / sex columns — positive confirmation of absence.**

`grep -in "gender\|sex_" sql/001-schema.sql scripts/*.sql` returns exactly one hit:
```
sql/001-schema.sql:1712:    idme_gender text
```
This is on the `user_verification` table (deprecated ID.me column block — `idme_verified`, `idme_uuid`, `idme_first_name`, `idme_gender`). Per CLAUDE.md, ID.me has been deprecated since 2026-04-21; columns are retained but no new writes occur.

**There is no `gender` or `sex_*` column on `users`, `user_conditions`, or any other table.** The `idme_gender` column does NOT serve as a general-purpose gender field — it is captured only by the ID.me OAuth callback (now dormant) and surfaced read-only as `authState.gender` (see Onboarding section below).

## Onboarding flow

**Modal file:** `/Users/cvr/dev/denali/app/src/components/profile/ProfileCompletionModal.tsx`

**Fields captured (in order):** ONLY `birth_year` — single 4-digit text input (lines 152–176). No `is_on_medicare` field, no gender field, no anything else.

**Three actions:**
1. **Save** → `await onSave(birthYear)` → parent calls `PATCH /api/profile` with `{ birth_year }`
2. **Not now** → `POST /api/profile/birth-year-reminder/dismiss` → sets `birth_year_modal_dismissed_at = now()` → 7-day cooldown
3. **Don't show this again** → `POST /api/profile/birth-year-reminder/disable` → sets `birth_year_modal_disabled = true` permanently

Parent (`/Users/cvr/dev/denali/app/src/app/app/layout.tsx`) owns the API calls and uses a session-only `completionDismissed` fast-path so the modal closes immediately while server writes are in flight (lines 12, 19–20).

**Profile-cadence library:** `/Users/cvr/dev/denali/app/src/lib/profile-cadence.ts`

Single pure function `canShowBirthYearModal(authState)` returning boolean. Eligibility = authed + `birthYear === null` + `!birthYearModalDisabled` + (never dismissed OR last dismissal >=7 days ago). 7-day cooldown via `COOLDOWN_DAYS = 7`. Fails open on malformed timestamps.

Tests at `/Users/cvr/dev/denali/app/src/lib/__tests__/profile-cadence.test.ts`.

**Where is `is_on_medicare` set today? (Critical question — answered.)**

Four code paths exist; none is the modal:

1. **DB default = `false`** on signup. Migration sets `NOT NULL DEFAULT false`, so every signup creates a user with `is_on_medicare = false` regardless of any sign-up flow.

2. **One-time backfill in the Stage 1 migration** (`scripts/migrate-user-prerequisites.sql` lines 66–72): set `true` for users with an active `ehr_connections` row at the moment the migration ran. This is a snapshot, not a trigger — new BB connections do NOT flip the bit.

3. **Settings page toggle** in `/Users/cvr/dev/denali/app/src/app/app/settings/page.tsx` lines 133–149 and 597–606. Labelled "I'm enrolled in Medicare", calls `PATCH /api/profile` with `{ is_on_medicare: boolean }`.

4. **Profile API allowlist** in `/Users/cvr/dev/denali/app/src/app/api/profile/route.ts` lines 110, 145–156. `is_on_medicare` is one of two allowed PATCH keys.

**Important gap:** there is NO code path that flips `is_on_medicare = true` when a user completes Blue Button OAuth. Greps of `app/src/app/api/fhir/` and `app/src/lib/fhir/` for `is_on_medicare` return zero hits. So a user who signed up after the Stage 1 migration ran and connected Blue Button still has `is_on_medicare = false` unless they manually flip the Settings toggle. This is almost certainly a bug from the user's perspective.

## Skill router

**Router file:** `/Users/cvr/dev/denali/app/src/lib/skills-loader-router.ts`

**Branching logic (lines 33–56):**

```ts
export function buildSystemPromptForUser(triggers, sessionState?) {
  if (sessionState?.isOnMedicare === false) {
    return buildSystemPromptForNonMedicare(triggers, sessionState);
  }
  return buildSystemPrompt(triggers, sessionState);
}
```

Triple-state semantics: `false` → non-Medicare loader; `true | null | undefined` → Medicare loader (default-safe). Same pattern for the `WithLearning` async variant.

**Non-Medicare path — what it returns TODAY** (`/Users/cvr/dev/denali/app/src/lib/skills-loader-non-medicare.ts`):

Not a stub. Returns a real composed prompt:
1. `BASE_CORE_PROMPT` (from `/Users/cvr/dev/denali/app/src/skills/core/base-core.ts`) — cohort-agnostic identity/tone, but the source file itself notes (lines 11–15) that it still contains Medicare-flavored examples and the identity line says `"Users: Medicare patients & caregivers"`.
2. `NON_MEDICARE_ACKNOWLEDGMENT_SKILL` (from `/Users/cvr/dev/denali/app/src/lib/skills/non-medicare-acknowledgment.ts`) — explicit overlay telling the model the user is not on Medicare, with six behavioral rules ("don't cite Medicare-specific benefits", "appeals: stay general", "don't recommend connecting Medicare claims", "if they say they're on Medicare mid-conversation, suggest updating Settings").
3. `COUNSELOR_SKILL` if `triggers.isCounselor`
4. `PROVIDER_PILOT_SKILL` if `triggers.isProvider`
5. `RED_FLAG_SKILL` + `PROMPTING_SKILL` if `hasEmergencySymptoms` (early return)
6. `PROMPTING_SKILL` (always — for `[SUGGESTIONS]` block emission)

**Explicitly suppressed** (per the source comment block lines 9–30): all Medicare-specific skills — HEALTH_RECORDS, DIABETES_PREVENTION, OBESITY_PREVENTION, MEDICARE_NOTIFICATIONS, MEDICARE_TYPE, MEDICARE_ADVANTAGE, APPEAL, EOB_EXPLAINER, COVERAGE, REQUIREMENT_VERIFICATION, GUIDANCE, PRIOR_AUTH, CODE_VALIDATION, PROVIDER, OUTCOME_PROMPTING, ONBOARDING, SYMPTOM, PROCEDURE, SPECIALTY_VALIDATION, TOOL_RESTRAINT, and all flow-state helpers. `buildHealthContextForPrompt` is also not called.

The `WithLearning` async variant just delegates to the sync version — non-Medicare doesn't query the Medicare-specific learning DB.

**Verdict:** "Stubby" is a fair characterization in the sense that the cohort-specific skill catalog is essentially empty (one acknowledgment overlay), but the wiring is real and behavior is meaningfully different from the Medicare path. The product question is whether the acknowledgment + base-core combo is enough value to justify keeping non-Medicare users in the app at all.

## Medicare-gated route inventory

Walked `/Users/cvr/dev/denali/app/src/app/api/`. Grouped:

**Medicare-only (should be gated server-side; today they are NOT):**
- `/api/fhir/authorize` — Blue Button OAuth start
- `/api/fhir/callback` — OAuth completion
- `/api/fhir/data` — read cached EOB/Coverage/Patient
- `/api/fhir/disconnect`
- `/api/health-report/*` — generate, email, PDF, share (7 routes total under this tree). Medicare-claims-derived report.
- `/api/appeals` (GET) — list appeal letters for a conversation
- `/api/appeal-outcome` — record approve/deny outcome (Medicare appeal flywheel)
- `/api/diabetes/log`, `/api/diabetes/insights`, `/api/diabetes/snapshots` — diabetes longitudinal data; today the diabetes module is Medicare-cohort-specific (DSMT/MDPP/Part D framing) even though the underlying log is user-entered. Worth confirming with the user.
- `/api/email/checklist` — Medicare email checklist sender
- `/api/alerts/preferences`, `/api/alerts/process` — Medicare update email alerts

None of these check `is_on_medicare` today (`grep -rn is_on_medicare app/src/app/api/fhir/ app/src/app/api/health-report/ app/src/app/api/appeals/ app/src/app/api/appeal-outcome/ app/src/app/api/diabetes/` returns zero hits).

**Universal (correctly cohort-agnostic):**
- `/api/auth/*` — OTP send/verify/refresh/signout, MFA, ID.me (deprecated)
- `/api/profile`, `/api/profile/birth-year-reminder/*`
- `/api/consent`
- `/api/conversations`, `/api/conversations/[id]`, `/api/conversations/claim`
- `/api/chat` — does branch internally via skill router; route itself is universal
- `/api/account/delete`
- `/api/checkout`, `/api/billing-portal`, `/api/webhooks/stripe`
- `/api/health` — liveness probe
- `/api/audit-log`
- `/api/feedback`
- `/api/preferences/topics`
- `/api/cms-metadata`
- `/api/admin/*`, `/api/counselor/*`, `/api/block-scanner`, `/api/events`, `/api/trial`

**Unclear / mixed:**
- `/api/appeals` (GET) — currently returns Medicare appeal letters; for a non-Medicare user it would return `{ appeals: [] }` because they have none. Behaviorally inert but conceptually Medicare-flavored.
- `/api/feedback` — universal in the form sense, but if it's tied to a Medicare conversation it's downstream of Medicare-specific output.

## Pricing UI surfaces

**Source of truth:** `/Users/cvr/dev/denali/app/src/config/pricing.ts` — exports `PRICING` const with STARTER ($10/mo, 1 credit), PLUS ($20/mo, 2 credits), UNLIMITED ($60/mo, unlimited credits). All three are monthly subscriptions (CLAUDE.md describes Starter as "one-time pay-per-claim" but the code says `label: "per month"` — a doc/code drift worth surfacing).

**UI surfaces displaying pricing:**
1. `/Users/cvr/dev/denali/app/src/components/landing/LandingPricing.tsx` lines 14–69 — 4-card grid on the landing page (Trial / Starter / Plus / Unlimited). Hardcoded dollar strings ("$10", "$20", "$60"), NOT pulled from `PRICING` const. Drift risk.
2. `/Users/cvr/dev/denali/app/src/components/payment/PaywallModal.tsx` lines 31, 43, 55 — uses `PRICING.STARTER.amount` etc.
3. `/Users/cvr/dev/denali/app/src/app/app/settings/page.tsx` lines 638–642 — current-plan strings in Subscription section, uses `formatPrice(PRICING.X.amount)`.
4. `/Users/cvr/dev/denali/app/src/app/terms/page.tsx` lines 87–89 — terms-of-service prose, hardcoded.
5. `/Users/cvr/dev/denali/app/src/app/faq/page.tsx` lines 70, 74, 78 — FAQ answers, hardcoded.

**Routes users hit to see pricing:**
- `/` (landing) — `LandingPricing` rendered as a marketing section
- `/app/settings` — subscription card + paywall modal
- `/app/chat` — paywall modal triggered when appeal-credit gate fires (`/Users/cvr/dev/denali/app/src/app/app/chat/page.tsx` lines 279, 292)
- `/terms`, `/faq` — prose

**Stripe checkout entry points:**
- Server route: `/Users/cvr/dev/denali/app/src/app/api/checkout/route.ts`
- Client triggers: `<PaywallModal>` (`onSuccess` → redirects to `/app/chat?payment=success`); also the Settings "Upgrade" button and the appeal credit exhaustion path in chat
- Webhook handler: `/Users/cvr/dev/denali/app/src/app/api/webhooks/stripe/route.ts` (via `lib/stripe-fulfillment.ts`)
- Billing portal: `/Users/cvr/dev/denali/app/src/app/api/billing-portal/route.ts`
- `<AppealGate>` component (`/Users/cvr/dev/denali/app/src/components/appeal/AppealGate.tsx`) — gates `/api/checkout` invocation for appeal generation

## Settings page

**File:** `/Users/cvr/dev/denali/app/src/app/app/settings/page.tsx` (1240 lines, single file).

**Sections (in render order):**
1. **Account** (lines 202–526) — email, sign-in/sign-out, ID.me identity verification (currently shown only when `requireIdentityVerification === true` OR `isIdmeVerified === true`; TOTP block commented out).
2. **Profile** (Stage 1.C) (lines 528–609) — year-of-birth input + Save, reminder toggle ("Remind me to add my year of birth"), Medicare toggle ("I'm enrolled in Medicare").
3. **Subscription** (lines 611–718) — plan summary, Manage Subscription (Stripe portal), Upgrade.
4. **Appearance** (lines 720–744) — light/dark theme.
5. **Accessibility** (lines 746–778) — text size scale.
6. **Content Preferences** (lines 780–835) — blog topic chips (max 2).
7. **Email Alerts** (lines 837–897) — alert toggles with eligibility gating (Plus/Unlimited only).
8. **Privacy & Data** (lines 924–952) — three consent toggles (health_data_ai, health_data_storage, analytics).
9. **Data Access History** (lines 954–1010) — audit log (last 3 expanding to all).
10. **Danger Zone** (lines 1012–1085) — delete account.
11. **Reset to Defaults** button (lines 1087–1098).

**Positive confirmations:**
- No `gender` editable field. (`authState.gender` exists in the `useAuth` interface line 17, sourced read-only from `idme_gender`, but is not rendered anywhere I found in the settings page or any UI surface.)
- `is_on_medicare` is shown today, as the "I'm enrolled in Medicare" toggle (line 600). This is the ONE place a user can change it.

## Non-Medicare current UX

End-to-end trace for a user with `is_on_medicare = false`:

**Setup:** All new signups land here. The DB default is `false`, the OTP verify path does not touch this column, and there is no Blue Button completion handler that flips it (confirmed: no `is_on_medicare` references in `app/src/app/api/fhir/`). So unless the migration backfill caught them in Stage 1, every new user starts non-Medicare.

**Login → first screen:**
- Middleware (`app/src/middleware.ts`) refreshes Cognito tokens; doesn't branch on `is_on_medicare`.
- Layout (`app/src/app/app/layout.tsx`) renders `<main>` + `<BottomTabs>` + the birth-year modal if eligible. No is_on_medicare branching.
- The landing-page CTAs go to `/app/chat` or `/app` regardless of cohort.

**Chat (`/app/chat`):**
- `/api/chat` route ([chat/route.ts line 345](app/src/app/api/chat/route.ts)) reads `is_on_medicare` from RDS and sets `sessionState.isOnMedicare = userProfile?.is_on_medicare ?? false`.
- The skill router (`skills-loader-router.ts` line 37) sees `=== false` and delegates to `buildSystemPromptForNonMedicare`.
- The model gets `BASE_CORE_PROMPT` (which still says "Users: Medicare patients & caregivers" in its Identity block — minor leak) + the `NON_MEDICARE_ACKNOWLEDGMENT_SKILL` overlay + suggestion/red-flag skills.
- The model is instructed not to cite Medicare-specific benefits, to defer coverage questions to the user's actual insurer, and not to generate Medicare-formatted appeal letters.
- Tool calling still works (tools like `search_icd10`, `lookup_denial_code`, etc. don't check Medicare cohort), but the suppressed `APPEAL_SKILL`, `CODE_VALIDATION_SKILL`, etc. means the model has no system-prompt guidance to invoke them. Whether the model actually does so on a non-Medicare path is undefined behavior.

**Health page (`/app/health`):** No is_on_medicare gate. The page assumes Blue Button → claims data. For a non-Medicare user, the data is empty, and the page renders whatever empty-state the underlying cards compute. **This is a UX dead end — the entire Health Hub is a Medicare-only construct.**

**Dashboard (`/app/`):** No is_on_medicare gate. Pulls from `useHealthData` (Medicare-derived). Same dead-end as Health.

**Diabetes (`/app/diabetes`):** No gate. The diabetes log is user-entered and would technically work for any user, but framing is Medicare-flavored (DSMT/MDPP/Part D).

**Claims (`/app/claims`):** No gate. Medicare-only by definition (Blue Button EOB).

**Settings:** Works correctly for non-Medicare users — they can find the Medicare toggle and switch on.

**Appeal generation:** Routes through chat (no separate gating). Appeal skill is suppressed in the non-Medicare prompt, but the underlying `generate_appeal_letter` tool, paywall, and credit-decrement code paths don't check `is_on_medicare`. A non-Medicare user with a credit could in theory request and trigger an appeal letter — the model would produce a Medicare-shaped letter despite the system prompt telling it not to. Unclear-behavior territory.

**Email alerts (Phase 7 list item):** All alert types are Medicare-flavored. A non-Medicare user on Plus/Unlimited could opt in, then receive emails framed around Medicare deadlines/denials. Not gated.

**Net assessment (the most important paragraph in this report):**
Today, `is_on_medicare = false` produces meaningful behavior change in exactly ONE place: the chat system prompt. Every other UI surface — Health, Dashboard, Diabetes, Claims, Email Alerts, Appeal generation, Health Reports — assumes Medicare and renders Medicare-shaped UI/data/output to non-Medicare users. The chat-only gating is a partial implementation. A non-Medicare user who lands on `/app/health` or `/app/` sees Medicare scaffolding (empty Medicare data widgets) with no acknowledgment that the app isn't built for them.

There is also an inverse bug: a real Medicare user who connects Blue Button does NOT get `is_on_medicare` flipped to `true` automatically. They get the non-Medicare prompt despite having connected Medicare claims, because the FHIR callback path doesn't touch the column. Only the one-time migration backfill set the flag for users who were connected before Stage 1 ran; everyone since has been silently misclassified unless they found the Settings toggle.

## Test baseline

`npx vitest run` from `app/`:

```
Test Files  32 passed (32)
Tests       721 passed (721)
Duration    5.44s
```

Matches the expected baseline. Zero failures, zero skips.

**Test files most relevant to this work:**
- `app/src/lib/__tests__/skills-loader-router.test.ts` — router branching matrix (true/false/null/undefined × sync/async)
- `app/src/lib/__tests__/skills-loader-non-medicare.test.ts` — non-Medicare loader skill suppression and presence
- `app/src/lib/__tests__/profile-cadence.test.ts` — `canShowBirthYearModal` purity + cooldown math
- `app/src/app/api/profile/birth-year-reminder/{disable,dismiss,enable}/__tests__/route.test.ts` — three endpoint route tests
- `app/src/app/api/chat/__tests__/route.test.ts` — chat route (the one place is_on_medicare is read on each request)
- `app/src/config/__tests__/pricing.test.ts` — pricing constants
- `app/src/lib/__tests__/stripe-fulfillment.test.ts` — paywall fulfillment
- `app/src/lib/__tests__/auth-server.test.ts`, `auth-server-cognito.test.ts` — auth
- `app/src/__tests__/middleware.test.ts` — middleware (token refresh, no cohort branching)
- `app/src/app/api/consent/__tests__/route.test.ts` — consent toggle endpoint

No tests directly exercise the non-Medicare end-to-end UX path on the Health/Dashboard/Diabetes pages (because those pages don't currently branch).

## Decisions surfaced (questions we now need to answer)

1. **Non-Medicare scope: serve them or redirect them?** Should a `is_on_medicare = false` user see a stripped-down chat-only experience, get redirected to a "we're not built for you yet" waitlist page, or be blocked at signup with a "do you have Medicare?" gate? Today the answer is "served base-core-plus-acknowledgment skills in chat and Medicare-shaped UI everywhere else" — almost certainly not intended.

2. **Auto-flip `is_on_medicare = true` on Blue Button OAuth success?** Currently no. This is asymmetric: the Stage 1 migration backfilled it, but no live code path maintains it. Probably a clear "yes, add this" — but worth confirming because of the implication that the Settings toggle could be auto-reverted if Blue Button disconnects.

3. **First-time capture point for `is_on_medicare`.** The modal only captures birth year. Should it also ask "Are you on Medicare?" Or should this be an explicit second modal step? Or a separate onboarding screen? Or only captured implicitly via Blue Button connect / Settings toggle? The current state — DB default false, never prompted — is the worst of all worlds for new users.

4. **Should non-Medicare users see pricing at all?** The landing page shows Medicare-flavored pricing tiers (with "appeal letters", "Medicare guidance", "Email alerts for Medicare updates"). A non-Medicare user who pays would be getting almost nothing they can use. Hide pricing post-login when `is_on_medicare = false`? Show a different paywall ("Medicare-only feature")?

5. **Medicare-gated server routes — gate now or wait?** Today `/api/fhir/*`, `/api/health-report/*`, `/api/appeal-outcome`, `/api/diabetes/*`, `/api/email/checklist`, `/api/alerts/*` will all happily serve a `is_on_medicare = false` user. Some are inert in practice (no data → empty response), but `/api/fhir/authorize` would still initiate a Blue Button OAuth flow for a user who has explicitly said they're not on Medicare. Server-side gate at the route handlers?

6. **Gender capture — where, when, why?** Three distinct decisions:
   - **Why:** clinical context for the chat model (informs symptom interpretation, screening recommendations), or display personalization, or both?
   - **Where to capture:** signup, profile modal alongside birth year, Settings only?
   - **Where to store:** new `users.gender` column (or `users.sex_at_birth`), or extend `user_verification` beyond ID.me? The existing `idme_gender` column is on `user_verification` and only writeable via deprecated ID.me OAuth — repurposing it for self-entered values mixes concerns.

7. **Gender taxonomy.** Free text? `male/female/other`? `male/female/non-binary/prefer-not-to-say`? Sex-at-birth versus gender identity (clinically these differ)? CMS-aligned options? Privacy-policy implication: gender adds a demographic field that may need disclosure under the existing "Do NOT store…" guardrails in CLAUDE.md (which lists "Full names, dates of birth, addresses, SSN, insurance IDs, medical records" — gender is conspicuously absent and probably needs to be explicitly addressed).

8. **Profile cadence library reuse.** If gender is captured via a second modal, do we want a generic `canShowProfileModal(authState, fieldName)` instead of duplicating `canShowBirthYearModal` per field? Or does each field deserve its own cadence settings (disable/dismiss columns × field count)?

9. **The base-core prompt leak.** `BASE_CORE_PROMPT` line 21 says `"Users: Medicare patients & caregivers (often elderly, may be stressed)"`. This loads on the non-Medicare path too. Should base-core be made truly cohort-agnostic, or should the acknowledgment overlay continue to over-correct?

10. **CHAT.md / Stripe drift on Starter.** CLAUDE.md describes Starter as "one-time pay-per-claim" but `config/pricing.ts` defines it as `$10/month`. Worth confirming the intended model before plan-gating refinements.

11. **Should existing trial users who never toggled the Medicare switch get a one-time prompt to identify themselves?** All existing users on develop+main today are `is_on_medicare = false` unless they predated Stage 1 and had an active BB connection. This is most likely a misclassification for the operator test accounts (ramanac, ceeveear).

## Confidence: high

Reasoning: branch state is exactly as expected (matching SHAs across all five refs); test baseline matches the predicted 721 passing; the four most load-bearing files (router, modal, profile route, cadence library) are short enough that I read them in full rather than skim; all "positive confirmations" (no gender column, no `is_on_medicare` writes outside profile route + migration) were verified with greps rather than absence-of-finding. The two areas where my interpretation is the load-bearing claim — (a) "non-Medicare gating is chat-only" and (b) "Blue Button success doesn't flip is_on_medicare" — are both backed by zero-hit greps across the relevant route trees, which is as strong as evidence gets for "this code path does not exist."

Areas where I have lower confidence and the user may want to verify:
- Whether the diabetes log + insights pages have any Medicare-shaped behavior at runtime that I missed by not running them.
- Whether there's any cron / background job (not in `app/src/app/api/`) that writes `is_on_medicare`. I searched `app/scripts/` and `scripts/` and did not find one, but did not exhaustively walk `/Users/cvr/dev/denali/app/` outside `src/`.
