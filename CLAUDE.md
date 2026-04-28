# Denali.health

<!-- CLAUDE.md — Project instructions for Claude Code (the coding assistant).
     This file is auto-loaded into every Claude Code context window.
     Keep it accurate to the ACTUAL codebase, not aspirational.
     Last updated: 2026-03-24 (Gmail plus address normalization; trial fix inline DB; 143 unit tests across 8 files; 212 E2E tests across 44 files)
     Maintainer: @cvr
-->

<!-- ✅ AWS MIGRATION COMPLETE (branch: aws-migration) — Last updated: 2026-03-03
     Phase 1 ✅ All server-side API routes + libs → RDS (query()) + Cognito (getAuthUser())
     Phase 2 ✅ Client-side auth → /api/auth/* routes + custom 'auth-state-change' event
     Phase 2b ✅ conversation-service.ts + useDiabetesSnapshots → API routes + query()
     Phase 3  ⬜ MCP tools → local (ICD-10, CMS Coverage, NPI) — post-deploy
     DEPLOYED: ECS task def :33 (commit e361fe7) running on denali.health
     DNS: Route 53 (migrated from GoDaddy 2026-03-03). NS: ns-1637/ns-463/ns-1270/ns-847
     DOMAIN ROUTING:
       www.denali.health / denali.health → AWS ALB → ECS Fargate (production)
       staging.denali.health → AWS ALB → ECS Fargate (same ALB, same ECS for now)
       stage.denali.health → Vercel staging (DO NOT USE)
     Auth pattern: getAuthUser() from lib/auth-server.ts (reads Cognito httpOnly cookie)
     DB pattern: query() from lib/db.ts (pg pool → RDS PostgreSQL)
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
* AI: Claude Sonnet 4.6 (chat) + Opus 4.6 (appeals) via AWS Bedrock
* Auth: AWS Cognito + SES (OTP, HttpOnly cookies, 30-min HIPAA timeout)
* Payments: Stripe (test mode until CMS production approval)
* Email: AWS SES (BAA signed Feb 25, 2026)
* Data Sources: Blue Button 2.0 API (FHIR R4), ICD-10, CPT, NPI Registry, NCD/LCD, SAD list, PubMed
* Payer: Original Medicare (Medicare Advantage support in appeal letters)
* Infrastructure: AWS VPC, ECS Fargate, RDS, Secrets Manager, CloudWatch, EventBridge
* CMS Status: Production access demo scheduled, 20/20 checklist items verified

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

### Guardrails

- **Never give medical advice** — only Medicare coverage guidance
- **Never show codes to user** — translate ICD-10, CPT, CARC/RARC to plain English
- **Never ask user for codes** — translate from plain English
- Always end with an actionable next step
- Ask one clarifying question at a time
- Acknowledge what the user said before moving on

### Prompt Rules

- **CRITICAL: Never hardcode MCP tool names in system prompts.** Claude discovers MCP tools dynamically. Use action descriptions instead.
  - DO: "Look up ICD-10 diagnosis codes for the symptoms"
  - DON'T: "Call search_icd10 to find codes"
  - WHY: MCP tool names are determined by the server. Hardcoding causes Claude to call non-existent local tools.
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
- **All AI calls route through Bedrock in production.** ECS has no `ANTHROPIC_API_KEY` → `getClaudeClient()` returns `AnthropicBedrock` (IAM auth). Chat uses Sonnet 4.6 (`global.anthropic.claude-sonnet-4-6`); appeals use Opus 4.6 (`global.anthropic.claude-opus-4-6-v1`). Both `claude.ts` and `diabetes-insights.ts` use `getClaudeClient()`. Bedrock model access is auto-enabled (no manual activation needed); controlled via IAM policies on `denali-ecs-task-role`. MCP servers were fully replaced by local tool executors calling public government APIs directly — no data leaves AWS for AI processing.

---

## Key Files (summary)

Most-touched files during coding sessions:

**Backend / API:**
- `src/app/api/chat/route.ts` — main chat endpoint (rate-limit → skills → Claude → persist)
- `src/app/api/profile/route.ts` — user profile GET/PATCH
- `src/app/api/auth/*` — Cognito-backed auth endpoints (send-otp, verify-otp, refresh, signout)
- `src/middleware.ts` — Cognito JWT validation, session lifetime, silent refresh

**Claude integration:**
- `src/lib/claude.ts` — Claude client, tool-use loop, SessionState
- `src/lib/skills-loader.ts` — conditional system-prompt builder
- `src/lib/tools/index.ts` — 12 local tool executors
- `src/lib/skills/*` and `src/skills/*` — per-skill prompt sections

**Data layer:**
- `src/lib/db.ts` — RDS pool (`query`, `transaction` helpers)
- `src/lib/auth-server.ts` — `getAuthUser()` server-side auth helper
- `src/lib/audit.ts` — audit logging (fire-and-forget, write-side dedup)
- `scripts/migrate-*.sql` / `scripts/migrate-*.js` — schema migrations (run manually in order)

**FHIR / Blue Button:**
- `src/lib/fhir/` — Blue Button library (crypto, tokens, transforms, context, sync, eob-clinical, snapshots)
- `src/lib/health-report.ts` — Claude-powered health summary report generation

**Stripe & payments:**
- `src/lib/stripe-fulfillment.ts` — checkout fulfillment + subscription lifecycle
- `src/components/payment/PaywallModal.tsx` — paywall UI

**Frontend (most edited):**
- `src/app/app/page.tsx` — authenticated dashboard home
- `src/app/app/chat/page.tsx` — chat page (sign-in gate, consent banner, paywall intercept)
- `src/components/layout/AppHeader.tsx` — universal header (auth-aware)
- `src/components/landing/LandingFooter.tsx` — shared footer (import directly, NOT from barrel, in `"use client"` components)
- `src/hooks/useAuth.ts` — auth state via `auth-state-change` custom event
- `src/hooks/useHealthData.ts` — Blue Button data fetch + IndexedDB cache
- `src/hooks/useConsent.ts` — consent toggles (3 enforcement points)

**Offline / PWA:**
- `src/lib/offline-cache.ts` — IndexedDB wrapper (6 stores)
- `src/lib/offline-sync.ts` — queue replay
- `public/sw.js` — service worker

**See `docs/reference/key-files.md`** for the comprehensive
file map (every route, every hook, every component) and full
behavioral notes per file.
---

## Architecture

```
User (Chat UI) ──> Claude Agent (Brain) ──> Tools (APIs + RDS)
                          │
                          v
                    RDS PostgreSQL (Memory)
                    Cognito (Auth/Sessions)
```

- **Frontend is dumb** — just renders what Claude returns
- All intelligence lives in Claude + skills + tools
- Domain skills are implemented via Claude tool calling in `/api/chat`, NOT separate edge functions
- Tools are interchangeable (swap APIs without frontend changes)
- **Auth** = Cognito + httpOnly cookies. **DB** = RDS via `query()`. No browser SDK.

### Tool System

All tools are local executors handled by `processToolCalls()` in the chat loop. Claude requests a `tool_use`, our server executes the function, and returns a `tool_result`. Government API tools (ICD-10, CMS Coverage, NPI) call free public endpoints with generic search terms — no patient data sent. Previously used MCP servers at `mcp.deepsense.ai` (migrated to local executors 2026-03-04).

### Session State

Tracked across the conversation in `SessionState` (defined in `claude.ts`):

```
User-facing (plain English):        Internal (codes, never shown):
  name, ZIP, symptoms, duration        diagnosisCodes (ICD-10)
  priorTreatments, provider            procedureCodes (CPT)
  requirementAnswers                   denialCodes (CARC/RARC)
  redFlags                             coverageCriteria, policyReferences
  maPlanName (from Blue Button)        denialDate, priorAuthRequired
```

**Population sources** — how fields get populated during the chat loop:

| Field               | Populated By                                             | Mechanism                                                                                                                                                  |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnosisCodes`    | MCP `search_icd10` / Local `generate_appeal_letter`      | Regex from Claude text / `updateSessionFromToolResults()`                                                                                                  |
| `procedureCodes`    | Local `search_cpt` / `generate_appeal_letter`            | `updateSessionFromToolResults()`                                                                                                                           |
| `denialCodes`       | Local `lookup_denial_code` / User message                | `updateSessionFromToolResults()` + `extractUserInfo()` regex (CO-50, PR-1, CARC 167, RARC N56 patterns — gated on appeal context to avoid false positives) |
| `policyReferences`  | MCP `search_local_coverage` / `search_national_coverage` | Regex from Claude text (LCD L\d{5}, NCD patterns)                                                                                                          |
| `priorAuthRequired` | Local `check_prior_auth`                                 | `updateSessionFromToolResults()`                                                                                                                           |
| `denialDate`        | User message                                             | `extractUserInfo()` regex                                                                                                                                  |
| `isAppeal`          | User message                                             | `extractUserInfo()` keyword detection                                                                                                                      |
| `maPlanName`        | Blue Button coverage / User message                      | Auto-detected from Part C coverage in `chat/page.tsx` / `extractUserInfo()`                                                                                |

---

## Tools & Data Sources

### Government API Tools (local executors, replaced MCP servers)

These tools are local executors in `tools/index.ts` that call free public government APIs directly. No patient data is sent — only generic search terms. Previously used MCP servers at `mcp.deepsense.ai` (removed 2026-03-04).

| Tool                                                                         | API Endpoint                                                     | Data                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `search_icd10`                                                               | `clinicaltables.nlm.nih.gov/api/icd10cm/v3/search` (NLM, public) | ICD-10 diagnosis codes                   |
| `search_local_coverage`, `search_national_coverage`, `get_coverage_document` | `api.coverage-finder.medicare.gov/api/v1` (CMS, public)          | LCD/NCD coverage policies                |
| `npi_search`, `npi_lookup`                                                   | `npiregistry.cms.hhs.gov/api` (NPPES, public)                    | Provider NPI, specialty, Medicare status |

### Other Local Tools (defined in `src/lib/tools/index.ts`)

| Tool                     | Purpose                                                                                                                                                                                                                     | Data Source                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `search_cpt`             | Map procedure descriptions to CPT codes                                                                                                                                                                                     | AMA API (dev only)                                                      |
| `get_related_diagnoses`  | CPT -> related ICD-10 codes                                                                                                                                                                                                 | Local mappings                                                          |
| `get_related_procedures` | ICD-10 -> related CPT codes                                                                                                                                                                                                 | Local mappings                                                          |
| `check_prior_auth`       | Check if CPT requires prior auth (CMS PA Model + expanded list)                                                                                                                                                             | Local rules + CMS PA Model categories                                   |
| `check_preventive`       | Check if service is preventive (no cost-sharing)                                                                                                                                                                            | Local rules                                                             |
| `search_pubmed`          | Clinical evidence search (rate-limited)                                                                                                                                                                                     | NCBI E-utilities                                                        |
| `generate_appeal_letter` | Build appeal letter (Level 1 Redetermination for Original Medicare, Request for Reconsideration for MA) with inline codes + policy refs + PubMed citations. Accepts `medicare_type` and `plan_name` params for MA branching | Combines multiple sources + policy_references + pubmed_citations inputs |
| `check_sad_list`         | Part B (physician) vs Part D (self-administered) drug routing                                                                                                                                                               | CMS SAD list                                                            |
| `lookup_denial_code`     | CARC/RARC code lookup + appeal strategy                                                                                                                                                                                     | RDS `carc_codes`, `rarc_codes`, `eob_denial_mappings`                   |
| `get_common_denials`     | Top denial reasons for a procedure + prevention tips                                                                                                                                                                        | RDS (`denial_patterns` + `carc_codes`)                                  |

### Data Inventory

| Dataset                   | Status                                   | Source                               |
| ------------------------- | ---------------------------------------- | ------------------------------------ |
| ICD-10                    | Full                                     | MCP server                           |
| CPT                       | Dev only (AMA license required for prod) | Local AMA API                        |
| NPI                       | Full                                     | MCP server                           |
| NCD/LCD                   | Full                                     | MCP server                           |
| PubMed                    | Full                                     | NCBI API                             |
| CARC codes                | 90 codes                                 | RDS (from CMS, effective 2025-12-10) |
| RARC codes                | 195 codes                                | RDS (from CMS, effective 2025-12-10) |
| EOB-to-CARC/RARC mappings | 1,873 mappings                           | RDS (from CMS, effective 2025-12-10) |

---

## Database Schema (summary)

PostgreSQL 16.9 on RDS. Note: **RDS has no Row-Level Security** —
the "RLS:" notes in the reference file are legacy text from the
pre-AWS Supabase era; current code uses explicit `WHERE user_id = $1`
clauses. Server routes use `query()` from `@/lib/db`.

### Core tables (one-liners)

- `users` — auth + plan (`trial`/`starter`/`plus`/`unlimited`, CHECK constraint), `is_admin` (bypass all limits), theme/accessibility
- `user_verification` — OTP + ID.me status (ID.me deprecated 2026-04-21, columns retained)
- `subscriptions` — plan + Stripe customer ID + trial dates
- `usage` — appeal count + appeal credits per email
- `conversations`, `messages` — chat history
- `appeals` — generated appeal letters with `carc_codes TEXT[]`, `rarc_codes TEXT[]`
- `user_feedback` — thumbs up/down + corrections
- `audit_logs` — CMS audit trail. **Append-only**: `denali_admin` only has INSERT+SELECT; UPDATE/DELETE/TRUNCATE revoked (2026-04-10). Write-side dedup on `FHIR_DATA_ACCESS` within 2h window
- `consent_preferences` — three toggles (`health_data_ai`, `health_data_storage`, `analytics`). Versioned, audit-logged on change
- `ehr_connections` — Blue Button OAuth tokens (AES-256-GCM encrypted)
- `fhir_cache` — transformed FHIR data, 24h TTL, deleted on disconnect
- `diabetes_snapshots` — append-only longitudinal labs, unique on `(user_id, loinc_code, observed_date)`
- `diabetes_log` — user-entered glucose/activity/meal/note, CHECK on entry_type
- `diabetes_insights` — Claude-generated analysis, hash-based dedup
- `chat_daily_usage` — daily rate limiting per identifier
- `health_reports` — Claude-generated reports, public share via `/report/[token]`, 30-day expiry, cascade-deleted on account deletion
- `blog_posts` — public blog content, idempotent seeds via `ON CONFLICT (slug) DO NOTHING`
- `user_topic_preferences` — content topic selections (max 2)

### Denial code tables (CMS-sourced, versioned)

`carc_codes` (90), `rarc_codes` (195), `eob_denial_mappings` (1,873), `denial_patterns` (12), `appeal_levels` (5).

**Versioning rule (load-bearing):** All five tables have an
`effective_date` column. Views `carc_codes_latest`,
`rarc_codes_latest`, `eob_denial_mappings_latest`,
`denial_patterns_latest`, `appeal_levels_latest` always return
`WHERE effective_date = MAX(effective_date)`. When CMS publishes
updates, insert new rows with a newer `effective_date`; old rows
stay for history. **Never UPDATE or DELETE existing rows.**

### Learning tables (no user link, anonymized)

`symptom_mappings`, `procedure_mappings`, `coverage_paths`,
`conversation_patterns`, `appeal_outcomes`, `policy_cache`,
`user_events`, `learning_queue`.

### Key functions (most-called)

- `check_and_increment_chat(p_identifier, p_daily_limit)` → `{allowed, count}` — atomic daily rate limit
- `check_weekly_frequency(p_identifier, p_max_days)` → `{allowed, days_used}` — weekly day cap (0 = unlimited)
- `decrement_appeal_credit(p_email)` → remaining count (-1 if none); SECURITY DEFINER
- `add_appeal_credits(p_email, p_credits)` / `reset_monthly_appeal_credits(p_email, p_credits)` — Stripe fulfillment
- `process_feedback(message_id, rating, correction)` — feedback + mapping updates
- `record_appeal_outcome(appeal_id, outcome, ...)` — outcome tracking + incentive
- `get_grouped_audit_logs(p_user_id, p_limit, p_offset)` — daily grouping for Settings UI
- `delete_user_cascade(user_id)` — GDPR/CCPA cascade (also exists as 11-step inline cascade in `account/delete/route.ts`)

**See `docs/reference/db-schema.md`** for full per-column
commentary, all 18+ function signatures, indexes, CHECK
constraints, and the seed migration list.
---

## Skills & Prompt System (summary)

Skills are conditional prompt sections loaded by `skills-loader.ts` based on `SkillTriggers` detected in `route.ts`. The function `buildSystemPromptWithLearning()` calls the loader and injects learned context.

### Skill loading order (load-bearing — early gates prevent later skills)

| Priority | Trigger | Skill | Notes |
|---|---|---|---|
| 1 | Emergency symptoms | RED_FLAG_SKILL | Overrides all (chest pain+SOB, DKA, severe hypoglycemia, etc.) |
| 2 | Missing name/ZIP | ONBOARDING | + TOOL_RESTRAINT |
| 3 | Has procedure, missing symptoms/duration | SYMPTOM_GATHERING | + TOOL_RESTRAINT |
| 4 | Symptoms but no provider confirmed | PROVIDER_VERIFICATION | NPI tools only |
| 5 | Has procedure / needs clarification | PROCEDURE_SKILL | Disambiguate |
| 6 | Has procedure/coverage/appeal | CODE_VALIDATION | ICD-10↔CPT + PA + preventive + SAD |
| 7 | Coverage but not all reqs verified | REQUIREMENT_VERIFICATION | Ask 1 at a time |
| 8 | Provider confirmed + specialty mismatch | SPECIALTY_VALIDATION | Warn about ordering risk |
| 9 | Coverage + `verificationComplete === true` | GUIDANCE_DELIVERY | Proactive checklist |
| 10 | Appeal detected | APPEAL_SKILL | MA-aware (Request for Reconsideration) |
| 11 | EOB question + has health data | EOB_EXPLAINER_SKILL | Plain-English claim explainer |

### Load-bearing rules

- **TOOL_RESTRAINT** (priorities 2–3): explicitly forbids all tool calls during onboarding and symptom gathering. Prevents Claude from jumping ahead to code lookups before gathering context.
- **Requirement Verification Pipeline** (priorities 7→9): Claude MUST emit a `[REQUIREMENTS]` block after coverage lookup. Without it, verification cannot proceed. GUIDANCE_DELIVERY (priority 9) only loads when `verificationComplete === true` — **never on empty requirements** (vacuous truth fix). Three safety mechanisms: flow reminder, explicit skip detection ("skip"/"move on"), implicit skip when user requests guidance directly.

### Contextual skills (data-dependent)

| Skill | File | Trigger |
|---|---|---|
| `HEALTH_RECORDS_SKILL` | `src/lib/skills/health-records.ts` | `hasHealthData` or `hasRecentDenials` |
| `MEDICARE_NOTIFICATIONS_SKILL` | `src/lib/skills/medicare-notifications.ts` | `hasHealthData && hasRecentChanges` |
| `DIABETES_PREVENTION_SKILL` | `src/lib/skills/diabetes-prevention.ts` | `hasDiabetesContext` (urgent A1C: ≥12% contact doctor, ≥14% DKA warning) |
| `OBESITY_PREVENTION_SKILL` | `src/lib/skills/obesity-prevention.ts` | `hasObesityContext` (E66, obesity meds, keywords) |
| `EOB_EXPLAINER_SKILL` | `src/skills/domain/eob-explainer.ts` | `hasEOBQuestion && hasHealthData` |
| `OUTCOME_PROMPTING_SKILL` | `src/skills/domain/outcome-prompting.ts` | `hasUnreportedOutcome` (returning user with pending appeal) |
| `COUNSELOR_SKILL` / `PROVIDER_PILOT_SKILL` | `src/skills/channel/*` | role-based |

### Base prompt (always loaded)

Identity & mission (denial prevention, plain English, empathy) + conversation rules (one question, brief responses, explain why) + error handling.

**See `docs/reference/skills.md`** for the full priority
table with all gate-behavior detail and the original
implementation prose.
---

## Orchestration Flows

How ICD-10, CMS coverage, CARC/RARC, and NPI data come together in end-to-end tool sequences. Claude should follow these sequences when handling each scenario.

### Flow 1: Coverage Guidance (Proactive Denial Prevention)

**Trigger**: User asks about Medicare coverage for a procedure or treatment.

**Goal**: Walk the user through every check needed so the claim does NOT get denied — verifying provider, codes, policy, requirements, and warning about common denial traps before the service happens.

**Tool chain** (6 phases, gated by skill loading order):

1. **Intake** (TOOL_RESTRAINT — no tools): Gather name, ZIP, symptoms, duration, prior treatments, red flags → stored in `sessionState`. Gate: 2a-2c answered before tools unlock.
2. **Provider Verification** (NPI only): `npi_search` by name+ZIP → check Medicare enrollment + specialty match. Non-enrolled = automatic denial. Specialty mismatch = warn + suggest referral. Skippable.
3. **Code Validation** (all tools unlock): `search_icd10` → ICD-10 codes. `search_cpt` → CPT codes. `get_related_diagnoses` → cross-validate. `check_preventive` → no cost-sharing path. `check_prior_auth` → PA required? `check_sad_list` → Part B vs D (drugs only).
4. **Coverage Policy Lookup**: `search_local_coverage` (CPT+ICD-10+ZIP → LCD). `search_national_coverage` (CPT+ICD-10 → NCD). `get_coverage_document` (full policy text). LCD/NCD requirements shown **AS-IS**.
5. **Requirement Verification**: Claude walks through each LCD requirement one at a time, checking user's situation. Stored in `.requirementAnswers`.
6. **Guidance Delivery**: `get_common_denials` (CPT → top CARC reasons + prevention tips). Final output = personalized checklist with policy ref, requirements mapped to user data, denial warnings, provider status.

**Data handoff**: Symptoms → ICD-10+CPT → Provider NPI → PA/preventive/SAD → LCD/NCD policy → Requirements Q&A → Common denials → Personalized checklist.

### Flow 2: Appeal (Reactive Denial Response)

**Trigger**: User mentions a denial, appeal, or denial code.

**Tool chain**: `lookup_denial_code` (FIRST — explains denial in plain English + appeal strategy) → gather denial details (no tools) → `search_icd10` → `search_cpt` → `search_local_coverage` (for letter citations) → `generate_appeal_letter` → PAYWALL GATE (`check_appeal_access`).

**Key rule**: `lookup_denial_code` is the FIRST tool called — it gives Claude enough context to explain the denial before gathering more details.

**MA branching**: When `sessionState.medicareType === "advantage"`, `generate_appeal_letter` is called with `medicare_type: "advantage"` and `plan_name` from `sessionState.maPlanName`. Letter uses "Request for Reconsideration" (not "Level 1 Redetermination"), addresses the plan (not MAC), cites 42 CFR §422.101. MA appeal levels: L1 → plan, L2 → IRE (not QIC, plan auto-forwards per 42 CFR §422.590), L3-5 same as Original Medicare.

### Flows 3–5 (one-liners)

- **Flow 3 — Quick Denial Code Lookup**: single `lookup_denial_code` call → plain-English explanation + offer to appeal.
- **Flow 4 — Coverage→Appeal Bridge**: returning user; reuse `sessionState` → `lookup_denial_code` → `generate_appeal_letter` with minimal new questions.
- **Flow 5 — EOB Explainer**: regex trigger (bill/claim/owe/charged) + `hasHealthData`. No tools — uses `recentClaims` already in prompt. `EOB_EXPLAINER_SKILL` structures: identify claim → what happened → charged → Medicare paid → patient owes → next step.
---

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

**Sign-in required for all chat.** No anonymous access. Gmail plus normalization (`user+tag@gmail.com` → `user@gmail.com`) via `normalizeEmail()` prevents duplicate accounts. Every signup auto-creates 14-day trial inline in `verify-otp`. Plan values are exactly `trial | starter | plus | unlimited`. **Starter is one-time pay-per-claim** ($10 → 1 credit, no recurring); **Plus and Unlimited are monthly subscriptions**. Appeal access credit-based via `usage.appeal_credits`; `unlimited` bypasses credit check.

Chat rate limiting: 2 layers — `check_weekly_frequency` (weekly day cap) + `check_and_increment_chat` (daily). Returns 401 `AUTH_REQUIRED`, 429 `WEEKLY_LIMIT`/`RATE_LIMITED`, 403 `TRIAL_EXPIRED`. Admin bypasses both.

**AI model**: Sonnet 4.6 for chat, Opus 4.6 for appeal letters only.

### Appeal gating logic

```
1. User requests appeal letter
2. Check email:
   - Not verified         → Signup wall (email OTP → auto-trial, 0 credits)
   - Verified + unlimited → Generate letter (no credit tracking)
   - Verified + credits>0 → Generate letter, decrement credit, increment count
   - Verified + credits=0 → Show paywall (Starter/Plus/Unlimited)
3. After payment → Credits added per plan, letter revealed
```

### AAL2 (CMS A1 / NIST 800-63B)

**Current path: Blue Button OAuth via Medicare.gov satisfies IAL2/AAL2.** ID.me path is **DEPRECATED 2026-04-21 — NOT REQUIRED per CMS confirmation.** `REQUIRE_IDENTITY_VERIFICATION=false` permanently in all envs. ID.me code retained pending future removal.

### Stripe (critical rules)

- **`checkout/route.ts` MUST use `getAuthUser()`** — auth required server-side so `fulfillCheckoutSession()` can look up the user.
- **Never return `{ url: null }` from checkout** — that would grant free access. Return 503 when Stripe not configured.
- **Stripe SDK v20**: `current_period_end` lives on `subscription.items.data[0]`, NOT on `subscription`.
- **`fulfillCheckoutSession()` is idempotent** — safe to call multiple times.
- **Known gap (2026-04-20)**: checkout route sets `mode: "subscription"` for all plans; Starter is `one_time` and will fail until route branches on plan.
- Webhook events: `checkout.session.completed` → fulfill + credit reset; `customer.subscription.*` → sync status; `invoice.payment_failed` → marks `past_due`.

**See `docs/reference/business-model.md`** for full pricing
narrative, complete Stripe architecture diagram, all
environment variable definitions, ECS deployment gotchas
(secrets/RDS/audit_logs REVOKE), infra scheduler + monitor
+ alerting tables, and AWS resource inventory with cost
breakdown.
---

## Infrastructure Architecture

> Post-2026-04-23 hardening state. All items below are live ✓.
> See `docs/incidents/2026-04-23-ecr-eviction.md` (postmortem)
> and `docs/runbooks/ecr-eviction-recovery.md` (recovery + all
> verification commands) for rationale and deeper detail.

### AWS resources

**Prod**: cluster `denali` / service `denali-web` / ECR `denali` / RDS `denali-prod.ca5m0qc8e5h8.us-east-1.rds.amazonaws.com` / https://denali.health

**Staging**: cluster `denali-staging` / service `denali-staging-web` / ECR `denali-staging` (split from prod 2026-04-23) / RDS `denali-staging.ca5m0qc8e5h8.us-east-1.rds.amazonaws.com` / https://staging.denali.health

### ECR lifecycle (prod, 5 rules)

1. `prod-stable` tag — never expires (countNumber 9999)
2. Prod SHA tags (hex 0–7 prefix) — keep last 10
3. Prod SHA tags (hex 8–f prefix) — keep last 10
4. `staging-` prefix — keep last 5 (transitional)
5. Untagged — expire after 1 day

Staging repo: `staging-` keep last 10, untagged expire after 1 day.

### IAM (split 2026-04-23)

- `denali-prod-deploy-role` — trusts `refs/heads/main` only, scoped to prod ECR + ECS service
- `denali-staging-deploy-role` — trusts `refs/heads/develop` only, scoped to staging ECR + ECS service
- Legacy `denali-github-actions-role` disarmed (zero permissions); shell retained as rollback target. Policy archived at `docs/runbooks/rollback-artifacts/denali-deploy-policy.json`.

### Prod alarms → `denali-prod-alerts` SNS (admin@denali.health, ramanac@gmail.com)

- `denali-prod-ecs-running-below-desired` — running < desired for 2× 1-min periods (ECS/ContainerInsights)
- `denali-prod-alb-5xx-rate-high` — 5xx > 5% over 5 min, volume gate at 20 req/5min
- `denali-prod-ecs-task-failed-to-start` — EventBridge rule on TaskFailedToStart stopCode

### Protected tags + base image

- **`prod-stable`** is the absolute rollback floor — auto-retagged on every successful prod deploy after ECS stability wait. To roll back: register new task def with `<ECR>/denali:prod-stable`, update service. Commands in runbook.
- **Docker base image digest-pinned** (`node:20-alpine@sha256:fb4cd12c…`). Both staging and prod build against this digest. Updates require deliberate PR.
- **GitHub Actions SHA-pinned** in both deploy workflows. Action tag immutability is advisory; SHA-pinning prevents supply-chain risk.
---

## Blue Button 2.0 (summary)

Blue Button is the **only** external health data source. Connects patients to their Medicare claims via FHIR APIs.

### Data availability — load-bearing constraints

- ✅ Medicare claims, denials, what was billed/paid
- ❌ **Actual lab values (A1C, glucose) are NOT available** — only that the lab was performed (CPT code on claim). `diabetes_snapshots` stores procedure dates, not values.
- ❌ Vitals (BP, weight, BMI), immunizations, clinical notes
- ⚠️ Conditions inferred from EOB ICD-10 codes only (not a formal diagnosis list)
- ⚠️ Medications: Part D claims only (no dosing, prescriber)

### OAuth flow (PKCE)

1. User clicks "Connect Medicare" → `GET /api/fhir/authorize` generates state + code_verifier, sets httpOnly cookies (10 min TTL), redirects to CMS
2. User authorizes on CMS site → redirected to `GET /api/fhir/callback`
3. Callback validates state, exchanges code, encrypts tokens (AES-256-GCM via `FHIR_TOKEN_ENCRYPTION_KEY`), upserts `ehr_connections`

**Scopes**: `patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read profile openid`. **Callback URL** auto-detected from request origin (no `BLUEBUTTON_CALLBACK_URL` env var). Tokens auto-refresh via `refreshAccessToken()` in `lib/fhir/tokens.ts`.

### Health data → AI (consent-gated)

- Client-side `useHealthData()` populates `sessionState`. **Consent gate**: when `consent.health_data_ai` is OFF, `chat/page.tsx` `initialSessionState` returns minimal state (no health fields sent to server). `useChat.ts` overlays latest consent before each API call for mid-session toggle support.
- Server-side `buildHealthContextForPrompt()` in `context.ts` uses `!== true` allow-list pattern (null/undefined never injects health data into Claude).
- 5 health skills load conditionally via triggers: `HEALTH_RECORDS_SKILL`, `EOB_EXPLAINER_SKILL`, `DIABETES_PREVENTION_SKILL`, `OBESITY_PREVENTION_SKILL`, `MEDICARE_NOTIFICATIONS_SKILL`.

### EOB extraction pipeline (8 functions in `eob-clinical.ts`)

Since Blue Button doesn't provide Observation/Condition/MedicationRequest resources, we mine claims data:

`extractConditionsFromClaims`, `extractMedicationsFromClaims` (PDE-enriched: daysSupply/gapDays, dual `isDiabetesMed`/`isObesityMed` flags for GLP-1s), `extractScreeningsFromClaims` (20 CPT codes → 9 screening types), `extractProvidersFromClaims` (NPI aggregation), `extractHospitalizationsFromClaims` (LOS + needsFollowUp), `extractDMEFromClaims` (HCPCS-mapped), `extractPatientWeight`, `detectHospiceStatus` (**SAFETY**: triggers hospice gate in AI prompt + suppresses risk alerts).

`fhir_cache` stores 11 resource types (24h TTL, deleted on disconnect).

### Condition severity (DiagnosisSummaryCard)

Priority chain: structured `category` from `eob-clinical.ts` → 21 RED keywords (cancer, stroke, heart failure, morbid/severe obesity) → 27 AMBER keywords (hypertension, COPD, neuropathy) → gray. `cleanDiagnosisName()` strips U+25CC artifacts.

**See `docs/reference/blue-button.md`** for full PKCE
sequence, all 8 extractors with input/output/key-logic
detail, transformEOB enrichment list, and full keyword
lists.
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

### Principles

- **Modular**: Small, focused units that do one thing well
- **Props-driven**: No hardcoded values, configuration via props/parameters
- **Separation of concerns**: UI, logic, and data access in separate layers
- **DRY**: Extract shared logic into utilities

### Project Structure

```
src/
  app/api/          # API routes (chat, fhir/*, diabetes/*, consent, trial, cms-metadata, account, checkout, webhooks)
  app/app/          # App shell routes (/app, /app/chat, /app/health, /app/diabetes, /app/settings)
  components/
    ui/             # Primitives (Button, Input, Card, Modal, CmsPledge, OfflineBanner)
    chat/           # Chat-specific (Message, ChatInput, Suggestions)
    appeal/         # Appeal-specific (AppealLetter, StatusBadge)
    auth/           # Auth components (EmailOTPModal, TOTPEnrollModal, TOTPChallengeModal)
    layout/         # Layout (AppHeader, BottomTabs, Container)
    health/         # Health page (ConnectMedicare, CoverageCards, DiagnosisSummaryCard, ClaimsTimeline, ProviderSummary, AlertsSection, HealthAlertsBanner, AccountSection, FinancialSummary, AIDisclaimer, StatusBanner, ConditionsAlertBanner, PreDiabetesRiskCard)
    diabetes/       # Diabetes dashboard (A1CTrendChart, ScreeningReminders, RiskAlerts, QuickLog, InsightsCard)
  hooks/            # Custom hooks (useAuth, useChat, useConsent, useHealthData, useDiabetesSnapshots, useDiabetesLog, useDiabetesInsights, useOnlineStatus, useSettings, etc.)
  lib/              # Core libraries (claude.ts, db.ts, auth-server.ts, audit.ts, tools/, skills-loader.ts, denial-patterns.ts, diabetes-insights.ts, offline-cache.ts, offline-sync.ts)
  lib/fhir/         # Blue Button 2.0 (crypto, tokens, client, transforms, context, sync, snapshots)
  lib/skills/       # AI skills injected via skills-loader (health-records, medicare-notifications, diabetes-prevention)
  config/           # Config (api.ts, brand.ts, pricing.ts, ui.ts)
  types/            # TypeScript types (database.ts — RDS schema types)
  styles/           # Global styles + theme
```

### Background Tasks

Domain skills are implemented via Claude tool calling in `/api/chat`, NOT separate functions. Background/async tasks (email checklists, learning queue) are handled by API routes (e.g., `/api/email/checklist`). Legacy Supabase edge functions have been removed.

---

## Testing (summary)

**Frameworks:** Vitest (unit), Playwright (E2E), tsc (types).

### Commands

```bash
cd app
npx vitest run          # 575 unit tests
npm run test:coverage   # Unit + coverage thresholds
npx playwright test     # 212 E2E tests (44 spec files)
npx tsc --noEmit        # Type check
```

### Unit coverage targets (per-file thresholds)

Global floor: 33% stmts / 32% branch / 33% lines / 29% functions. Critical files have higher thresholds enforced by `@vitest/coverage-v8`:

- `claude.ts`, `chat/route.ts` — 65–85% (extraction pipeline, tool loop)
- `middleware.ts`, `auth/refresh/route.ts`, `health/route.ts` — 100% (every-request guards)
- `auth-server.ts`, `stripe-fulfillment.ts`, `account/delete/route.ts` — 95–100% (auth, financial, GDPR)
- `fhir/crypto.ts`, `fhir/context.ts`, `fhir/transforms.ts` — 45–100% (PII boundary, consent gate, encryption)
- `eob-clinical.ts`, `learning.ts`, `rate-limiter.ts` — 60–95% (clinical extraction, learning, throttle)

**Config**: `app/vitest.config.ts` — `@/` alias, includes `src/**/*.test.ts`, excludes `e2e/**`.

### Critical patterns

- **Route handler tests**: Mock `getAuthUser` and `query()` via `vi.mock()`. Import the route function and call directly with `new Request()`.
- **SSE mocks (E2E)**: `text/event-stream` with `event: delta\ndata: {...}\n\n` + `event: done\ndata: {...}\n\n`. Trailing `\n\n` required.
- **Auth in E2E**: `page.context().addCookies([{name:"access_token", value:"fake", domain:"localhost", path:"/"}])` before navigating to `/app/*`.
- **Mock the right shape**: `/api/profile` MUST include `userId`. `/api/conversations` returns `{authenticated, conversations: [...]}` not a flat array.
- **Test isolation**: each E2E spec is independent (no shared state across files). Use `test.use({ serviceWorkers: "block" })` when SW caching contaminates test runs.

### Security tests (load-bearing)

- **XSS**: `parseMarkdown()` and `parseTable()` in `MarkdownContent.tsx` MUST escape `&`, `<`, `>` before any bold/inline processing. Tested in `xss-security.spec.ts`.
- **Spoofing**: Unauth requests to `/api/conversations`, `/api/profile`, `/api/consent`, `/api/diabetes/log` MUST not leak data — return 401 or `{authenticated: false}` empty shape.
- **Payment**: `/api/checkout` MUST require auth + Stripe key. Webhook MUST verify signature.
- **Consent**: PUT `/api/consent` MUST require auth. Toggles must revert optimistically on 500.

**See `docs/reference/testing.md`** for the full E2E spec
inventory (44 specs / 212 tests organized in foundation +
3 batches), per-test descriptions, mocking helpers in
`e2e/helpers.ts`, coverage assessment by area, and the
full set of E2E lessons learned.
---

## Tool Integration (formerly MCP)

MCP servers at `mcp.deepsense.ai` were fully replaced by local tool executors (2026-03-04). All tools now run server-side via `processToolCalls()` in the chat loop, calling public government APIs directly — no third-party intermediary receives patient data. `src/lib/claude.ts` calls `claude.messages.create({ tools })` with no `mcp_servers` parameter.

**Debug logs** (ECS CloudWatch): `[CLAUDE API] Using AWS Bedrock (IAM auth)` + `[CLAUDE API] >>> LOCAL TOOL CALLED: <name>`.
---

## Learning System

### Layers

| Layer         | Goal                    | Storage                                  |
| ------------- | ----------------------- | ---------------------------------------- |
| Language      | Understand user phrases | `symptom_mappings`, `procedure_mappings` |
| Clinical      | Know what gets approved | `coverage_paths`, `appeal_outcomes`      |
| Conversation  | Optimal question flow   | `conversation_patterns`                  |
| Policy        | Track Medicare changes  | `policy_cache`                           |
| User Behavior | Optimize UX             | `user_events`                            |

### Triggers

| Trigger             | What Happens                                             |
| ------------------- | -------------------------------------------------------- |
| Every message       | Extract entities, queue mapping updates                  |
| Thumbs up           | Reinforce all mappings in conversation (+0.1)            |
| Thumbs down         | Penalize mappings (-0.15), learn from correction         |
| Appeal generated    | Store coverage path as pending                           |
| Outcome reported    | Update coverage path success/failure                     |
| Print/copy/download | Track user event                                         |
| Nightly batch       | Process queue, prune weak mappings, check policy updates |

### Persistence

After every chat response, `persistLearning()` runs non-blocking:

- If ICD-10 search used + symptoms extracted -> `updateSymptomMapping(phrase, code, +0.1)`
- If CPT search used + procedures extracted -> `updateProcedureMapping(phrase, code, +0.1)`
- If coverage checked + codes found -> `recordCoveragePath(icd10, cpt, policy, "pending")`

---

## CMS Interoperability Framework (summary)

> **Full compliance report**: see [`cms_readiness.md`](cms_readiness.md). Historical audit log + 2026-03-04 CMS submission Q&A: see [`docs/history/cms-compliance-log.md`](docs/history/cms-compliance-log.md).

**Sources**: [Framework](https://www.cms.gov/health-technology-ecosystem/interoperability-framework) (26 criteria) | [Categories](https://www.cms.gov/health-technology-ecosystem/categories) | [Pledge Form](https://surveys.cms.gov/jfe/form/SV_6SbVcS5IOqXXOnk)

Denali = **Patient-Facing App** in 2 categories: **Conversational AI** + **Diabetes & Obesity Prevention**. Must meet ALL 6 app criteria (A1–A6) + category-specific criteria.

### Current status (compressed)

- **Identity & Security** (A1): Blue Button OAuth via Medicare.gov satisfies IAL2/AAL2. ID.me path was integrated 2026-03-10 but is **NOT REQUIRED per CMS reaffirmation 2026-04-21** — `REQUIRE_IDENTITY_VERIFICATION=false` permanently. Audit logging on all sensitive ops.
- **Trial & Discovery** (A3/A4/A5): 14-day free trial, `/api/cms-metadata`, `CmsPledge` component (AI + Diabetes pledges).
- **Conversational AI**: Personalized AI across clinical record (extracted from EOB claims via `eob-clinical.ts`). Blue Button PHR connection. AI disclaimers. "Talk to your doctor" patterns. Note: lab values not available from Blue Button — only lab procedures (CPT codes).
- **Diabetes & Obesity**: Full EOB extraction pipeline (8 extractors). `ScreeningReminders` from real CPT claim dates. `RiskAlerts` for high A1C, missing meds, refill gaps, no endocrinologist, post-discharge follow-up. SAD list includes 6 obesity drugs (Wegovy, Zepbound, Saxenda, Contrave, Qsymia, Orlistat). Severity classification.
- **Medicare Notifications** (A2 partial): `MEDICARE_NOTIFICATIONS_SKILL` detects EOB/coverage changes.
- **Policy Change Notification** (Terms §12, Privacy §15): `POST /api/admin/email/policy-change` — admin-only, dry-run support, audit-logged.
- **AWS BAA executed 2026-02-25** (covers RDS, ECS, Bedrock, Cognito, SES). Legal pages aligned to AWS-only architecture. Audit log REVOKE applied 2026-04-10 (append-only).

### Remaining Gaps

| Gap | CMS Ref | Priority | Type |
|---|---|---|---|
| HIPAA compliance | A6 | P0 | **DONE** — AWS migration complete + BAA executed 2026-02-25 |
| HITRUST certification | Criterion 26 | P0 | Process — org-level cert |
| CMS security self-assessment | A3 | P0 | Docs — submit data source inventory + security checklist (Terms+Privacy PDFs ready) |
| Medicare.gov notification bridge | A2 | P1 | Code + API |
| CMS credential service integration | A1 | **N/A — DEPRECATED 2026-04-21** | NOT REQUIRED per CMS confirmation. ID.me code retained for historical context |
| CMS review submission | A3 | P1 | Docs |
| CMS app directory submission | A5 | P1 | Docs — screenshots + descriptions |
| AAL2 app auth | A1, Criteria 3, 23 | **DONE via Blue Button OAuth** | Email OTP remains as app-layer factor |
| FHIR USCDI v3 compliance | Criterion 13 | P2 | Code — verify by July 2026 |

### Key Dates

| Date | Milestone |
|---|---|
| Q1 2026 | CMS early adopter showcase target |
| **July 4, 2026** | FHIR API mandate (Criteria 13–16) |
