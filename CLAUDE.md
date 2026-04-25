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

## Skills & Prompt System

Skills are conditional prompt sections loaded by `skills-loader.ts` based on `SkillTriggers` detected in `route.ts`.

### Skill Loading Order & Gates

The system uses gates that return early and prevent later skills from loading prematurely:

| Priority | Trigger                                          | Skill Loaded             | Gate Behavior                                                                                                                                                                                                                |
| -------- | ------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Emergency symptoms detected                      | RED_FLAG_SKILL           | Highest priority, overrides all. Regex covers: chest pain+SOB, sudden headache/numbness, DKA (fruity breath+thirst, extreme thirst+urination), severe hypoglycemia (shaking+sweating+sugar, seizure+sugar, passed out+sugar) |
| 2        | Missing name OR ZIP                              | ONBOARDING               | + TOOL_RESTRAINT (no tools allowed)                                                                                                                                                                                          |
| 3        | Has procedure but missing symptoms/duration      | SYMPTOM_GATHERING        | + TOOL_RESTRAINT (+ PROCEDURE_SKILL for clarification)                                                                                                                                                                       |
| 4        | Has symptom info but no provider confirmed       | PROVIDER_VERIFICATION    | NPI tools only                                                                                                                                                                                                               |
| 5        | Has procedure or needs clarification             | PROCEDURE_SKILL          | Disambiguate procedure type/region                                                                                                                                                                                           |
| 6        | Has procedure or coverage or appeal              | CODE_VALIDATION          | ICD-10 <-> CPT mapping + prior auth check + preventive check + SAD list                                                                                                                                                      |
| 7        | Has coverage but not all requirements verified   | REQUIREMENT_VERIFICATION | Ask 1 requirement at a time                                                                                                                                                                                                  |
| 8        | Provider confirmed + specialty mismatch          | SPECIALTY_VALIDATION     | Warn about ordering specialty risk                                                                                                                                                                                           |
| 9        | Has coverage and `verificationComplete === true` | GUIDANCE_DELIVERY        | Proactive checklist + denial warnings + prior auth status. **NOTE**: Guidance no longer loads when requirements are simply empty (vacuous truth fix) — Claude must emit `[REQUIREMENTS]` block and user must verify or skip  |
| 10       | Appeal detected                                  | APPEAL_SKILL             | Denial code lookup + strategy + PubMed evidence + letter generation (MA-aware: Request for Reconsideration for Advantage plans)                                                                                              |
| 11       | User asks about bills/claims + has health data   | EOB_EXPLAINER_SKILL      | Explains claims, charges, Medicare payment rules, denial reasons in plain English                                                                                                                                            |

**TOOL_RESTRAINT**: During onboarding and symptom gathering, the prompt explicitly forbids all tool calls. This prevents Claude from jumping ahead to code lookups before gathering enough context.

**Requirement Verification Pipeline**: After coverage lookup, Claude MUST emit a `[REQUIREMENTS]` block listing LCD/NCD requirements. This populates `requirementsToVerify` in sessionState. Without it, verification cannot proceed. Three safety mechanisms prevent stuck states: (1) step 9b flow reminder prompts Claude to emit the block, (2) explicit skip detection for "skip"/"move on", (3) implicit skip detection when user requests guidance directly with empty requirements. Guidance delivery (priority 9) only loads when `verificationComplete` is explicitly true — never on empty requirements.

### Base Prompt (always loaded)

- Identity & mission (denial prevention, plain English, empathy)
- Conversation rules (one question, brief responses, explain "why")
- Error handling (graceful failures, progressive disclosure)

### Additional Skills (Loaded Contextually)

| Skill                          | File                                       | Trigger                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HEALTH_RECORDS_SKILL`         | `src/lib/skills/health-records.ts`         | `hasHealthData` or `hasRecentDenials`                                                                                                                                                                                                                            |
| `MEDICARE_NOTIFICATIONS_SKILL` | `src/lib/skills/medicare-notifications.ts` | `hasHealthData && hasRecentChanges`                                                                                                                                                                                                                              |
| `DIABETES_PREVENTION_SKILL`    | `src/lib/skills/diabetes-prevention.ts`    | `hasDiabetesContext` — includes provider search (NPI) for endocrinologists/dietitians/MDPP, urgent A1C values (≥12% contact doctor, ≥14% DKA warning)                                                                                                            |
| `OBESITY_PREVENTION_SKILL`     | `src/lib/skills/obesity-prevention.ts`     | `hasObesityContext` — obesity diagnosis (E66), obesity medications, or user keywords (weight loss, bariatric, BMI, Wegovy, etc.). Includes severity awareness (morbid/severe → bariatric/specialist referral), provider search for bariatric surgeons/counselors |
| `EOB_EXPLAINER_SKILL`          | `src/skills/domain/eob-explainer.ts`       | `hasEOBQuestion && hasHealthData` — user asks about bills/claims with Blue Button connected                                                                                                                                                                      |
| `OUTCOME_PROMPTING_SKILL`      | `src/skills/domain/outcome-prompting.ts`   | Returning user with pending appeal (`hasUnreportedOutcome`). Outcome reported via `/api/appeal-outcome` → `recordAppealOutcome()` + `applyOutcomeIncentive()` (free appeal credit)                                                                               |
| `COUNSELOR_SKILL`              | `src/skills/channel/counselor.ts`          | `role === "counselor"`                                                                                                                                                                                                                                           |
| `PROVIDER_PILOT_SKILL`         | `src/skills/channel/provider.ts`           | `role === "provider"`                                                                                                                                                                                                                                            |

### Implementation

Skills are string constants exported from `src/skills/` (core domain skills) and `src/lib/skills/` (data-dependent skills). They get concatenated into the system prompt by `skills-loader.ts` based on trigger booleans. The function `buildSystemPromptWithLearning()` in `route.ts` calls the skills loader and also injects learned context (high-confidence mappings, successful coverage paths).

---

## Orchestration Flows

How ICD-10, CMS coverage, CARC/RARC, and NPI data come together in end-to-end tool sequences. These are the canonical patterns — Claude should follow these sequences when handling each scenario.

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

**Data handoff**: Symptoms → ICD-10+CPT → Provider NPI (enrolled? specialty?) → Prior auth/preventive/SAD → LCD/NCD policy → Requirements Q&A → Common denials → Personalized checklist

### Flow 2: Appeal (Reactive Denial Response)

**Trigger**: User mentions a denial, appeal, or denial code.

**Tool chain**: `lookup_denial_code` (FIRST — explains denial in plain English + appeal strategy) → gather denial details (no tools) → `search_icd10` → `search_cpt` → `search_local_coverage` (for letter citations) → `generate_appeal_letter` → PAYWALL GATE (`check_appeal_access`)

**Key rule**: `lookup_denial_code` is the FIRST tool called. It immediately gives Claude enough context to explain the denial before gathering additional details for the letter.

**MA branching**: When `sessionState.medicareType === "advantage"`, `generate_appeal_letter` is called with `medicare_type: "advantage"` and `plan_name` from `sessionState.maPlanName`. The letter uses "Request for Reconsideration" (not "Level 1 Redetermination"), addresses the plan (not MAC), and cites 42 CFR §422.101. Appeal levels differ for MA: Level 1 → plan, Level 2 → IRE (not QIC), Levels 3-5 same as Original Medicare. For MA Level 2, the plan auto-forwards to the IRE per 42 CFR §422.590; the generated letter serves as supplementary evidence.

### Flow 3: Quick Denial Code Lookup

**Trigger**: User asks what a denial code means (no full appeal).

Single tool call: `lookup_denial_code` (checks CARC + `eob_denial_mappings` + appeal strategy) → plain English explanation + "Would you like help appealing this?"

### Flow 4: Coverage-to-Appeal Bridge

**Trigger**: User returns saying a previously discussed procedure was denied.

Reuses existing `sessionState` (ICD-10, CPT, policy refs from earlier coverage flow) → `lookup_denial_code` → `generate_appeal_letter` with minimal additional questions.

### Flow 5: EOB Explainer (Bill Understanding)

**Trigger**: User asks about a bill, charge, EOB, or what they owe (regex: `explain.*bill|understand.*claim|what do i owe|why.*charged|show.*claim|breakdown.*bill|recent.*claim`). Requires `hasHealthData` (Blue Button connected).

**Tool chain**: No tools needed — Claude uses `recentClaims` data already injected into the system prompt (top 5 claims with amounts, procedures, providers, denial reasons). `EOB_EXPLAINER_SKILL` teaches Claude to structure the explanation: identify claim → what happened → what was charged → what Medicare paid → what patient owes → next step. Denied claims include `denialReasons` in plain English and offer appeal help.

---

## Business Model, Auth & Payments

### Pricing

| Plan                 | Price     | Appeals/30d | Chat Messages/Day | Weekly Frequency | Auth Required                    |
| -------------------- | --------- | ----------- | ----------------- | ---------------- | -------------------------------- |
| Trial (14 days)      | $0        | 0           | 10                | 1 day/week       | Email OTP                        |
| Expired (post-trial) | —         | —           | 0 (locked)        | —                | Email OTP                        |
| Starter              | $10 one-time (pay-per-claim) | 1 credit    | 20                | 1 day/week       | Email OTP                        |
| Plus                 | $20/month | 2 credits   | 20                | Every day        | Email OTP                        |
| Unlimited            | $60/month | Unlimited   | Unlimited         | Unlimited        | Email OTP                        |
| **Admin**            | —         | Unlimited   | Unlimited         | Unlimited        | `is_admin = TRUE` on `users` row |

**Sign-in required for all chat.** No anonymous access — users must sign up (email OTP) before chatting. **Gmail plus address normalization**: `user+tag@gmail.com` → `user@gmail.com` at sign-in via `normalizeEmail()` in `src/lib/normalize-email.ts` — prevents duplicate accounts. OTP email sent to original address (Gmail delivers it). Every signup = automatic 14-day trial (inline DB insert in `verify-otp`, not self-referencing HTTP fetch). After trial expires → locked (0 chats, must pay). Plan values are `trial`, `starter`, `plus`, `unlimited` only. **Starter is a one-time pay-per-claim charge ($10 grants 1 appeal credit, no recurring billing); Plus and Unlimited are monthly subscriptions.** Appeal access is credit-based via `usage.appeal_credits` column; `unlimited` plan bypasses credit checks entirely. `AppealAccessStatus` returns `"available"` (has credits), `"paywall"` (no credits), or `"allowed"` (admin/counselor/unlimited). Chat rate limiting enforced via two layers: (1) `check_weekly_frequency` for weekly day limits, (2) `check_and_increment_chat` for daily limits. Returns 429 `WEEKLY_LIMIT` / `RATE_LIMITED`; returns 401 `AUTH_REQUIRED` for unauthenticated users; returns 403 `TRIAL_EXPIRED` when expired trial users try to chat. **Admin users** (`users.is_admin`) bypass all rate limits and appeal paywalls.

**AI Model**: Sonnet 4.6 for all chat messages (cost-efficient). Opus 4.6 for appeal letter generation only (higher quality for formal letters).

### Auth Gating

| Feature                                     | Auth Required                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 14-day trial (10 msgs/day, 1 day/week)      | Email OTP                                                                                                                        |
| Post-trial (locked)                         | Email OTP + Subscription to continue                                                                                             |
| Starter (20 msgs/day, 1 day/week, 1 appeal) | Email OTP + $10 one-time (pay-per-claim)                                                                                         |
| Plus (20 msgs/day, every day, 2 appeals)    | Email OTP + $20/month                                                                                                            |
| Unlimited (everything unlimited)            | Email OTP + $60/month                                                                                                            |
| Medicare health data                        | Email OTP + Blue Button OAuth. **ID.me verification: DEPRECATED — NOT REQUIRED per CMS April 2026.** `REQUIRE_IDENTITY_VERIFICATION=false` permanently in all envs. |

### AAL2 Compliance Strategy (CMS A1 / NIST 800-63B)

> **DEPRECATED 2026-04-21 — NOT REQUIRED per CMS confirmation.** ID.me integration is permanently disabled in all environments. `REQUIRE_IDENTITY_VERIFICATION=false` in prod and staging. The flow description below is retained for historical context only; the feature is off and code removal is pending in a future commit.

**Current AAL2 path**: Blue Button OAuth via Medicare.gov satisfies the IAL2/AAL2 requirement (see the Blue Button OAuth section below). The ID.me flow description that follows is retained for historical reference only.

**ID.me provides IAL2/AAL2 identity verification.** Controlled by `REQUIRE_IDENTITY_VERIFICATION` env var:

- `false` (default) = **Connected Apps Directory** mode — Blue Button works without ID.me. ID.me card hidden in Settings unless already verified.
- `true` = **Medicare App Library** mode — users must verify identity via ID.me before connecting Blue Button. ID.me card shown as required.

ID.me uses OIDC (`nist_ial2_aal2` scope). CMS-approved NIST 800-63 credential service provider. One-time verification persists in `user_verification.idme_verified`. Admin bypass on the gate. Data minimization: UUID + first name + gender stored (no last name, DOB, SSN, address). TOTP MFA UI disabled (2026-03-10) — code preserved for potential re-enablement.

**ID.me OIDC flow**: Settings → "Verify with ID.me" button (ID.me brand green #2D844A) → confirmation panel (explains CMS-approved, used by VA/SSA, one-time, auto-return) → `GET /api/auth/idme/authorize` (PKCE + state + nonce cookies) → ID.me sandbox (`api.idmelabs.com`) → `GET /api/auth/idme/callback` (token exchange via `client_secret_post`, userinfo fetch → extract `uuid` + `fname` + `gender`, upsert `user_verification`) → redirect to `/app/settings?idme=verified`.

**Name/gender personalization flow**: ID.me userinfo `fname`/`given_name` → `user_verification.idme_first_name` → `/api/profile` response `firstName` → `useAuth` AuthState `firstName` → chat `sessionState.userName` (skips AI "What's your name?" onboarding) + dashboard greeting + chat empty state greeting. Gender stored for clinical context in AI conversations.

**CMS clarification (2026-03-13, reaffirmed 2026-04-21)**: ID.me/CLEAR/Login.gov are NOT required for Blue Button API / Connected Apps Directory. They were considered for the separate Medicare App Library initiative, but that path is no longer being pursued. `REQUIRE_IDENTITY_VERIFICATION=false` permanently in all environments.

### Appeal Gating Logic

```
1. User requests appeal letter
2. Check email:
   - Not verified -> Signup wall (email OTP → auto-trial, 0 appeal credits)
   - Verified, plan = unlimited -> Generate letter (no credit tracking)
   - Verified, appeal_credits > 0 -> Generate letter, decrement credit, increment count
   - Verified, appeal_credits = 0 (or trial) -> Show paywall (Starter $10 / Plus $20 / Unlimited $60)
3. After subscription -> Credits added per plan, reveal letter
```

### Stripe Payment Architecture

```
PaywallModal (client) → POST /api/checkout → Stripe Checkout Session
                                                    ↓
                                        User completes payment on Stripe
                                                    ↓
                              Stripe fires webhook → POST /api/webhooks/stripe
                                                    ↓
                                        stripe-fulfillment.ts
                                        ├── fulfillCheckoutSession() → update user plan
                                        └── handleSubscriptionEvent() → sync status
```

**Stripe products** (2026-03-05): 3 products in Stripe sandbox — `STRIPE_PRICE_PAY_PER_CLAIM` ($10 one-time, type=`one_time`), `STRIPE_PRICE_MONTHLY` ($20/mo recurring), `STRIPE_PRICE_UNLIMITED` ($60/mo recurring). Price IDs in AWS Secrets Manager (`denali/prod/app` for prod, `denali/staging/app` for staging — both currently point at the same test-mode price IDs since Stripe live mode hasn't been activated). Switch to live keys for production.

**Checkout route** (`checkout/route.ts`): Expects `plan: "starter" | "plus" | "unlimited"`. **Known gap (2026-04-20)**: route currently sets `mode: "subscription"` for all plans, but `STRIPE_PRICE_PAY_PER_CLAIM` is a `one_time` price — Starter checkout will fail at Stripe API call until the route branches on plan (`mode: "payment"` for starter, `mode: "subscription"` for plus/unlimited). `stripe-fulfillment.ts` also assumes a subscription is attached to every session and would need a payment-mode branch. Maps to Stripe Price IDs via `PRICING.STARTER/PLUS/UNLIMITED.stripePriceId`.

Key webhook events: `checkout.session.completed` → `fulfillCheckoutSession()` (reads metadata → plan upgrade to `starter`, `plus`, or `unlimited` + credit reset). `customer.subscription.updated/deleted` → `handleSubscriptionEvent()` (syncs status + plan-aware credit reset). `invoice.payment_failed` → marks `past_due`.

Subscription states: `active` (full access) → `past_due` (retry) → `cancelled` (reverts to expired/locked).

### Stripe Critical Rules

- **CRITICAL: `checkout/route.ts` must use `getAuthUser()`** — auth required server-side so `fulfillCheckoutSession()` can look up the user.
- **CRITICAL: Never return `{ url: null }` from checkout** — grants free access. Returns 503 error when Stripe not configured.
- **Stripe SDK v20**: `current_period_end` lives on `subscription.items.data[0]`, NOT directly on `subscription`.
- **Idempotent fulfillment**: `fulfillCheckoutSession()` is safe to call multiple times.
- **Settings page PaywallModal**: Upgrade button in Settings opens `PaywallModal` inline (not redirect to `/app/chat`). Settings displays plan name (Starter/Plus/Unlimited) with subtitle showing credits + message limits per plan.

### Environment Variables

All runtime env vars are stored in **AWS Secrets Manager** and injected by ECS at container start. Build-time vars are GitHub secrets baked into the Docker image.

```
# Injected by ECS from Secrets Manager at runtime:
# NOTE: Do NOT set ANTHROPIC_API_KEY in ECS — its absence triggers AWS Bedrock IAM auth
# ANTHROPIC_API_KEY=sk-ant-...          # Only for Vercel/local — omit for ECS/Bedrock
ANTHROPIC_MODEL=arn:aws:bedrock:us-east-1:236823123138:inference-profile/global.anthropic.claude-sonnet-4-6
ANTHROPIC_APPEAL_MODEL=arn:aws:bedrock:us-east-1:236823123138:inference-profile/global.anthropic.claude-opus-4-6-v1
# Bedrock: prefix is "global." NOT "us.", no ":0" suffix, full ARN required
# Vercel/local values: claude-sonnet-4-6-20260301 (chat) / claude-opus-4-6 (appeals)
DATABASE_URL=postgresql://...             # RDS connection string
COGNITO_USER_POOL_ID=us-east-1_...
COGNITO_CLIENT_ID=...
COGNITO_CLIENT_SECRET=...
AWS_REGION=us-east-1
SES_FROM_EMAIL=no-reply@denali.health          # AWS SES from address
BLUEBUTTON_CLIENT_ID=...
BLUEBUTTON_CLIENT_SECRET=...
BLUEBUTTON_BASE_URL=https://sandbox.bluebutton.cms.gov
FHIR_TOKEN_ENCRYPTION_KEY=...             # 32-byte hex key for AES-256-GCM token encryption
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PAY_PER_CLAIM=price_...     # Starter $10 one-time pay-per-claim (type=one_time)
STRIPE_PRICE_MONTHLY=price_...            # Plus $20/mo recurring (was STRIPE_PRICE_UNLIMITED_MONTHLY)
STRIPE_PRICE_UNLIMITED=price_...          # Unlimited $60/mo recurring
# DEPRECATED 2026-04-21 — IDME_* vars are NO LONGER USED in any environment.
# CMS confirmed ID.me is NOT REQUIRED for Blue Button API / Connected Apps Directory.
# Vars remain in denali/prod/app secret only for historical context; absent from denali/staging/app.
# REQUIRE_IDENTITY_VERIFICATION is permanently false; code removal pending in a future commit.
IDME_CLIENT_ID=...                        # [DEPRECATED — unused] ID.me OIDC client ID (sandbox)
IDME_CLIENT_SECRET=...                    # [DEPRECATED — unused] ID.me OIDC client secret (sandbox)
IDME_BASE_URL=https://api.idmelabs.com    # [DEPRECATED — unused] ID.me sandbox base URL
REQUIRE_IDENTITY_VERIFICATION=false       # [DEPRECATED — permanently false] historically: false = Connected Apps Directory (no ID.me gate), true = Medicare App Library (ID.me required)

# Baked into Docker image at build time (GitHub secrets):
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_APP_URL=https://denali.health  # or https://staging.denali.health
```

> **Note**: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` were removed from `denali/prod/app` Secrets Manager on 2026-04-09. No Resend references remain in AWS. Email is exclusively via AWS SES (IAM auth).

### ECS Deployment Gotchas

- **Execution role needs explicit Secrets Manager permissions.** `AmazonECSTaskExecutionRolePolicy` only covers ECR + CloudWatch. Add inline policy `denali-secrets-access` to `denali-ecs-execution-role` covering `denali/*` and `rds!db-...-*` secret ARNs.
- **RDS managed secret (`rds!db-...`) only has `username` + `password`** — no `host`/`dbname`/`port`. Use `denali/prod/db` (self-managed) for all DB connection fields.
- **Audit task def secrets before every manual deployment**: `aws ecs describe-task-definition --task-definition denali:N --query "taskDefinition.containerDefinitions[0].secrets[*].valueFrom" --region us-east-1 --output json | sort -u`
- **DB credentials**: DB_USER/DB_PASSWORD reference `rds!db-...:username::` / `rds!db-...:password::` (auto-rotates every 7 days). DB_HOST/DB_NAME/DB_PORT are plain env vars.
- **Current task def**: denali:124, deployed 2026-04-10. Revision 124: removed RESEND_API_KEY and RESEND_FROM_EMAIL secret references after SES migration completion. See `memory/aws-ecs.md` and `memory/aws-infra.md` for full details.
- **audit_logs REVOKE** (2026-04-10): `denali_admin` can only INSERT and SELECT on `audit_logs`. UPDATE, DELETE, TRUNCATE revoked. Rollback: `GRANT UPDATE, DELETE, TRUNCATE ON audit_logs TO denali_admin;`
- **RDS is private-only** (2026-02-27): `PubliclyAccessible: false`. ECS→RDS connectivity via security group `sg-018b0bc1ca0f1db14` allowing port 5432 from ECS SG `sg-0c234bbde5efb2d53`. No public endpoint, no EIP on RDS.
- **CloudWatch log retention**: `/ecs/denali` set to 3 days (was 90). Sufficient for pre-launch debugging. Increase post-launch if needed.

### Infrastructure Scheduling (Cost Optimization)

Pre-launch cost optimization: ECS+RDS can be shut down outside working hours to save ~35-40% on compute costs.

**Shell aliases** (`infra/denali-aliases.sh`): `denali-up`, `denali-down`, `denali-status`. Source from `~/.zshrc`.

**Automated scheduler** (`infra/cfn-scheduler.json`): CloudFormation stack `denali-scheduler` with 3 Lambda functions + 3 EventBridge rules. **Status: DEPLOYED** (2026-02-27, simplified to single nightly shutdown 2026-04-21). Deploy/update via `infra/deploy-scheduler.sh`.

| Component        | Schedule (CT — CDT pin) | UTC Cron             |
| ---------------- | ----------------------- | -------------------- |
| Startup          | Daily 8:00am            | `cron(0 13 * * ? *)` |
| Shutdown nightly | Every night 11:00pm     | `cron(0 4 * * ? *)`  |
| Safety re-stop   | Every 6 days            | `rate(6 days)`       |

> **DST note**: Crons are pinned to CDT (UTC-5). In winter (CST, UTC-6) they shift one hour earlier — startup 7am, shutdown 10pm. Acceptable drift; update CFN if winter behavior matters.

**IAM role**: `denali-scheduler-lambda-role` with minimal permissions (RDS start/stop/describe on `denali-prod`, ECS update/describe on `denali-web`, CloudWatch Logs).

**Safety mechanism**: `denali-safety-stop` Lambda checks ECS desired count — if 0, re-stops RDS to handle AWS's 7-day auto-restart. If user is working (desired > 0), skips.

### Infrastructure Monitoring

**Monitor** (`infra/cfn-monitor.json`): CloudFormation stack `denali-monitor` with Lambda + SNS + 2 EventBridge rules. **Status: DEPLOYED** (2026-02-27). Deploy/update via `infra/deploy-monitor.sh`.

- **Lambda** `denali-monitor`: Checks ECS status, RDS status/public access, ALB target health, Cost Explorer (MTD + yesterday + forecast). Alerts on: ECS mismatch, RDS unexpected state, RDS public, ALB unhealthy, daily cost >$3, forecast >$60/mo.
- **Schedule**: 8:00 AM CT + 8:00 PM CT daily
- **SNS topic** `denali-monitor-alerts`: Email to `ramanac@gmail.com` + `admin@denali.health`. SMS not available (account in SMS sandbox — needs toll-free origination number to enable).
- **IAM role**: `denali-monitor-lambda-role` with ECS/RDS describe, ELB target health, Cost Explorer, SNS publish, CloudWatch.

### App-Level Error Alerting (2026-04-08)

CloudWatch Logs metric filters on `/ecs/denali` log group → custom metrics → alarms → SNS alerts.

| Filter         | Pattern                                                                            | Metric             | Alarm Threshold |
| -------------- | ---------------------------------------------------------------------------------- | ------------------ | --------------- |
| `AppErrors`    | `console.error`, `[ERROR]`, `Error:`, `FATAL`                                      | `AppErrorCount`    | >20 / 5min      |
| `ClaudeErrors` | `[CLAUDE API]`, `timed out`, `Stream error`, `Bedrock`, `ThrottlingException`      | `ClaudeErrorCount` | >5 / 5min       |
| `DBErrors`     | `connection refused`, `ETIMEDOUT`, `ECONNREFUSED`, `[DB]`, `connection terminated` | `DBErrorCount`     | >3 / 5min       |

Plus the custom metrics alarms from `withMetrics` wrapper:

- `Denali-ErrorRate`: HTTP 5xx ErrorCount Sum >10 / 5min
- `Denali-P95Latency`: RequestLatency p95 >5000ms / 5min

All 5 alarms → `denali-monitor-alerts` SNS topic. Logs Insights queries in `infra/cloudwatch-queries.md`.

### Lifecycle Policies

- **ECR**: 5-rule per-prefix policy as of 2026-04-23 (replaces earlier "keep last 3, any tag" rule that caused prod outage). See [Infrastructure Architecture → ECR Lifecycle Policies](#ecr-lifecycle-policies) for full rules.
- **S3 CloudTrail bucket**: Expire logs after 30 days (set 2026-02-27)

### AWS Resource Inventory (2026-02-28)

| Service            | Resource                            | Spec                                                                      | Est. Monthly Cost |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------- | ----------------- |
| RDS                | denali-prod                         | db.t4g.micro, PostgreSQL 16.9, 20GB gp3, private                          | ~$12.10           |
| ECS Fargate        | denali-web                          | 0.5 vCPU, 1GB RAM, task def :30                                           | ~$18.40           |
| ALB                | denali-alb                          | Application, internet-facing                                              | ~$16.20           |
| EIP                | 3× (ALB-attached)                   | All associated, no idle charge                                            | $0                |
| Secrets Manager    | 3 secrets                           | denali/prod/db, denali/prod/app, rds!db-...                               | ~$1.20            |
| CloudWatch Logs    | /ecs/denali                         | 3-day retention, ~8KB stored                                              | ~$0               |
| S3                 | denali-cloudtrail-logs              | CloudTrail storage, 30-day lifecycle                                      | ~$0.05            |
| CloudTrail         | denali-audit-trail                  | Multi-region, management events                                           | $0 (free tier)    |
| ECR                | denali                              | Docker images, keep-last-3 lifecycle                                      | $0 (free tier)    |
| Cognito            | denali-users                        | User pool (us-east-1_bA3bcPcy2)                                           | $0 (free tier)    |
| SNS                | denali-monitor-alerts               | 2 email subscriptions                                                     | $0 (free tier)    |
| IAM                | 5 denali roles                      | ecs-execution, ecs-task, github-actions, scheduler-lambda, monitor-lambda | $0                |
| Lambda             | 4 functions                         | shutdown, startup, safety-stop, monitor                                   | $0 (free tier)    |
| EventBridge        | 7 rules                             | 5 scheduler + 2 monitor                                                   | $0                |
| CloudWatch Alarms  | Denali-ErrorRate, Denali-P95Latency | `Denali/App` namespace, SNS alerts on error rate >10/5min or P95 >5s      | $0.20             |
| CloudFormation     | 2 stacks                            | denali-scheduler, denali-monitor                                          | $0                |
| **TOTAL**          |                                     | **24/7 runtime**                                                          | **~$48/mo**       |
| **With scheduler** |                                     | **~16hr/day weekdays**                                                    | **~$30-35/mo**    |

---

## Infrastructure Architecture

> Target-state reference. Items marked `✓` are live; items marked `PLANNED` are
> remediation tasks following the 2026-04-23 ECR eviction outage
> (see `docs/incidents/2026-04-23-ecr-eviction.md`). As items complete,
> update the status marker inline.

### AWS Resources

**Prod environment:**
- Cluster: `denali`
- Service: `denali-web`
- Task family: `denali`
- ECR repo: `denali` ✓ (isolated from staging as of 2026-04-23)
- RDS: `denali-prod.ca5m0qc8e5h8.us-east-1.rds.amazonaws.com`
- URL: https://denali.health

**Staging environment:**
- Cluster: `denali-staging`
- Service: `denali-staging-web`
- Task family: `denali-staging`
- ECR repo: `denali-staging` ✓ (split from `denali` 2026-04-23)
- RDS: `denali-staging.ca5m0qc8e5h8.us-east-1.rds.amazonaws.com`
- URL: https://staging.denali.health

### ECR Lifecycle Policies

**`denali` repo (prod) — 5-rule policy applied 2026-04-23:**
1. `prod-stable` tag: never expires (9999 retention)
2. Prod SHA tags (hex 0-7 prefix): keep last 10
3. Prod SHA tags (hex 8-f prefix): keep last 10
4. `staging-` prefix: keep last 5 (transitional; will move to
   `denali-staging` repo)
5. Untagged: expire after 1 day

**`denali-staging` repo ✓ (applied 2026-04-23):**
- `staging-` prefix: keep last 10
- Untagged: expire after 1 day

### IAM Roles for GitHub Actions

**Current ✓ (split 2026-04-23):**
- `denali-prod-deploy-role` — trusts `refs/heads/main` only,
  scoped to `denali` ECR repo + `denali-web` service in
  `denali` cluster
- `denali-staging-deploy-role` — trusts `refs/heads/develop`
  only, scoped to `denali-staging` ECR repo +
  `denali-staging-web` service in `denali-staging` cluster

**Legacy (disarmed):**
- `denali-github-actions-role` — shell preserved as rollback
  target. Inline policy detached 2026-04-23 Phase C Step 13;
  policy preserved at
  `docs/runbooks/rollback-artifacts/denali-deploy-policy.json`.
  Role can still be assumed from main or develop but has zero
  permissions. 90-day review cadence — delete once new roles
  proven stable.

### CloudWatch Alarms (Prod)

**SNS topic:** `denali-prod-alerts`

**Subscriptions:**
- admin@denali.health
- ramanac@gmail.com

**Alarms ✓ (applied 2026-04-23):**
- `denali-prod-ecs-running-below-desired` — CloudWatch alarm,
  fires when ECS RunningTaskCount < DesiredCount for 2
  consecutive 1-min periods. Uses ECS/ContainerInsights
  namespace (Container Insights enabled on both clusters).
- `denali-prod-alb-5xx-rate-high` — CloudWatch alarm, fires
  when Target 5xx rate > 5% over 5 min with volume gate at
  20 req/5min to suppress low-traffic false positives.
- `denali-prod-ecs-task-failed-to-start` — EventBridge rule
  (not CloudWatch alarm) catching ECS Task State Change
  events where stopCode=TaskFailedToStart. Covers
  CannotPullContainerError, ResourceInitializationError,
  and other infrastructure-level task start failures. Direct
  SNS target.

All three publish to `denali-prod-alerts` SNS topic.

### Protected ECR Tags

**`prod-stable`** ✓ (automation added 2026-04-23):
- Never expires per lifecycle rule 1 (`countNumber: 9999`)
- Automatically retagged on every successful prod deploy via
  `deploy.yml` post-deploy step (after ECS service stability
  wait completes)
- Provides absolute rollback floor: guaranteed to exist in ECR
  regardless of SHA-bucket retention rules, lifecycle policy
  changes, or accidental eviction
- Current holder: image built from main tip

To roll back to `prod-stable`, register a new task def with
image URI `<ECR>/denali:prod-stable` and update the service.
See `docs/runbooks/ecr-eviction-recovery.md` for exact
commands.

### Docker Base Image

**Current ✓ (digest-pinned 2026-04-23):**
`FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293`

Both staging (develop commit 05d9655) and prod (main commit
be8f409) build against this digest. Verified reproducible:
two independent builds of the same source commit produce
bit-identical base layers.

Future base image updates should bump this digest via
deliberate PR, not via tag floating.

### GitHub Actions Pinning

All `uses:` references in both `.github/workflows/deploy.yml`
and `.github/workflows/deploy-staging.yml` are pinned to
40-character commit SHAs ✓ (applied 2026-04-23 to develop in
commit ad1b387, cherry-picked to main in 335da77). Comments
preserve human-readable version tags.

Rationale: action tag immutability on GitHub is advisory. A
compromised action author could force-push a version tag to
malicious code. SHA-pinning ensures we pull the audited commit
regardless of tag changes.

Updating action versions is now a deliberate code change:
resolve new tag to SHA, update workflow, review diff.

### Incident Response

**Postmortems:** `docs/incidents/`
- `2026-04-23-ecr-eviction.md` — prod outage caused by ECR
  lifecycle eviction, same-day remediation

**Runbooks:** `docs/runbooks/`
- `ecr-eviction-recovery.md` — step-by-step recovery + all
  verification commands for preventive measures
- `rollback-artifacts/` — emergency-restore IAM policies +
  config documents

---

## Blue Button 2.0 (Medicare FHIR API)

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
- Token writes use admin client (bypasses RLS); reads via server client (respects RLS)
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

---

## UI/UX Guidelines

- Minimal interface: just a chat box
- Mobile-first (Medicare patients often on phones/tablets)
- No forms, no dropdowns, no medical jargon
- Greeting personalization ("Evening, Venkata")
- Smart suggestions below input (tappable)

### Layout Architecture

**AppHeader** (`src/components/layout/AppHeader.tsx`) — universal, rendered in root layout (`src/app/layout.tsx`):

| Viewport    | Left       | Center                                               | Right                                        |
| ----------- | ---------- | ---------------------------------------------------- | -------------------------------------------- |
| **Desktop** | Logo → `/` | Nav: Health (rose), Ask Denali (blue), Blog (violet) | Sign In button (not auth) / Gear icon (auth) |
| **Mobile**  | Logo → `/` | —                                                    | Sign In / Gear + Hamburger menu              |

- Auth-aware via `createClient().auth.getSession()` + `onAuthStateChange`
- Nav icons have per-item Tailwind colors (e.g. `text-rose-500`); active state uses `--accent-primary`
- Sign In links to `/app/settings` (email OTP flow); Gear navigates to `/app/settings`
- Hamburger dropdown shows nav items on mobile

**Shared Footer** (`src/components/landing/LandingFooter.tsx`) — used across ALL pages:

- Used by: landing page, blog, legal pages (faq/terms/privacy/hipaa), app layout (desktop only via `hidden md:block`)
- Top row: Logo + "Qash Solutions Inc © 2026" (left), FAQ · Privacy · Terms · HIPAA links (right)
- Bottom row: HIPAA/BAA notice (`text-base font-medium`) + disclaimer (`text-xs`), separated by `border-t`
- **CRITICAL**: In `"use client"` components (like `app/layout.tsx`), import directly from `"@/components/landing/LandingFooter"` — NOT from barrel `"@/components/landing"`. Barrel import pulls `pg` into client bundle via transitive server deps

**BottomTabs** (`src/components/layout/BottomTabs.tsx`) — mobile only, `/app/*` pages:

- Tabs: Home, Health, Ask Denali, Settings (4 tabs, fixed bottom)

**Landing Page** (`src/components/landing/`) — premium warm medical reference design:

- **Hero** (`LandingHero.tsx`): Typographic hero with subtle mountain silhouette SVG (two path layers at opacity 0.08/0.12). Serif heading, decorative accent line, refined pill CTAs, uppercase trust line. Tagline: diabetes + obesity + coverage + denials + appeals. Primary CTA defaults to `/app/chat` (not `/app`) so users land on chat directly (sign-in required to send messages).
- **Features** (`LandingFeatures.tsx`): 3 health-first cards prioritizing CMS diabetes/obesity categories: (1) Pre-Diabetes & Diabetes Care — A1C screenings, meds, coverage; (2) Obesity Care — GLP-1s, bariatric, counseling, coverage; (3) Claims & Appeals — Medicare data + appeal letters. Section header: "Tailored guidance from your Medicare data" + "Pre-diabetes, Diabetes and Obesity" (accent color). Cards: `rounded-xl`, monospace step labels (`01`/`02`/`03`), monochromatic tags, subtle border hover.
- **Conditions** (`LandingConditions.tsx`): 2-column × 3-row alternating image/text section. Header: "Analysis grounded in your **Medicare** data". Three rows: Pre-Diabetes (image left), Diabetes (image right), Obesity (image left). ~30-word descriptions grounded in actual Blue Button data capabilities (R73 codes, Part D meds, DME, screening CPTs, GLP-1 tracking, obesity counseling). Images: `PreDiabetes.png`, `Diabetes.png`, `Obesity.png` in `public/`. Next.js `Image` with `fill` + `object-cover`, intersection observer fade-in.
- **Illustrations** (`illustrations/`): Static SVGs (no animation classes). `DiabetesCareIllustration`, `WeightManagementIllustration` (scale + gauge + trend + capsule), `HealthRecordsIllustration`.
- **HowItWorks** (`LandingHowItWorks.tsx`): Clean typographic steps with monospace numbers, serif labels, sans hints. Steps: Connect Medicare, Ask Denali ("Grounded analysis"), Appeal Denials. Vertical separators on desktop, horizontal on mobile. Hover `-translate-y-1`.
- **Pricing** (`LandingPricing.tsx`): Hardcoded 4 tiers (Free Trial / Starter $10 / Plus $20 / Unlimited $60). No DB dependency. Free Trial CTA → `/app/chat` (sign-in required). Plus has "Most Popular" badge + accent ring. Features show msgs/day + days/week limits. Serif plan names, monospace prices (`--font-mono`), warm amber check icons.
- **Testimonials** (`LandingTestimonials.tsx`): Serif italic quotes, warm amber stars, flat avatars.
- Section bg alternation: Hero `bg-primary`, Features `bg-secondary`, Conditions `bg-primary`, HowItWorks `bg-secondary`, Pricing default, Testimonials `bg-secondary`, Footer `bg-secondary`.

**Health Hub** (`src/app/app/health/page.tsx`) — 7 collapsible accordion cards replacing 11-section scroll:

- Each card: `HealthHubCard` — status dot (red/amber/green) + title + one-line summary + chevron toggle
- Cards: Needs Attention (auto-expanded, conditional), Coverage Status, Diabetes Care (conditional), Weight Management (conditional, obesity), Health Conditions (conditional), Claims & Providers, Medicare Account
- Status dots computed via `computeCardStatuses()` (useMemo) — checks denied claims, overdue screenings, med refill gaps (diabetes + obesity), severity classification, sync age, obesity screenings/meds
- `ObesityCareExpanded` component: classification badge, weight-management medications with refill gap indicators, overdue obesity counseling screenings (G0447/G0473), Medicare coverage info box (IBT/nutrition/bariatric), "Discuss Weight Management" CTA → chat
- Needs Attention `overdueMeds` filter includes both `isDiabetesMed` and `isObesityMed` medications
- Multiple cards can be open simultaneously. `expandedCards` as `Set<string>` state
- Existing child components (`CoverageCards`, `ClaimsTimeline`, `DiagnosisSummaryCard`, etc.) reused as-is inside card bodies

**Icons** (`src/components/icons/index.tsx`):

- `DiabetesIcon`: chart/monitoring icon (trend line + dot) — NOT blood drop
- `WeightScaleIcon`: weight scale with circular gauge, needle, tick marks, handle — used by Weight Management card
- `HeartPulseIcon`, `ChatBubbleIcon`, `DocumentTextIcon`, `GearIcon`, `HomeIcon`, `MountainIcon`

### Typography

- Greeting: 28px Bold
- Body: 16px min Regular
- Labels: 11-12px Semibold
- Font: Instrument Serif (headings, via `--font-serif`) + DM Sans (body, via `--font-sans-dm`) + Monospace (step labels, prices, via `--font-mono`). Loaded via `next/font/google` in root layout. Warm, trustworthy feel — not techy

### Theme

Premium warm medical reference palette — applied across the **entire app**, not just landing page.

- Default: Follow system preference
- **Light**: Warm cream/stone — `--bg-primary: #FEFCF8`, `--bg-secondary: #FFFEFA`, `--bg-tertiary: #F5F0E8`, `--text-primary: #2C1810`, `--accent-primary: #C26A3E` (warm amber), `--border: #E8DFD3`
- **Dark**: Warm dark — `--bg-primary: #1A1612`, `--bg-secondary: #241F1A`, `--accent-primary: #D4845A`
- **Brand**: `--brand-purple: #7c3aed` — dedicated variable for "Health" text in DenaliHealth logo (independent of warm accent palette)
- Feature colors: muted earth tones — sage (`--check-teal: #5A8A6E`), terracotta (`--health-red: #B3695A`), plum (`--diabetes-violet: #7B6B8A`), rust (`--appeal-coral: #B8704E`)
- Landing page animations removed (float, pulse-gentle, draw-in, shimmer, sway, pulse-line, flow-move). Dashboard animations preserved (popover-in, fade-up, slide-down-fade, card-enter)

### Accessibility

- Minimum 16px font size
- High contrast mode option
- Screen reader compatible
- Touch targets minimum 44x44px
- No time-limited interactions

---

## PWA Offline & Low-Bandwidth

Designed for rural Medicare patients on spotty connections. Caches API responses in IndexedDB for offline viewing, queues writes for replay on reconnect, and provides network-aware UI.

**Dependencies**: `idb` (~1KB gzipped) — typed IndexedDB wrapper. No Workbox/next-pwa (bundle overhead).

### Service Worker Strategies

`public/sw.js` — plain JS, no build step. Routes requests by URL pattern:

| URL Pattern                                                                                                       | Strategy                                 | Cache Name         |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------ |
| `/_next/static/`, `/icon-*`, `/favicon*`, `/logo*`                                                                | Cache-first                              | `denali-static-v2` |
| `/api/chat`                                                                                                       | Network-only                             | —                  |
| `/api/fhir/authorize`, `/api/fhir/callback`, `/api/checkout`, `/api/webhooks/*`                                   | Network-only                             | —                  |
| `/api/conversations`, `/api/fhir/data`, `/api/profile`, `/api/diabetes/log` (GET), `/api/diabetes/insights` (GET) | Network-first, cache fallback            | `denali-api-v2`    |
| Navigation (`mode=navigate`)                                                                                      | Network-first → cached page → `/offline` | `denali-static-v2` |
| Everything else                                                                                                   | Stale-while-revalidate                   | `denali-static-v2` |

**Precached**: `/offline`, `/manifest.json`, `/icon-192.png`, `/icon-512.png`. **Cache versioning**: `CACHE_VERSION = "v3"` — bump on deploy. Old caches deleted on activate. **Update detection**: SW registration checks for updates every 60 min; auto-activates waiting worker.

**CRITICAL: Clone responses synchronously in SW caching strategies.** In `staleWhileRevalidate`, `response.clone()` must happen BEFORE any async `caches.open().then()` — the original response may be consumed by the client before the nested `.then()` runs, causing "Response body is already used" TypeError. Pattern: `const cloned = response.clone(); caches.open(name).then(c => c.put(req, cloned));`

**Middleware**: `sw.js` excluded from middleware matcher (`sw\\.js` in regex).

### IndexedDB Cache

`src/lib/offline-cache.ts` — database `denali-offline-cache` v1 with 6 object stores:

| Store               | Key               | TTL | What's Cached                                                                                                            |
| ------------------- | ----------------- | --- | ------------------------------------------------------------------------------------------------------------------------ |
| `conversations`     | `"list"`          | 24h | `ConversationHistoryItem[]`                                                                                              |
| `health-data`       | `"snapshot"`      | 24h | Full health snapshot (patient, coverage, claims, labs, conditions, medications, screenings, providers, hospitalizations) |
| `diabetes-log`      | `"entries"`       | 24h | `LogEntry[]`                                                                                                             |
| `diabetes-insights` | `"current"`       | 24h | `StoredInsight`                                                                                                          |
| `profile`           | `"profile"`       | 4h  | Non-sensitive profile data (plan, role, appealCount, appealCredits, isAdmin, trialStatus)                                |
| `offline-queue`     | Auto-generated ID | —   | Failed POST requests awaiting replay                                                                                     |

All operations are try/catch guarded — gracefully degrades if IndexedDB is unavailable (private browsing, Safari restrictions).

### Offline Write Queue

Only diabetes log POSTs are queued (not deletes — ordering risk; not chat — requires real-time API).

**Queue flow**: `useDiabetesLog.addEntry()` catch → `queueOfflineRequest()` → optimistic local state update → on reconnect: `window.addEventListener('online')` → `sw.postMessage({ type: 'SYNC_QUEUE' })` → SW reads queue from IndexedDB → replays POSTs → removes on success, drops after 3 retries.

**Dual consumer**: SW processes queue via raw IndexedDB (can't import `idb`). Client-side `offline-sync.ts` provides `processQueue()` / `getQueueCount()` as alternative.

### Hook Integration Pattern

All 5 data hooks follow the same pattern:

```
fetch success → setState() → cacheSet() (fire-and-forget)
fetch failure → cacheGetIfFresh() → setState() from cache (if within TTL)
```

**CRITICAL: Never `await` IndexedDB writes before `setState()`.** Fire-and-forget pattern — blocking on cache writes causes UI hangs.

| Hook                          | Store               | TTL | Offline Behavior                              |
| ----------------------------- | ------------------- | --- | --------------------------------------------- |
| `useConversationHistory`      | `conversations`     | 24h | Shows cached conversation list                |
| `useHealthData`               | `health-data`       | 24h | Shows cached health snapshot                  |
| `useDiabetesLog`              | `diabetes-log`      | 24h | Shows cached entries + optimistic adds queued |
| `useDiabetesInsights`         | `diabetes-insights` | 24h | Shows cached insight                          |
| `useAuth` (`loadProfileData`) | `profile`           | 4h  | Restores plan/role/admin from cache           |

### Network-Aware UI

- **`OfflineBanner`** — fixed below AppHeader (`top-14 sm:top-16 z-30`), amber-left-border accent, auto-dismisses on reconnect. Rendered in root `layout.tsx`.
- **`InactivityWarning`** — fixed below AppHeader (same position as OfflineBanner), amber-left-border accent, shows countdown timer + "Stay signed in" button. Auth-gated: renders nothing for anonymous users. Rendered in root `layout.tsx` below OfflineBanner.
- **Chat page** — `ChatInput` disabled when offline with placeholder "Chat requires an internet connection". Uses `useOnlineStatus()` hook.
- **Offline page** (`/offline`) — shown when navigation fails. Links to cached health records and past conversations.

### Session Inactivity Timeout (HIPAA)

`SESSION_TIMEOUT` constants in `config/ui.ts`. `useIdleTimeout` hook in `hooks/useIdleTimeout.ts`. `InactivityWarning` component in `components/ui/InactivityWarning.tsx`.

- **Warning at 27 min**, **sign out at 30 min** of inactivity (mouse/key/touch/scroll)
- Activity tracking throttled to 1s updates to avoid thrashing
- Check interval: 30s normally, 1s during warning countdown
- Auth-gated via `onAuthStateChange` — no timers for anonymous users
- Sign out calls `getClient().auth.signOut()` — redirect handled by auth state listeners
- "Stay signed in" resets `lastActivity` timestamp and clears warning

### What's NOT Offline

- **Chat**: Requires Claude API + MCP tools — fundamentally online-only
- **Individual conversation messages**: Loaded via API, not cached (v2 candidate)
- **Blue Button OAuth**: Network-only (redirect flow)
- **Stripe checkout/webhooks**: Network-only
- **Push notifications**: Not implemented (permission complexity for elderly audience)

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

MCP servers at `mcp.deepsense.ai` were fully replaced by local tool executors (2026-03-04). All tools now run server-side via `processToolCalls()` in the chat loop, calling public government APIs directly. No third-party intermediary receives patient data.

```typescript
// src/lib/claude.ts — all tools are local, no mcp_servers parameter
const response = await claude.messages.create({
  model,
  max_tokens: API_CONFIG.claude.maxTokens,
  system: request.systemPrompt,
  messages,
  tools: anthropicTools.length > 0 ? anthropicTools : undefined,
});
```

### Debugging

Server-side logs (ECS CloudWatch):

```
[CLAUDE API] Using AWS Bedrock (IAM auth)
[CLAUDE API] >>> LOCAL TOOL CALLED: search_local_coverage
[CLAUDE API] >>> LOCAL TOOL CALLED: search_cpt
```

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

## CMS Interoperability Framework

> **Full compliance report**: See [`cms_readiness.md`](cms_readiness.md) for detailed status of every CMS requirement with code references and evidence.

**Sources**: [Framework](https://www.cms.gov/health-technology-ecosystem/interoperability-framework) (26 criteria) | [Categories](https://www.cms.gov/health-technology-ecosystem/categories) (app pledges) | [Early Adopters](https://www.cms.gov/health-tech-ecosystem/early-adopters) | [Pledge Form](https://surveys.cms.gov/jfe/form/SV_6SbVcS5IOqXXOnk)

Denali = **Patient-Facing App** in 2 categories: **Conversational AI** + **Diabetes & Obesity Prevention**. Must meet ALL 6 app criteria (A1–A6) + ALL category-specific criteria.

### What's Done (by category)

**Identity & Security** (A1, Criteria 3/22/23/24/25): **ID.me OIDC identity verification (IAL2/AAL2)** gates Blue Button access — users must verify via ID.me before connecting Medicare data. Data minimization: UUID + first name + gender stored (no last name, DOB, SSN, address). TOTP MFA UI disabled (code preserved — ID.me is CMS-mandated path). Blue Button OAuth (PKCE+encrypted tokens), audit logging on all sensitive ops (`IDME_VERIFY` action type), consent preferences with enforcement, request purpose tagging on FHIR calls.

**Trial & Discovery** (A3/A4/A5): 14-day free trial, `/api/cms-metadata` for CMS directory, `CmsPledge` component (AI + Diabetes pledges).

**Conversational AI criteria**: Personalized AI across clinical record (coverage+denials+conditions+medications+screenings+providers+hospitalizations+classification — extracted from EOB claims via `eob-clinical.ts`). Blue Button PHR connection. AI-generated disclaimers (SparkleIcon + "Not medical advice"). "Talk to your doctor" patterns in all skills. Note: lab values (A1C etc.) not available from Blue Button — only lab procedures detected in EOB claims.

**Diabetes & Obesity criteria**: Full EOB extraction pipeline (`eob-clinical.ts`: 5 extractors — conditions, medications with PDE adherence data + dual `isDiabetesMed`/`isObesityMed` flags, screenings from CPT codes including obesity counseling G0447/G0473, providers with specialty, hospitalizations with follow-up flags → `classifyDiabetesStatus()` + `classifyObesityStatus()`). `ScreeningReminders` driven by real CPT claim dates (9 screening types, 20 CPT codes). `RiskAlerts` expanded: high A1C, missing meds, med refill gaps, A1C trending up, no endocrinologist, post-discharge follow-up. Personalized coaching via `DIABETES_PREVENTION_SKILL` + `OBESITY_PREVENTION_SKILL` (classification-based: obese → IBT/MNT/bariatric/GLP-1 guidance, at-risk → screening/IBT recommendation). `PreDiabetesRiskCard` (CDC risk test). Diabetes dashboard (diagnoses, medications, quick actions). `diabetes_snapshots` for longitudinal tracking. `QuickLog` for daily entries. `InsightsCard` for Claude-generated analysis. SAD list includes 6 obesity drugs (Wegovy, Zepbound, Saxenda, Contrave, Qsymia, Orlistat). Severity classification: morbid/severe/class III obesity → RED in DiagnosisSummaryCard.

**Medicare Notifications** (A2 partial): `MEDICARE_NOTIFICATIONS_SKILL` detects EOB/coverage changes from FHIR data.

**Policy Change Notification** (Terms §12, Privacy §15): `POST /api/admin/email/policy-change` — admin-only endpoint sends branded HTML email to all registered users with 30-day advance notice of material policy changes. Supports dry-run mode (preview + recipient count), CMS regulatory change flag, and audit logging (`POLICY_CHANGE_EMAIL` action).

**Chat & Appeal Infrastructure**: Rate limiting, sidebar auth+refresh, conversation persistence, requirement verification pipeline (vacuous truth fix), outcome incentive wiring, denial code extraction from user text, LCD prior auth prompt strengthening.

**Blue Button ToS v3 Compliance** (2026-02-24): Full audit completed against all ToS sections. Fixed two code gaps: (1) Blue Button attribution ("not endorsed or certified by CMS or HHS") added to connected health page (`health/page.tsx`) so it's visible whenever Medicare data is displayed — previously only on the pre-connect screen; (2) `context.ts` consent gate changed from `=== false` to `!== true` so `null`/`undefined` `consentHealthDataAi` never accidentally injects health data into Claude (null-safe allow-list pattern). All 7 Framework principles verified: Transparency ✅, Consent ✅, Use & Disclosure ✅, Individual Access ✅, Security ✅, Data Quality ✅, Accountability ✅.

**Patient-Facing Data Access History** (Criterion 4, 2026-02-24): Settings page "Activity Log" renamed to "Data Access History" with subtitle explaining it records Medicare data access events. 16 action types covered with human-readable labels. IP masking implemented. Fully satisfies Criterion 4. UI (2026-02-25): collapsible — shows 3 most recent entries by default, "Show N more ↓" / "Show less ↑" toggle, fetches up to 50 entries upfront (no second network call on expand). "Load all activity →" appears only when >50 entries exist and list is expanded.

**Privacy Policy — CMS Blue Button Checklist** (2026-02-24): Full audit against CMS BB privacy policy checklist. All 16 checklist requirements now satisfied. Four gaps fixed: (1) Re-identification risk caveat added to §7 — anonymized data could theoretically re-identify individuals with uncommon conditions, as CMS explicitly requires disclosing; (2) Revocation data handling — dedicated clear statement added to §4 that disconnecting Medicare immediately and permanently deletes all cached health data; (3) Vendor data protection commitments — §5 now explicitly states all third-party providers are contractually required to protect data consistent with applicable law, with BAA/SOC2 Type II/PCI DSS certifications enumerated; (4) Breach notification user steps — §10 now lists specific protective actions users can take (monitor Medicare Summary Notices, call 1-800-MEDICARE, review credit report). Effective date updated to 2026-02-24.

**Privacy Policy Code Deltas — All 4 Resolved** (2026-02-24): Full audit of gaps between privacy policy claims and code behavior (`docs/delta-privacy.md`). Two code fixes, two policy text fixes: (1) **`health_data_storage` consent** — `useHealthData.ts` `cacheSet()` now gated on `healthDataStorageRef.current === true`; uses `useRef` pattern so stable `useCallback` dep array is not disturbed; (2) **`analytics` consent** — `trackEvent()` in `conversation-service.ts` now returns early if `analyticsConsent !== true`; `useChat.ts` imports `useConsent` and passes `consent.analytics` to all 3 call sites (`appeal_completed`, `feedback_positive`/`negative`, `outcome_reported`); (3) **audit log retention conflict** — removed audit logs from §7 deletion list, added HIPAA 6-year retention note; (4) **inactive account notice** — softened "will receive" → "may receive" (feature not yet implemented). TypeScript: clean.

**FAQ Cross-Audit vs Terms + Privacy — 6 Deltas Fixed** (2026-02-24, updated 2026-03-04): Full three-way audit of `/faq` against `/terms` and `/privacy`. Six contradictions or omissions corrected: (1) "never store your full name" → now code-accurate: `transformPatient()` only extracts age+gender from FHIR Patient resource, discards name/DOB/Medicare ID/address (Privacy §2); (2) data sharing list omitted Vercel → added (Privacy §5 lists Vercel as data processor, 30-day log retention); (3) "Is Denali free?" had no post-trial lock warning → added "chat access is locked until you purchase a plan" (Terms §7); (4) "Can I delete your account?" said "permanently delete all your data / payment records" → replaced with precise list matching Privacy §7; removed "payment records" (we cancel Stripe subscription, we don't delete Stripe's own records); (5) "What data is retained after deletion?" said "only anonymized data" → added audit logs as second retained category with 6-year HIPAA explanation (contradicted Privacy §7 directly); (6) "Is there a free trial?" said "1 appeal letter" → corrected to "1 appeal credit" (Terms §7 terminology); added post-trial lock notice for consistency.

**HIPAA Page Cross-Audit — 6 Deltas Fixed** (2026-02-24, see below for final pass): Full audit of `/hipaa` against `/faq`, `/terms`, and `/privacy`. Six issues corrected: (1) **PHI deletion claim** — closing paragraph in "PHI Retention" said "all PHI permanently removed on account deletion" with no carve-out; added audit log exception (6-year HIPAA retention) to match Privacy §7 and FAQ; (2) **BAA false claim** (highest risk for CMS) — `hipaa/page.tsx`, `privacy/page.tsx`, and `docs/cmsreview.md` all stated BAAs with Supabase and Vercel were "in place" / "maintained"; BAAs are not yet signed; softened to "BAAs being established / in process" with note that docs will update on execution; (3) **Breach 500+ bullet omitted FTC** — said "HHS and media" only; added FTC to match Privacy §10 and FAQ ("FTC and HHS"); (4) **"Improving our AI models"** — implied model training; Privacy §5 explicitly says Anthropic does not train on API data; changed to "improving our service using anonymized learning patterns" + added "We do not use your data to train AI models"; (5) **"Active session" TTL wording** — said cache retained only for "the active session"; actual behavior is 24-hour TTL surviving across sessions; corrected to "24-hour TTL, deleted on disconnect or account deletion"; (6) **Effective date** — updated Feb 8 → Feb 24, 2026. **Note**: Supabase and Vercel references in these historical audit entries are obsolete — fully migrated to AWS (2026-02-26). No Supabase/Vercel BAAs needed.

**Legal Page Footer Parity** (2026-02-24): All four legal pages (`/faq`, `/terms`, `/privacy`, `/hipaa`) were missing cross-navigation links and the CMS non-endorsement/medical advice disclaimer row present in `LandingFooter`. Each page now shows links to its three sibling legal pages + the disclaimer: "Coverage guidance only, not medical advice. Always consult with healthcare providers for medical decisions. This product is not endorsed or certified by CMS or HHS." Footer structure now matches the landing page. Previously: HIPAA had only Privacy + FAQ links (missing Terms); Privacy and Terms had no nav links at all; FAQ had no nav links and no disclaimer.

**Final 4-Doc Cross-Audit + Automated Checker** (2026-02-24): Exhaustive final pass across all four legal documents (FAQ, Terms, Privacy, HIPAA) using both a human-equivalent agent (23 topics) and a new automated script (`scripts/check-legal-docs.ts`, 28 checks). The script found 4 issues the human audit missed: (1) **Terms §11** — "all your data will be permanently deleted" had no audit log carve-out, contradicting Privacy §7/FAQ/HIPAA; (2) **Terms §13** — "all Medicare data is permanently deleted immediately" had no audit log carve-out; (3) **HIPAA "no model training" phrasing** — "do not use your data to train AI models" didn't literally contain "not train" — rephrased to "do not train AI models on your data" to match Privacy §5; (4) **FAQ audit log check** — case-sensitivity bug in the checker itself ("Audit" vs "audit") — fixed regex to case-insensitive. All 28 checks now green. **Run anytime:** `npx tsx scripts/check-legal-docs.ts` from project root.

**CMS Blue Button Terminology + Vendor Alignment** (2026-03-23): Full audit of Terms and Privacy against CMS Blue Button production access requirements and ToS v3. Two fixes: (1) **"Blue Button" → "Medicare"** in all user-facing legal text (Terms §13, Privacy §9, §5 business transfers) — CMS requires "Medicare" as data source name, not "Blue Button". CMS-mandated attribution notice ("This product uses the Blue Button APIs but is not endorsed...") preserved as-is in CmsPledge, ConnectMedicare, health page, ReportView. (2) **Resend → AWS SES** in Privacy §5 — Resend vendor bullet removed (no longer used), SES folded into AWS bullet explicitly listing RDS+ECS+Bedrock+SES. CMS naming commitment added to Privacy §11. Privacy §5 effective date updated to March 5, 2026.

**Health Report Data Field Bug Fix** (2026-03-23): API returns report content as `data` field, but `useHealthReport.ts` interface expected `reportData` and report page accessed `report.reportData` — always `undefined`, so `<ReportView>` never rendered for authenticated users (public share page worked correctly since it used `report.data`). Fixed: hook interface `reportData` → `data`, report page `report.reportData` → `report.data`. E2E mocks aligned to match API response shape.

### CMS Submission Q&A (2026-03-04)

Verified answers to CMS early adopter questionnaire, backed by code and AWS infrastructure audit.

**App description (for CMS directory):**

> DenaliHealth connects to Medicare claims data through Blue Button 2.0 and uses Claude (Anthropic) on AWS Bedrock to deliver personalized coverage guidance for beneficiaries with diabetes and obesity. The app extracts conditions, medications, screenings, and denial history from a patient's own claims, then provides tailored support — offering direct assistance when appropriate and directing patients to care from a health professional when needed.

**Q: If data is shared with third parties, how will you obtain informed consent?**
DenaliHealth does not share patient health data (PHI) with any third party. All health data processing runs through Claude on AWS Bedrock (Sonnet 4.6 for chat, Opus 4.6 for appeals) — data never leaves AWS. Email delivery via AWS SES (within BAA). One service provider receives limited operational data (email address only): Stripe (payments). Patient consent for health data use is obtained through three granular opt-in toggles (all default OFF) in Settings > Privacy & Data: Health Data AI, Health Data Storage, Analytics. Medicare data access requires separate Blue Button OAuth through Medicare.gov. Consent changes take effect immediately (including mid-conversation) and are audit-logged.

**Q: Do third-party vendors commit to data protection requirements?**
Yes. No third-party vendor has access to patient health data. AWS: BAA executed 2026-02-25, HIPAA-eligible, SOC 2 Type II, FedRAMP High, HITRUST certified. Email sending via AWS SES (within BAA). Stripe: PCI DSS Level 1 certified, receives only email + payment identifiers. Public government APIs (NLM, CMS, NPPES) receive only generic search terms — never patient data.

**Q: What happens when a user withdraws consent?**
Consent toggles take effect immediately. Health Data AI → OFF: data stripped client-side before any API call. Disconnecting Medicare: all cached health data + encrypted OAuth tokens permanently deleted. Account deletion: 11-step cascade deletes all user data, Cognito credentials removed as final step. Only audit logs (6-year HIPAA) and anonymized learning patterns survive.

**Q: What happens if the company is sold?**
Terms §12 and Privacy §5 both require: (1) users notified via email at least 30 days before data transfer; (2) CMS notified at earliest practicable time (Blue Button credentials are entity-specific, change of ownership requires CMS re-review); (3) users can delete account and all data before transfer.

**Q: How do you store/retain health information consistent with PHI protection best practices?**
Verified via AWS CLI audit (2026-03-04):

- **Encryption at rest**: RDS AES-256 via KMS (`a44e46d3-84bc-4f3e-87ff-50cc848843b8`), deletion protection ON. Blue Button tokens: app-layer AES-256-GCM. Secrets Manager: KMS encryption.
- **Encryption in transit**: ALB TLS 1.3/1.2 (`ELBSecurityPolicy-TLS13-1-2-2021-06`), HTTP→HTTPS redirect. RDS TLS via `rds-ca-rsa2048-g1` CA cert.
- **Network isolation**: RDS `PubliclyAccessible: false`, ECS→RDS via VPC security group (port 5432 restricted). Fargate serverless (no SSH).
- **Access controls**: Cognito with email OTP + ID.me IAL2 identity verification (required for Medicare data) + optional TOTP MFA, deletion protection ACTIVE. App-level user-scoped data access. HIPAA 30-min inactivity timeout.
- **Audit**: App-level audit log (6-year retention, 16 action types). CloudTrail multi-region with log file validation. Infrastructure monitoring 2x/daily.
- **Data minimization**: Only age+gender from FHIR Patient resource (no name/DOB/address/Medicare ID). Health cache 24h TTL, deleted on disconnect. Consent toggles all default OFF.
- **AI data handling**: All AI via Bedrock (within AWS/BAA). Anthropic does not train on Bedrock API data. Health data in AI only when consent toggle ON.
- **Backups**: RDS automated backups encrypted, 7-day retention.

**Q: Data deletion approach?**
"We securely delete all data on user request." Account deletion cascades through 11 tables + Cognito. Two categories retained per legal requirements: audit logs (6-year HIPAA) and anonymized learning patterns (no user linkage). Medicare data can also be deleted independently via Blue Button disconnect.

**Third-party data flow summary (verified 2026-03-04):**

| Service              | Data Sent                                     | Health Data?                  |
| -------------------- | --------------------------------------------- | ----------------------------- |
| AWS Bedrock (Claude) | Conversation + health context (consent-gated) | Yes — within AWS/BAA          |
| NLM Clinical Tables  | Generic ICD-10 search terms                   | No                            |
| CMS Coverage DB      | Generic procedure keywords                    | No                            |
| NPPES NPI Registry   | Provider names/locations                      | No                            |
| PubMed/NCBI          | Clinical search terms                         | No                            |
| CMS Blue Button      | OAuth tokens (reads FROM CMS)                 | No — inbound only             |
| ID.me                | OIDC auth code (identity verification)        | No — UUID only, no PII stored |
| Cognito              | Email address                                 | No                            |
| Stripe               | Email, internal user ID                       | No                            |
| AWS SES              | Email address (within AWS/BAA)                | No                            |

### Remaining Gaps

| Gap                                    | CMS Ref            | Priority | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HIPAA compliance**                   | A6                 | **P0**   | **AWS migration COMPLETE + BAA executed** — All code phases done. ECS task def :30 deployed. AWS BAA executed Feb 25, 2026 (covers RDS, ECS/Fargate, Bedrock, Cognito). RDS storage encrypted (KMS). Legal pages updated to reflect AWS-only architecture (no Supabase/Vercel references). See `memory/aws-migration.md`.                                                                                                                                                                                                                                                                                   |
| **HITRUST certification**              | Criterion 26       | **P0**   | Process — org-level security certification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **CMS security self-assessment**       | A3                 | **P0**   | Docs — data source inventory + security checklist required for CMS review participation. In-app `/terms` (15 sections) and `/privacy` (16 sections) audited against CMS Blue Button ToS + production access checklist on 2026-03-03 — all 13 privacy policy checklist items pass, ToS consistent with Privacy, active opt-in, seven framework principles covered. PDFs generated for CMS submission (`DenaliHealth-Terms-of-Service.pdf`, `DenaliHealth-Privacy-Policy.pdf`). Implementation verification checklist: `terms_privacy.md`. Remaining: submit formal security self-assessment document to CMS. |
| **Medicare.gov notification bridge**   | A2                 | **P1**   | Code + API — direct Medicare.gov communication integration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **CMS credential service integration** | A1                 | **N/A — DEPRECATED 2026-04-21** | **NOT REQUIRED per CMS confirmation.** ID.me OIDC was integrated 2026-03-10 (IAL2/AAL2 via sandbox, feature-flagged on `REQUIRE_IDENTITY_VERIFICATION`). CMS reaffirmed (2026-04-21) that ID.me/CLEAR/Login.gov are not required for Blue Button API / Connected Apps Directory. Flag is permanently `false` in all envs; code retained for historical context, removal pending in a future commit. Blue Button OAuth via Medicare.gov satisfies the IAL2/AAL2 path (see row below).                                                                                                                  |
| **CMS review submission**              | A3                 | **P1**   | Docs — submit data source inventory + security self-assessment to CMS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **CMS app directory submission**       | A5                 | **P1**   | Docs — screenshots, descriptions for Medicare.gov listing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **AAL2 app auth**                      | A1, Criteria 3, 23 | **DONE via Blue Button OAuth — DEPRECATED ID.me path 2026-04-21** | **Current AAL2 path: Blue Button OAuth via Medicare.gov** satisfies the IAL2/AAL2 requirement. ID.me previously provided IAL2/AAL2 (integrated 2026-03-10) but is **NOT REQUIRED per CMS confirmation (reaffirmed 2026-04-21)** for Blue Button API / Connected Apps Directory. ID.me code path retained for historical context, removal pending in a future commit. Email OTP remains as the app-layer auth factor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **FHIR USCDI v3 compliance**           | Criterion 13       | **P2**   | Code — verify Blue Button maps to USCDI v3 by July 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Key Dates

| Date             | Milestone                         |
| ---------------- | --------------------------------- |
| **Q1 2026**      | CMS early adopter showcase target |
| **July 4, 2026** | FHIR API mandate (Criteria 13–16) |
