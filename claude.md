# Denali.health

<!-- CLAUDE.md — Project instructions for Claude Code (the coding assistant).
     This file is auto-loaded into every Claude Code context window.
     Keep it accurate to the ACTUAL codebase, not aspirational.
     Last updated: 2026-02-24 (privacy policy)
     Maintainer: @cvr
-->

<!-- IMPORTANT FOR CLAUDE CODE:
     - Read this file carefully before making changes to the codebase
     - Sections are ordered by importance: critical rules first, reference material last
     - If a section says "CRITICAL" or "MUST", treat it as a hard constraint
     - The "Key Files" section tells you where to look for specific logic
-->

> Medicare claims intelligence PWA. Claude is the brain — driving conversations, calling tools, synthesizing coverage guidance, and learning from interactions. Focus: **proactive denial prevention** through plain English.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Critical Rules](#critical-rules)
- [Key Files](#key-files) — [API Routes](#api-routes)
- [Architecture](#architecture) — [Two-Tier Tool System](#two-tier-tool-system) · [Session State](#session-state)
- [Tools & Data Sources](#tools--data-sources) — [MCP Tools](#mcp-tools-external-auto-handled-by-api) · [Local Tools](#local-tools-defined-in-srclibtools) · [Data Inventory](#data-inventory)
- [Database Schema](#database-schema) — [Core Tables](#core-tables) · [Denial Code Tables](#denial-code-tables) · [Learning Tables](#learning-tables-no-user-link) · [Key Functions](#key-functions)
- [Skills & Prompt System](#skills--prompt-system) — [Skill Loading Order](#skill-loading-order--gates) · [Base Prompt](#base-prompt-always-loaded) · [Additional Skills](#additional-skills-loaded-contextually)
- [Orchestration Flows](#orchestration-flows) — [Coverage Guidance](#flow-1-coverage-guidance-proactive-denial-prevention) · [Appeal](#flow-2-appeal-reactive-denial-response) · [Denial Code Lookup](#flow-3-quick-denial-code-lookup) · [Coverage-to-Appeal Bridge](#flow-4-coverage-to-appeal-bridge) · [EOB Explainer](#flow-5-eob-explainer-bill-understanding)
- [Business Model, Auth & Payments](#business-model-auth--payments) — [Pricing](#pricing) · [Auth Gating](#auth-gating) · [Appeal Gating](#appeal-gating-logic) · [Stripe](#stripe-payment-architecture)
- [Blue Button 2.0](#blue-button-20-medicare-fhir-api) — [OAuth Flow](#oauth-flow-pkce) · [EOB Extraction Pipeline](#eob-extraction-pipeline) · [Condition Severity Classification](#condition-severity-classification)
- [UI/UX Guidelines](#uiux-guidelines) — [Layout Architecture](#layout-architecture) · [Theme](#theme) · [Accessibility](#accessibility)
- [PWA Offline & Low-Bandwidth](#pwa-offline--low-bandwidth) — [Service Worker](#service-worker-strategies) · [IndexedDB Cache](#indexeddb-cache) · [Offline Write Queue](#offline-write-queue) · [Hook Integration](#hook-integration-pattern)
- [Coding Standards](#coding-standards) — [Project Structure](#project-structure)
- [Testing](#testing) — [Unit Tests (Vitest)](#unit-tests-vitest) · [E2E Tests (Playwright)](#e2e-tests-playwright) · [Security Tests](#security-tests)
- [MCP Integration](#mcp-integration)
- [Learning System](#learning-system)
- [CMS Interoperability Framework](#cms-interoperability-framework)

---

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Target User** | Original Medicare & Medicare Advantage patients & caregivers |
| **NOT for** | Commercial payers, Medicaid, billers, coders |
| **Tone** | Warm, simple, no jargon, empathetic, 8th grade reading level |
| **Anonymous** | 1 message/day, no signup |
| **Trial** | 14-day free trial, 3 msgs/day, 1 appeal credit (email OTP) |
| **Paid** | $10/appeal (5 msgs/day) or $20/month (3 appeals, unlimited msgs) |
| **Tech Stack** | Next.js PWA, Supabase (auth + DB), Claude API (agentic), Stripe |
| **AI Model** | Claude via Beta API with MCP servers |
| **Deploy** | Vercel |

---

## Critical Rules

These cause bugs or bad UX if violated. Read before every coding session.

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

- Do NOT store: Full names, addresses, SSN, insurance IDs, medical records
- OK to store: Email, phone (for auth), anonymized phrases, conversation content
- Account deletion: Cascade delete all user-linked data, cancel Stripe, retain anonymized learning data

### Performance & Reliability

- **CRITICAL: Never block UI rendering on database operations.** In `useChat.ts`, `setMessages()` must run IMMEDIATELY after parsing the API response. Database saves (`saveMessage`, `claimConversation`) must be fire-and-forget (`.then()/.catch()`, not `await`). Blocking on Supabase causes the "Thinking..." spinner to hang indefinitely even when the API returns 200.
- **CRITICAL: Server route creates conversations with `authSupabase`, not browser client.** `route.ts` creates conversations directly using the cookie-authenticated server client (`authSupabase` from `createServerSupabaseClient()`), setting `user_id` at creation time. Never use `getClient()`/`createClient()` (browser client) for DB writes in server route handlers — they have NO auth context server-side, so `auth.uid()` is always NULL, causing RLS to insert `user_id=NULL`. Client-side `claimConversation()` exists as a fallback but is unreliable. Message saves (`saveMessage`) are fire-and-forget after conversation creation.
- **CRITICAL: Auth detection pattern — follow AppHeader, not ad-hoc.** The canonical pattern for detecting auth in client hooks is in `AppHeader.tsx`. Three rules MUST be followed:
  1. **Use `onAuthStateChange` without event-type filtering.** Check `session?.user` existence, NOT the event name. Supabase fires `INITIAL_SESSION` on subscribe with the current session — filtering for only `SIGNED_IN`/`TOKEN_REFRESHED` misses this event, causing auth-dependent UI to stay stuck in "not signed in" state.
  2. **Set UI state immediately from the session object, then fetch DB data non-blocking.** Never block on profile/plan/MFA/usage queries before showing the signed-in UI. In `useAuth.ts`, `setBasicAuth()` sets email+userId+isLoading=false instantly; `loadProfileData()` enhances with plan/trial/MFA afterward. Blocking on DB queries causes the Settings "Checking account..." spinner to hang.
  3. **Use `getClient()` singleton, not `createClient()`.** `createClient()` may return a new reference each render, destabilizing `useEffect` dependency arrays. `getClient()` caches one instance. This applies to ALL client-side Supabase callers — hooks AND service modules (e.g., `conversation-service.ts`). Using `createClient()` in `claimConversation()` caused conversations to stay unclaimed (`user_id=NULL`) because the new client instance didn't always carry the auth session.
  - **DO:** `(_event, session) => { if (session?.user) { handleSignedIn(session.user); } else { handleSignedOut(); } }`
  - **DON'T:** `(event, session) => { if (event === "SIGNED_IN") { ... } }` — misses `INITIAL_SESSION`
  - **DON'T:** `await getSession()` as the sole auth check — cookies may not be parsed yet on mount
  - **DON'T:** `import { createClient } from "./supabase"` in client-side service modules — use `getClient()` to share the authenticated session
- **Timeout guards on pre-Claude async calls**: `route.ts` uses `withFallback()` for non-critical Supabase queries before the Claude API call (e.g., `getUnreportedOutcome` at 5s, `buildSystemPromptWithLearning` at 10s). Falls back to defaults on timeout instead of blocking.
- **AbortController for Claude API**: `withTimeout()` in `claude.ts` uses `AbortController` to truly cancel hung requests (not just `Promise.race`). 60s per iteration for Sonnet, 120s for Opus.
- **CRITICAL: Supabase SSR middleware is required.** `src/middleware.ts` refreshes auth tokens on every request, preventing the refresh token race condition between browser and server Supabase clients. Without it, both clients independently try to refresh the same expired token — one wins (`token_refreshed`), the other gets `token_revoked` and loses its session permanently. The middleware refreshes ONCE via `supabase.auth.getUser()` and writes updated cookies to the response.
- **CRITICAL: Never use browser Supabase client for data fetching.** Browser `getClient()` + `.from("table").select()` fails when tokens are stale (even with middleware, there are edge cases). Always fetch data via server API routes using `createServerSupabaseClient()` (cookie-authenticated). Pattern: client calls `fetch("/api/route")` → server route uses `createServerSupabaseClient()` → returns JSON. Examples: `useConversationHistory` → `/api/conversations`, `useHealthData` → `/api/fhir/data`, `useAuth`/`AppHeader` → `/api/profile`.
- **Client-side timeout**: `useChat.ts` wraps `fetch()` with a 330s `AbortController` to prevent infinite hangs on the client.
- **CRITICAL: SSR-safe hooks must initialize with server-matching values.** `useOnlineStatus` must use `useState(true)` — NOT `useState(typeof navigator !== "undefined" ? navigator.onLine : true)`. The latter reads `navigator.onLine` on the client during hydration, which may return `false` (flaky connection, SW cached page), causing React hydration mismatch (#418) because the server rendered `null` but the client renders a div.
- **MCP servers are NOT testable via curl/HTTP.** MCP protocol is handled internally by the Anthropic API. Use Claude.ai to verify MCP server health.

---

## Key Files

Where to find specific logic in the codebase.

| File | What It Does |
|------|-------------|
| `src/app/api/chat/route.ts` | Main chat endpoint. Orchestrates: rate limiting → extractUserInfo → detectTriggers → buildSystemPrompt → chat loop → persistLearning |
| `src/lib/claude.ts` | Claude API client. MCP server config, Beta API call, tool-use loop, SessionState type |
| `src/lib/tools/index.ts` | All 12 local tool definitions + executors (search_cpt, lookup_denial_code, generate_appeal_letter, etc.) |
| `src/lib/skills-loader.ts` | Conditional prompt builder. Loads skill sections based on SkillTriggers (onboarding, symptom gathering, coverage, appeal, etc.) |
| `src/lib/denial-patterns.ts` | Async Supabase queries for denial patterns and appeal levels. `getAppealStrategyForCARC()`, `getDenialPatternsForCPT()` |
| `src/lib/audit.ts` | Audit logging utility. `logAudit(action, options)` writes to `audit_logs` via admin client (bypasses RLS). Non-blocking fire-and-forget. Write-side dedup: `FHIR_DATA_ACCESS` skips insert if same user+action logged within 2h (`DEDUP_WINDOWS` map) |
| `src/lib/fhir/` | Blue Button 2.0 FHIR library: `crypto.ts` (AES-256-GCM encryption), `tokens.ts` (refresh), `client.ts` (FHIR API), `transforms.ts` (FHIR→UI types + `transformEOB()` extracts PDE info/careTeam/POS/inpatient fields + `classifyDiabetesStatus()`), `eob-clinical.ts` (clinical extraction pipeline — see EOB Extraction Pipeline below), `context.ts` (AI prompt injection: coverage + labs + conditions + medications + screenings + providers + hospitalizations + classification + lab trends + denials), `sync.ts` (cache sync: Patient + Coverage + EOB → extract all clinical data → cache 8 resource types), `snapshots.ts` (append diabetes labs to `diabetes_snapshots` for longitudinal tracking) |
| `src/lib/diabetes-insights.ts` | Claude-powered diabetes insight generation. `generateDiabetesInsight(data)` calls Sonnet for structured analysis, `computeDataHash()` for change detection to avoid redundant API calls |
| `src/components/diabetes/` | Diabetes dashboard components: `A1CTrendChart` (SVG sparkline + list toggle), `ScreeningReminders` (due date alerts from CPT-based `ScreeningHistory[]`), `RiskAlerts` (proactive alerts: high A1C, missing meds, trending up, med refill gaps, specialty gaps, post-discharge follow-up), `QuickLog` (4-tab daily entry form: glucose/activity/meal/note), `InsightsCard` (Claude-generated analysis display) |
| `src/components/health/DiagnosisSummaryCard.tsx` | Renders "Conditions in Your Claims" list with severity color-coding. `getSeverityConfig()`: structured `DiagnosisSummary` category → `RED_KEYWORDS` (18 terms: neoplasm, cancer, stroke, heart failure, etc.) → `AMBER_KEYWORDS` (27 terms: hypertension, thyroid, anemia, COPD, etc.) → gray. `cleanDiagnosisName()` strips U+25CC combining mark artifacts from FHIR data |
| `src/hooks/useDiabetesSnapshots.ts` | Fetches longitudinal lab data from `diabetes_snapshots`. Returns `{ snapshots, a1cHistory, isLoading }` |
| `src/hooks/useDiabetesLog.ts` | CRUD for daily log entries via `/api/diabetes/log`. Returns `{ entries, isLoading, addEntry, deleteEntry }`. IndexedDB cache + offline queue for POST (optimistic local add) |
| `src/hooks/useDiabetesInsights.ts` | AI insight fetch/refresh via `/api/diabetes/insights`. Returns `{ insight, isLoading, refresh }`. IndexedDB write-through + offline fallback |
| `src/components/layout/AppHeader.tsx` | Universal header (root layout). Auth-aware Sign In / Settings gear. Desktop nav + mobile hamburger. Colored icons |
| `src/components/layout/BottomTabs.tsx` | Mobile bottom nav for `/app/*` pages: Home, Health, Ask Denali, Settings |
| `src/components/landing/LandingFooter.tsx` | Footer for landing + blog: brand left, legal links right (FAQ, Privacy, HIPAA) |
| `src/hooks/useAuth.ts` | Auth state: email OTP, TOTP MFA enroll/challenge, AAL tracking, plan/role/trial/admin detection, credit-based appeal access gating (`appealCredits`), auto-trial on signup. Profile data fetched from `/api/profile` (server route), NOT browser Supabase client |
| `src/hooks/useConsent.ts` | Consent preferences: fetches/updates `consent_preferences` table, gates health data injection |
| `src/hooks/useHealthData.ts` | Blue Button FHIR data: connect/disconnect/refresh, fetches from `/api/fhir/data`. Returns patient, coverage, claims, labs, conditions, medications, screenings, providers, hospitalizations. IndexedDB write-through + offline fallback |
| `src/config/api.ts` | API endpoints, Claude model config, Blue Button OAuth config (scopes, callback path) |
| `src/config/pricing.ts` | Pricing constants: credit amounts (`TRIAL_APPEAL_CREDITS: 1`, `MONTHLY_APPEAL_CREDITS: 3`), trial duration, daily chat limits (`ANON: 1`, `TRIAL: 3`, `PER_APPEAL: 5`, `PAID: 0`), Stripe price IDs. `MONTHLY.appealLimit: 3` |
| `src/lib/stripe-fulfillment.ts` | Stripe payment fulfillment: `fulfillCheckoutSession()` (checkout → plan upgrade + credit add), `handleSubscriptionEvent()` (lifecycle + monthly credit reset). Uses admin client |
| `src/components/payment/PaywallModal.tsx` | Paywall UI: plan selection (single/monthly), Stripe checkout redirect. CSS variables for theme. No dev bypass |
| `src/components/appeal/AppealGate.tsx` | Appeal access orchestration: email OTP → TOTP → access check → PaywallModal pipeline |
| `src/middleware.ts` | Supabase SSR middleware. Refreshes auth tokens on every request to prevent browser/server refresh token race. MUST run before any Supabase client call |
| `src/lib/offline-cache.ts` | IndexedDB wrapper via `idb`. 6 stores (conversations, health-data, diabetes-log, diabetes-insights, profile, offline-queue). Exports `cacheSet()`, `cacheGet()`, `cacheGetIfFresh()`, `queueOfflineRequest()`, `getOfflineQueue()`, `removeFromQueue()`. TTL constants: profile=4h, everything else=24h |
| `src/lib/offline-sync.ts` | Client-side offline queue processor. `processQueue()` replays failed POSTs, removes on success, drops after 3 retries. `getQueueCount()` for pending item count |
| `src/hooks/useOnlineStatus.ts` | SSR-safe hook: always inits `true` (matches SSR), syncs `navigator.onLine` in `useEffect`. Returns `{ isOnline, wasOffline }` |
| `src/components/ui/OfflineBanner.tsx` | Fixed amber-accent banner below AppHeader when offline. Auto-dismisses on reconnect |
| `src/hooks/useIdleTimeout.ts` | HIPAA inactivity timeout. Tracks mouse/key/touch/scroll (1s throttle), warns at 13 min, signs out at 15 min. Auth-gated (no-op for anon). Returns `{ showWarning, secondsRemaining, staySignedIn, isAuthenticated }` |
| `src/components/ui/InactivityWarning.tsx` | Fixed amber-accent banner with countdown + "Stay signed in" button. Same positioning as OfflineBanner. Rendered in root `layout.tsx` |
| `src/hooks/useConversationHistory.ts` | Chat sidebar history. Fetches from `/api/conversations` (server route, cookie-authenticated) — NOT browser Supabase client. Subscribes to `onAuthStateChange` for re-fetch on sign-in/out. Groups conversations by date. IndexedDB write-through + offline fallback |
| `src/lib/conversation-service.ts` | Conversation persistence: create, load, claim, save messages, appeals (+ credit decrement), feedback, events. Uses `getClient()` singleton for auth context |
| `src/components/layout/Sidebar.tsx` | Chat sidebar: new chat button, conversation history grouped by date with timestamps. Refreshes on both new conversation creation AND new chat click (via `useRef` tracking previous conversationId). No sign-in prompt — anon users see "No conversations yet" |
| `src/types/database.ts` | Supabase-generated TypeScript types. Regenerate with `npx supabase gen types` |

### API Routes

```
src/app/api/
  chat/route.ts               # Main chat with Claude + tools + MCP
  conversations/route.ts      # Conversation history (server-side, cookie-auth)
  profile/route.ts            # User profile: plan, role, is_admin, appeal count + credits (server-side, cookie-auth)
  appeal-outcome/route.ts     # Record appeal results
  account/delete/route.ts     # GDPR/CCPA account deletion
  checkout/route.ts           # Stripe payment
  consent/route.ts            # Consent preferences (GET/PUT)
  trial/route.ts              # 14-day trial (GET status / POST start)
  cms-metadata/route.ts       # Public CMS app directory metadata
  fhir/authorize/route.ts     # Blue Button OAuth initiation (PKCE + state)
  fhir/callback/route.ts      # Blue Button OAuth callback (token exchange)
  fhir/data/route.ts          # FHIR data retrieval + caching
  fhir/disconnect/route.ts    # Revoke Blue Button connection
  diabetes/log/route.ts       # Quick log CRUD (glucose, activity, meal, note)
  diabetes/insights/route.ts  # AI insights GET/POST (Claude-generated diabetes analysis)
  webhooks/stripe/route.ts    # Stripe webhook events
```

---

## Architecture

```
User (Chat UI) ──> Claude Agent (Brain) ──> Tools (APIs + Supabase)
                          │
                          v
                    Supabase (Memory)
```

- **Frontend is dumb** — just renders what Claude returns
- All intelligence lives in Claude + skills + tools
- Domain skills are implemented via Claude tool calling in `/api/chat`, NOT separate edge functions
- Tools are interchangeable (swap APIs without frontend changes)

### Two-Tier Tool System

Claude has access to two types of tools, handled differently:

| Type | Invoked By | Handled By | Content Block |
|------|-----------|------------|---------------|
| **MCP tools** (ICD-10, CMS, NPI) | Claude directly via Beta API | API auto-handles results | `mcp_tool_use` / `mcp_tool_result` |
| **Local tools** (CPT, CARC/RARC, appeal, etc.) | Claude requests, server executes | `processToolCalls()` in chat loop | `tool_use` / `tool_result` |

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

| Field | Populated By | Mechanism |
|-------|-------------|-----------|
| `diagnosisCodes` | MCP `search_icd10` / Local `generate_appeal_letter` | Regex from Claude text / `updateSessionFromToolResults()` |
| `procedureCodes` | Local `search_cpt` / `generate_appeal_letter` | `updateSessionFromToolResults()` |
| `denialCodes` | Local `lookup_denial_code` / User message | `updateSessionFromToolResults()` + `extractUserInfo()` regex (CO-50, PR-1, CARC 167, RARC N56 patterns — gated on appeal context to avoid false positives) |
| `policyReferences` | MCP `search_local_coverage` / `search_national_coverage` | Regex from Claude text (LCD L\d{5}, NCD patterns) |
| `priorAuthRequired` | Local `check_prior_auth` | `updateSessionFromToolResults()` |
| `denialDate` | User message | `extractUserInfo()` regex |
| `isAppeal` | User message | `extractUserInfo()` keyword detection |
| `maPlanName` | Blue Button coverage / User message | Auto-detected from Part C coverage in `chat/page.tsx` / `extractUserInfo()` |

---

## Tools & Data Sources

### MCP Tools (external, auto-handled by API)

| Server | URL | Tools | Data |
|--------|-----|-------|------|
| `cms-coverage` | `mcp.deepsense.ai/cms_coverage/mcp` | search_local_coverage, search_national_coverage, get_coverage_document | LCD/NCD coverage policies |
| `npi-registry` | `mcp.deepsense.ai/npi_registry/mcp` | npi_lookup, npi_search | Provider NPI, specialty, Medicare status |
| `icd10-codes` | `mcp.deepsense.ai/icd10_codes/mcp` | search_icd10 | ICD-10 diagnosis codes |

### Local Tools (defined in `src/lib/tools/index.ts`)

| Tool | Purpose | Data Source |
|------|---------|-------------|
| `search_cpt` | Map procedure descriptions to CPT codes | AMA API (dev only) |
| `get_related_diagnoses` | CPT -> related ICD-10 codes | Local mappings |
| `get_related_procedures` | ICD-10 -> related CPT codes | Local mappings |
| `check_prior_auth` | Check if CPT requires prior auth (CMS PA Model + expanded list) | Local rules + CMS PA Model categories |
| `check_preventive` | Check if service is preventive (no cost-sharing) | Local rules |
| `search_pubmed` | Clinical evidence search (rate-limited) | NCBI E-utilities |
| `generate_appeal_letter` | Build appeal letter (Level 1 Redetermination for Original Medicare, Organization Determination Appeal for MA) with inline codes + policy refs + PubMed citations. Accepts `medicare_type` and `plan_name` params for MA branching | Combines multiple sources + policy_references + pubmed_citations inputs |
| `check_sad_list` | Part B (physician) vs Part D (self-administered) drug routing | CMS SAD list |
| `lookup_denial_code` | CARC/RARC code lookup + appeal strategy | Supabase `carc_codes`, `rarc_codes`, `eob_denial_mappings` |
| `get_common_denials` | Top denial reasons for a procedure + prevention tips | Supabase (`denial_patterns` + `carc_codes`) |

### Data Inventory

| Dataset | Status | Source |
|---------|--------|--------|
| ICD-10 | Full | MCP server |
| CPT | Dev only (AMA license required for prod) | Local AMA API |
| NPI | Full | MCP server |
| NCD/LCD | Full | MCP server |
| PubMed | Full | NCBI API |
| CARC codes | 90 codes | Supabase (from CMS, effective 2025-12-10) |
| RARC codes | 195 codes | Supabase (from CMS, effective 2025-12-10) |
| EOB-to-CARC/RARC mappings | 1,873 mappings | Supabase (from CMS, effective 2025-12-10) |

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth, phone (primary), email, plan (`trial`/`per_appeal`/`monthly` — CHECK constraint), `is_admin` (bypass all limits), theme, accessibility settings |
| `user_verification` | Email + mobile OTP status |
| `subscriptions` | Plan type (`trial`/`per_appeal`/`monthly` — CHECK constraint), Stripe customer ID, billing status, `trial_start`/`trial_end`/`trial_converted`. RLS: users SELECT/INSERT/UPDATE own rows |
| `usage` | Appeal count (lifetime) + appeal credits (available) per email. Credits decremented on appeal save, added by Stripe fulfillment |
| `conversations` | Chat history per user |
| `messages` | Individual messages (role: user/assistant) |
| `appeals` | Generated appeal letters with codes, policy refs, `carc_codes TEXT[]`, `rarc_codes TEXT[]` |
| `user_feedback` | Thumbs up/down + corrections |
| `audit_logs` | CMS compliance audit trail — who, what, when, why (IP, user agent). RLS: users read own logs, service role writes. High-frequency actions (FHIR_DATA_ACCESS) deduped on write (2h window). API groups by action+day with count for Settings display |
| `consent_preferences` | Per-user consent toggles: `health_data_ai`, `health_data_storage`, `analytics`. Versioned, audit-logged on change |
| `ehr_connections` | Blue Button OAuth tokens (AES-256-GCM encrypted), FHIR patient ID, connection status |
| `fhir_cache` | Transformed FHIR data (patient, coverage, eob, conditions, medications, screenings, providers, hospitalizations), 24h TTL. RLS-protected reads |
| `diabetes_snapshots` | Append-only longitudinal lab history. Unique on `(user_id, loinc_code, observed_date)`. RLS: users read own, service_role inserts. Auto-populated on FHIR sync |
| `diabetes_log` | User-entered daily entries (glucose/activity/meal/note). Any signed-in user. CHECK constraint on entry_type. RLS: users CRUD own |
| `diabetes_insights` | Claude-generated diabetes analysis (summary, recommendations, risk_alerts, screening_reminders). Unique on user_id. Hash-based dedup avoids redundant Claude calls. RLS: users read own, service_role manages |
| `chat_daily_usage` | Daily chat message rate limiting. Columns: `identifier` (user_id or IP), `usage_date`, `message_count`. Unique on `(identifier, usage_date)`. Managed by `check_and_increment_chat` RPC |

### Denial Code Tables

| Table | Purpose | Row Count |
|-------|---------|-----------|
| `carc_codes` | Claim Adjustment Reason Codes (the "why" of a denial) | 90 |
| `rarc_codes` | Remittance Advice Remark Codes (additional detail) | 195 |
| `eob_denial_mappings` | Maps payer EOB codes to standard CARC/RARC | 1,873 |
| `denial_patterns` | Common denial reasons with appeal strategies, CPT lists, checklists, success rates | 12 |
| `appeal_levels` | Medicare's 5 appeal levels with timeframes and success rates | 5 |

**Versioning**: All five tables use `effective_date` column. Views `carc_codes_latest`, `rarc_codes_latest`, `eob_denial_mappings_latest`, `denial_patterns_latest`, `appeal_levels_latest` always return `WHERE effective_date = MAX(effective_date)`. When CMS publishes updates, insert new rows with a newer `effective_date`; old rows stay for history.

### Learning Tables (No User Link)

| Table | Purpose |
|-------|---------|
| `symptom_mappings` | "dizzy spells" -> R42 (confidence-based) |
| `procedure_mappings` | "back scan" -> 72148 (confidence-based) |
| `coverage_paths` | Successful dx + px + policy combinations |
| `conversation_patterns` | Successful question sequences by intent |
| `appeal_outcomes` | Real-world appeal results (user-reported) |
| `policy_cache` | Medicare policy tracking and change detection |
| `user_events` | User behavior tracking for UX optimization |
| `learning_queue` | Async job queue for background learning |

### Key Functions

| Function | Purpose |
|----------|---------|
| `check_appeal_access(email)` | Returns 'free', 'paywall', or 'allowed' (legacy — client now checks `appeal_credits` directly) |
| `increment_appeal_count(email)` | Increments lifetime appeal counter |
| `decrement_appeal_credit(p_email)` | Decrements available credit, returns remaining (-1 if none). SECURITY DEFINER |
| `add_appeal_credits(p_email, p_credits)` | Adds credits (used by Stripe single-payment fulfillment). SECURITY DEFINER |
| `reset_monthly_appeal_credits(p_email, p_credits)` | Resets credits to N (used by Stripe monthly renewal). SECURITY DEFINER |
| `process_feedback(message_id, rating, correction)` | Handle thumbs up/down, update mappings |
| `update_symptom_mapping(phrase, code, boost)` | Upsert symptom -> ICD-10 |
| `update_procedure_mapping(phrase, code, boost)` | Upsert procedure -> CPT |
| `record_appeal_outcome(appeal_id, outcome, ...)` | Store user-reported result |
| `get_learning_context(symptoms, procedures)` | Get learned data for prompts |
| `search_denial_codes(search_text)` | Full-text search across CARC/RARC/EOB tables |
| `get_denial_pattern_for_carc(carc_code)` | Match CARC code to denial pattern with appeal strategy |
| `get_denial_patterns_for_cpt(cpt_code)` | Get denial patterns commonly associated with a CPT code |
| `check_and_increment_chat(p_identifier, p_daily_limit)` | Atomic rate limit check: returns `{allowed, count}`. SECURITY DEFINER — upserts `chat_daily_usage` and increments count if under limit |
| `get_grouped_audit_logs(p_user_id, p_limit, p_offset)` | Returns audit logs grouped by `action + resource_type + DATE(created_at)` with `entry_count`. SECURITY DEFINER. Used by `/api/audit-log` for daily grouping with count badges |
| `delete_user_cascade(user_id)` | GDPR/CCPA compliant deletion |

---

## Skills & Prompt System

Skills are conditional prompt sections loaded by `skills-loader.ts` based on `SkillTriggers` detected in `route.ts`.

### Skill Loading Order & Gates

The system uses gates that return early and prevent later skills from loading prematurely:

| Priority | Trigger | Skill Loaded | Gate Behavior |
|----------|---------|-------------|---------------|
| 1 | Emergency symptoms detected | RED_FLAG_SKILL | Highest priority, overrides all |
| 2 | Missing name OR ZIP | ONBOARDING | + TOOL_RESTRAINT (no tools allowed) |
| 3 | Has procedure but missing symptoms/duration | SYMPTOM_GATHERING | + TOOL_RESTRAINT (+ PROCEDURE_SKILL for clarification) |
| 4 | Has symptom info but no provider confirmed | PROVIDER_VERIFICATION | NPI tools only |
| 5 | Has procedure or needs clarification | PROCEDURE_SKILL | Disambiguate procedure type/region |
| 6 | Has procedure or coverage or appeal | CODE_VALIDATION | ICD-10 <-> CPT mapping + prior auth check + preventive check + SAD list |
| 7 | Has coverage but not all requirements verified | REQUIREMENT_VERIFICATION | Ask 1 requirement at a time |
| 8 | Provider confirmed + specialty mismatch | SPECIALTY_VALIDATION | Warn about ordering specialty risk |
| 9 | Has coverage and `verificationComplete === true` | GUIDANCE_DELIVERY | Proactive checklist + denial warnings + prior auth status. **NOTE**: Guidance no longer loads when requirements are simply empty (vacuous truth fix) — Claude must emit `[REQUIREMENTS]` block and user must verify or skip |
| 10 | Appeal detected | APPEAL_SKILL | Denial code lookup + strategy + PubMed evidence + letter generation (MA-aware: Organization Determination Appeal for Advantage plans) |
| 11 | User asks about bills/claims + has health data | EOB_EXPLAINER_SKILL | Explains claims, charges, Medicare payment rules, denial reasons in plain English |

**TOOL_RESTRAINT**: During onboarding and symptom gathering, the prompt explicitly forbids all tool calls. This prevents Claude from jumping ahead to code lookups before gathering enough context.

**Requirement Verification Pipeline**: After coverage lookup, Claude MUST emit a `[REQUIREMENTS]` block listing LCD/NCD requirements. This populates `requirementsToVerify` in sessionState. Without it, verification cannot proceed. Three safety mechanisms prevent stuck states: (1) step 9b flow reminder prompts Claude to emit the block, (2) explicit skip detection for "skip"/"move on", (3) implicit skip detection when user requests guidance directly with empty requirements. Guidance delivery (priority 9) only loads when `verificationComplete` is explicitly true — never on empty requirements.

### Base Prompt (always loaded)

- Identity & mission (denial prevention, plain English, empathy)
- Conversation rules (one question, brief responses, explain "why")
- Error handling (graceful failures, progressive disclosure)

### Additional Skills (Loaded Contextually)

| Skill | File | Trigger |
|-------|------|---------|
| `HEALTH_RECORDS_SKILL` | `src/lib/skills/health-records.ts` | `hasHealthData` or `hasRecentDenials` |
| `MEDICARE_NOTIFICATIONS_SKILL` | `src/lib/skills/medicare-notifications.ts` | `hasHealthData && hasRecentChanges` |
| `DIABETES_PREVENTION_SKILL` | `src/lib/skills/diabetes-prevention.ts` | `hasDiabetesContext` |
| `EOB_EXPLAINER_SKILL` | `src/skills/domain/eob-explainer.ts` | `hasEOBQuestion && hasHealthData` — user asks about bills/claims with Blue Button connected |
| `OUTCOME_PROMPTING_SKILL` | `src/skills/domain/outcome-prompting.ts` | Returning user with pending appeal (`hasUnreportedOutcome`). Outcome reported via `/api/appeal-outcome` → `recordAppealOutcome()` + `applyOutcomeIncentive()` (free appeal credit) |
| `COUNSELOR_SKILL` | `src/skills/channel/counselor.ts` | `role === "counselor"` |
| `PROVIDER_PILOT_SKILL` | `src/skills/channel/provider.ts` | `role === "provider"` |

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

**MA branching**: When `sessionState.medicareType === "advantage"`, `generate_appeal_letter` is called with `medicare_type: "advantage"` and `plan_name` from `sessionState.maPlanName`. The letter uses "Organization Determination Appeal" (not "Level 1 Redetermination"), addresses the plan (not MAC), and cites 42 CFR §422.101. Appeal levels differ for MA: Level 1 → plan, Level 2 → IRE (not QIC), Levels 3-5 same as Original Medicare.

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

| Plan | Price | Appeals | Chat Messages/Day | Auth Required |
|------|-------|---------|-------------------|---------------|
| Anonymous | $0 | — | 1 | None |
| Trial (14 days) | $0 | 1 credit | 3 | Email OTP |
| Expired (post-trial) | — | — | 0 (locked) | Email OTP |
| Pay Per Appeal | $10/appeal | 1 credit per purchase | 5 | Email OTP |
| Monthly | $20/month | 3 credits/month | Unlimited | Email OTP |
| **Admin** | — | Unlimited | Unlimited | `is_admin = TRUE` on `users` row |

Every signup = automatic 14-day trial. After trial expires → locked (0 chats, must pay). Plan values are `trial`, `per_appeal`, `monthly` only (no `free` — unified into `trial`). Appeal access is credit-based via `usage.appeal_credits` column. `AppealAccessStatus` returns `"available"` (has credits), `"paywall"` (no credits), or `"allowed"` (admin/counselor). Chat rate limiting enforced via `check_and_increment_chat` RPC (identifier = user_id for authenticated, IP for anonymous). Returns 429 when limit exceeded; returns 403 `TRIAL_EXPIRED` when expired trial users try to chat. **Admin users** (`users.is_admin`) bypass all rate limits and appeal paywalls.

### Auth Gating

| Feature | Auth Required |
|---------|---------------|
| Anonymous chat (1 msg/day) | None |
| 14-day trial (3 msgs/day, 1 appeal credit) | Email OTP |
| Post-trial (locked) | Email OTP + Payment to continue |
| Per-appeal (5 msgs/day, 1 credit per $10) | Email OTP + Payment |
| Monthly (unlimited chat, 3 appeals/month) | Email OTP + $20/month |
| Medicare health data | Email OTP + Blue Button OAuth (+ TOTP challenge if user has opted in) |

### AAL2 Compliance Strategy (CMS A1 / NIST 800-63B)

**Blue Button satisfies CMS A1** — Blue Button OAuth via Medicare.gov handles IAL2/AAL2 as intermediary PHR path. TOTP MFA is opt-in (Settings > Security) for extra protection, never required. WebAuthn/passkeys NOT supported by Supabase. Future P1: email+password + TOTP if CMS tightens requirements.

### Appeal Gating Logic

```
1. User requests appeal letter
2. Check email:
   - Not verified -> Signup wall (email OTP → auto-trial with 1 credit)
   - Verified, appeal_credits > 0 -> Generate letter, decrement credit, increment count
   - Verified, appeal_credits = 0 -> Show paywall ($10 single or $20/month)
3. After payment -> Credit added, reveal letter
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

**Sandbox tested** (2026-02-11): Both plans verified end-to-end on denali.health — $10 single appeal checkout and $20/month subscription checkout complete successfully via Stripe sandbox. Switch to live keys for production.

**Checkout route** (`checkout/route.ts`): Expects `plan: "single" | "monthly"` (not `"per_appeal"`). Maps to Stripe Price IDs via `PRICING.SINGLE_APPEAL.stripePriceId` / `PRICING.MONTHLY.stripePriceId`.

Key webhook events: `checkout.session.completed` → `fulfillCheckoutSession()` (reads metadata → plan upgrade to `per_appeal` or `monthly` + credit add). `customer.subscription.updated/deleted` → `handleSubscriptionEvent()` (syncs status). `invoice.payment_failed` → marks `past_due`.

Subscription states: `active` (full access) → `past_due` (retry) → `cancelled` (reverts to expired/locked).

### Stripe Critical Rules

- **CRITICAL: `checkout/route.ts` must use `createServerSupabaseClient()`** — browser client has no auth context server-side, `user.id` would be empty, `fulfillCheckoutSession()` skips upgrade.
- **CRITICAL: Never return `{ url: null }` from checkout** — grants free access. Returns 503 error when Stripe not configured.
- **Stripe SDK v20**: `current_period_end` lives on `subscription.items.data[0]`, NOT directly on `subscription`.
- **Idempotent fulfillment**: `fulfillCheckoutSession()` is safe to call multiple times.
- **Settings page PaywallModal**: Upgrade button in Settings opens `PaywallModal` inline (not redirect to `/app/chat`). Settings displays "Monthly Plan" (not "Unlimited Plan") with subtitle showing credits/month + unlimited messages.

### Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_APPEAL_MODEL=claude-opus-4-6    # No date suffix — Opus for appeals
BLUEBUTTON_CLIENT_ID=...          # CMS Blue Button OAuth client ID
BLUEBUTTON_CLIENT_SECRET=...      # CMS Blue Button OAuth client secret
BLUEBUTTON_BASE_URL=https://sandbox.bluebutton.cms.gov  # or production URL
FHIR_TOKEN_ENCRYPTION_KEY=...     # 32-byte hex key for AES-256-GCM token encryption
STRIPE_SECRET_KEY=sk_...                       # Stripe secret key (sandbox or live)
STRIPE_WEBHOOK_SECRET=whsec_...                # Stripe webhook signing secret
STRIPE_PRICE_PAY_PER_CLAIM=price_...           # Stripe Price ID for $10 single appeal
STRIPE_PRICE_UNLIMITED_MONTHLY=price_...       # Stripe Price ID for $20/month subscription
STRIPE_PRICE_UNLIMITED_ANNUAL=price_...        # Stripe Price ID for annual plan (reserved)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...      # Stripe publishable key (client-side, not currently used)
```

---

## Blue Button 2.0 (Medicare FHIR API)

Blue Button connects patients to their Medicare claims data via FHIR APIs. It is the **only** external health data source — Denali does not integrate with any EHR platforms or third-party health data services.

### Data Availability

What Blue Button provides and what it does not:

| Data | Available |
|------|-----------|
| Medicare claims, denials, what was billed/paid | ✅ |
| Actual lab values (A1C, glucose, reference ranges) | ❌ — only that the lab was performed (CPT code), not the value |
| Vitals (BP, weight, BMI) | ❌ |
| Conditions | ⚠️ Inferred from EOB ICD-10 codes, not a formal diagnosis list |
| Medications | ⚠️ Part D claims only — no dosing, prescriber, or full medication record |
| Immunizations | ❌ |
| Clinical notes | ❌ |
| Visit history | ⚠️ Claims-derived (service dates + CPT codes), no chief complaint |

Note: `diabetes_snapshots` table stores longitudinal lab history but actual lab values are not available from Blue Button — only the dates labs were performed.

### OAuth Flow (PKCE)

```
1. User clicks "Connect Medicare" on /app/health
2. GET /api/fhir/authorize:
   - Generate state (CSRF) + code_verifier (PKCE)
   - Compute code_challenge = SHA256(code_verifier) → base64url
   - Store state + code_verifier in httpOnly cookies (10 min TTL)
   - Redirect to CMS: /v2/o/authorize/?client_id=...&code_challenge=...&code_challenge_method=S256
3. User authorizes on CMS site → redirected to /api/fhir/callback?code=...&state=...
4. GET /api/fhir/callback:
   - Validate state cookie
   - Read code_verifier cookie
   - POST /v2/o/token/ with {code, code_verifier, redirect_uri} + Basic Auth
   - Encrypt tokens (AES-256-GCM) → upsert ehr_connections
   - Clear cookies → redirect to /app/health?connected=true
```

### Scopes

`patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read profile openid`

### Token Security

- Access & refresh tokens encrypted at rest via `FHIR_TOKEN_ENCRYPTION_KEY` (AES-256-GCM)
- Token writes use admin client (bypasses RLS); reads via server client (respects RLS)
- Auto-refresh on expired access tokens via `refreshAccessToken()` in `lib/fhir/tokens.ts`

### Health Data in AI

- Client-side `useHealthData()` fetches from `/api/fhir/data` → populates sessionState fields (`healthDataAvailable`, `activeCoverage`, `recentDenials`, `labs`, `conditions`, `medications`, `screenings`, `providers`, `hospitalizations`, `diabetesClassification`)
- Chat page bridges health data into `useChat` via `initialSessionState` (built with `useMemo`, synced via `useEffect` for async loading). Also auto-detects Medicare type from Blue Button coverage: Part C → `medicareType: "advantage"` + `maPlanName`; Part A/B → `medicareType: "original"`. `recentClaims` includes `denialReasons` for denied claims.
- Server-side `buildHealthContextForPrompt()` injects health context into Claude system prompt: active coverage (+ MA plan name if present), lab results (with clinical interpretations), diabetes diagnoses, active medications (with PDE supply/gap data), screenings (with overdue alerts), care team providers, recent hospitalizations (with follow-up flags), diabetes classification with action directives, recent denials (gated by `health_data_ai` consent), denial reasons on individual claims
- `HEALTH_RECORDS_SKILL` loaded when `hasHealthData` or `hasRecentDenials` triggers fire
- `EOB_EXPLAINER_SKILL` loaded when `hasEOBQuestion && hasHealthData` — user asks about bills/claims with Blue Button connected
- `DIABETES_PREVENTION_SKILL` loaded when `hasDiabetesContext` triggers (from conditions, labs, or user keywords)

### EOB Extraction Pipeline

`eob-clinical.ts` mines clinical intelligence from EOB claims data (since Blue Button doesn't provide Observation/Condition/MedicationRequest resources directly). Four extraction layers:

| Function | Input | Output | Key Logic |
|----------|-------|--------|-----------|
| `extractConditionsFromClaims()` | All claims | `DiagnosisSummary[]` | Scans `diagnosisCodes[]` for diabetes ICD-10 prefixes (E10, E11, E13, R73, E66). Dedupes by code, keeps most recent date |
| `extractMedicationsFromClaims()` | Part D claims | `MedicationSummary[]` | Filters PDE claims, matches drug name patterns. Enriched with PDE data: daysSupply, refillNumber, brand/generic, estimatedRunOutDate, gapDays (positive = overdue) |
| `extractScreeningsFromClaims()` | Carrier/Outpatient claims | `ScreeningHistory[]` | Matches `procedureCodes[]` against `SCREENING_CPT_MAP` (18 CPT codes → 8 screening types: A1C, eye-exam, kidney, ECG, office-visit, nutrition, DSMT, metabolic-panel). Dedupes by type, computes monthsSinceLast + isOverdue |
| `extractProvidersFromClaims()` | All claims with careTeam | `ProviderDetail[]` | Aggregates by NPI, tracks specialty, visit count, claim types. From `careTeam[]` extracted in `transformEOB()` |
| `extractHospitalizationsFromClaims()` | Inpatient/SNF claims | `HospitalizationSummary[]` | Filters inpatient claims, computes LOS, daysSinceDischarge, needsFollowUp (< 30 days). Admission type + discharge status from `supportingInfo[]` |

**Data flow**: Blue Button FHIR → `transformEOB()` (extracts PDE/careTeam/POS/inpatient fields onto `ClaimSummary`) → `eob-clinical.ts` extractors → `sync.ts` caches 8 resource types → `useHealthData` hook → `context.ts` prompt injection + `chat/page.tsx` SessionState bridge

**`transformEOB()` enrichments** (in `transforms.ts`):
- `extractPDEInfo()`: Reads `supportingInfo[]` for dayssupply, refillnum, brandgenericindicator → `ClaimSummary.pdeInfo`
- `extractCareTeam()`: Maps `careTeam[]` to NPI + name + role + specialty → `ClaimSummary.careTeam`
- `extractPlaceOfService()`: Maps `item[].locationCodeableConcept` via `POS_CODE_MAP` → `ClaimSummary.placeOfService`
- Inpatient: `extractAdmissionType()`, `extractDRGCode()`, `extractDischargeStatus()` from `supportingInfo[]` → `ClaimSummary` fields (only populated for inpatient claim types)

### Condition Severity Classification

`DiagnosisSummaryCard.tsx` color-codes conditions in the health page. Priority chain:

1. **Structured match** — `DiagnosisSummary.category` from `eob-clinical.ts` (type1/type2 → red, pre-diabetic/obesity → amber)
2. **RED keywords** (18 terms) — neoplasm, malignant, cancer, carcinoma, lymphoma, melanoma, hemorrhage, elevated prostate, acute kidney, renal failure, pulmonary embolism, stroke, cerebrovascular, heart failure, cardiac arrest, sepsis, septicemia, tumor
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

| Viewport | Left | Center | Right |
|----------|------|--------|-------|
| **Desktop** | Logo → `/` | Nav: Health (rose), Ask Denali (blue), Blog (violet) | Sign In button (not auth) / Gear icon (auth) |
| **Mobile** | Logo → `/` | — | Sign In / Gear + Hamburger menu |

- Auth-aware via `createClient().auth.getSession()` + `onAuthStateChange`
- Nav icons have per-item Tailwind colors (e.g. `text-rose-500`); active state uses `--accent-primary`
- Sign In links to `/app/settings` (email OTP flow); Gear navigates to `/app/settings`
- Hamburger dropdown shows nav items on mobile

**App Footer** (`src/app/app/layout.tsx` inline) — desktop only, horizontal single-row:
- Left: Logo + Disclaimer + Copyright (from `BRAND` config)
- Right: FAQ · Privacy · HIPAA links

**Landing Footer** (`src/components/landing/LandingFooter.tsx`) — landing + blog pages:
- Top row: Logo + company (left), FAQ · Privacy Policy · HIPAA (right)
- Bottom row: Disclaimer (left), Copyright (right), separated by border-t

**BottomTabs** (`src/components/layout/BottomTabs.tsx`) — mobile only, `/app/*` pages:
- Tabs: Home, Health, Ask Denali, Settings (4 tabs, fixed bottom)

**Health Hub** (`src/app/app/health/page.tsx`) — 6 collapsible accordion cards replacing 11-section scroll:
- Each card: `HealthHubCard` — status dot (red/amber/green) + title + one-line summary + chevron toggle
- Cards: Needs Attention (auto-expanded, conditional), Coverage Status, Diabetes Care (conditional), Health Conditions (conditional), Claims & Providers, Medicare Account
- Status dots computed via `computeCardStatuses()` (useMemo) — checks denied claims, overdue screenings, med refill gaps, severity classification, sync age
- Multiple cards can be open simultaneously. `expandedCards` as `Set<string>` state
- Existing child components (`CoverageCards`, `ClaimsTimeline`, `DiagnosisSummaryCard`, etc.) reused as-is inside card bodies

**Icons** (`src/components/icons/index.tsx`):
- `DiabetesIcon`: chart/monitoring icon (trend line + dot) — NOT blood drop
- `HeartPulseIcon`, `ChatBubbleIcon`, `DocumentTextIcon`, `GearIcon`, `HomeIcon`, `MountainIcon`

### Typography

- Greeting: 28px Bold
- Body: 16px min Regular
- Labels: 11-12px Semibold
- Font: SF Pro Display, -apple-system, sans-serif

### Theme

- Default: Follow system preference
- Dark: Slate 900->800 gradient, Blue->Violet accents
- Light: Slate 50->White gradient, Blue->Violet accents

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

| URL Pattern | Strategy | Cache Name |
|-------------|----------|------------|
| `/_next/static/`, `/icon-*`, `/favicon*`, `/logo*` | Cache-first | `denali-static-v2` |
| `/api/chat` | Network-only | — |
| `/api/fhir/authorize`, `/api/fhir/callback`, `/api/checkout`, `/api/webhooks/*` | Network-only | — |
| `/api/conversations`, `/api/fhir/data`, `/api/profile`, `/api/diabetes/log` (GET), `/api/diabetes/insights` (GET) | Network-first, cache fallback | `denali-api-v2` |
| Navigation (`mode=navigate`) | Network-first → cached page → `/offline` | `denali-static-v2` |
| Everything else | Stale-while-revalidate | `denali-static-v2` |

**Precached**: `/offline`, `/manifest.json`, `/icon-192.png`, `/icon-512.png`. **Cache versioning**: `CACHE_VERSION = "v3"` — bump on deploy. Old caches deleted on activate. **Update detection**: SW registration checks for updates every 60 min; auto-activates waiting worker.

**CRITICAL: Clone responses synchronously in SW caching strategies.** In `staleWhileRevalidate`, `response.clone()` must happen BEFORE any async `caches.open().then()` — the original response may be consumed by the client before the nested `.then()` runs, causing "Response body is already used" TypeError. Pattern: `const cloned = response.clone(); caches.open(name).then(c => c.put(req, cloned));`

**Middleware**: `sw.js` excluded from Supabase SSR middleware matcher (`sw\\.js` in regex).

### IndexedDB Cache

`src/lib/offline-cache.ts` — database `denali-offline-cache` v1 with 6 object stores:

| Store | Key | TTL | What's Cached |
|-------|-----|-----|---------------|
| `conversations` | `"list"` | 24h | `ConversationHistoryItem[]` |
| `health-data` | `"snapshot"` | 24h | Full health snapshot (patient, coverage, claims, labs, conditions, medications, screenings, providers, hospitalizations) |
| `diabetes-log` | `"entries"` | 24h | `LogEntry[]` |
| `diabetes-insights` | `"current"` | 24h | `StoredInsight` |
| `profile` | `"profile"` | 4h | Non-sensitive profile data (plan, role, appealCount, appealCredits, isAdmin, trialStatus) |
| `offline-queue` | Auto-generated ID | — | Failed POST requests awaiting replay |

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

**CRITICAL: Never `await` IndexedDB writes before `setState()`.** Same rule as Supabase fire-and-forget — blocking on cache writes causes UI hangs.

| Hook | Store | TTL | Offline Behavior |
|------|-------|-----|------------------|
| `useConversationHistory` | `conversations` | 24h | Shows cached conversation list |
| `useHealthData` | `health-data` | 24h | Shows cached health snapshot |
| `useDiabetesLog` | `diabetes-log` | 24h | Shows cached entries + optimistic adds queued |
| `useDiabetesInsights` | `diabetes-insights` | 24h | Shows cached insight |
| `useAuth` (`loadProfileData`) | `profile` | 4h | Restores plan/role/admin from cache |

### Network-Aware UI

- **`OfflineBanner`** — fixed below AppHeader (`top-14 sm:top-16 z-30`), amber-left-border accent, auto-dismisses on reconnect. Rendered in root `layout.tsx`.
- **`InactivityWarning`** — fixed below AppHeader (same position as OfflineBanner), amber-left-border accent, shows countdown timer + "Stay signed in" button. Auth-gated: renders nothing for anonymous users. Rendered in root `layout.tsx` below OfflineBanner.
- **Chat page** — `ChatInput` disabled when offline with placeholder "Chat requires an internet connection". Uses `useOnlineStatus()` hook.
- **Offline page** (`/offline`) — shown when navigation fails. Links to cached health records and past conversations.

### Session Inactivity Timeout (HIPAA)

`SESSION_TIMEOUT` constants in `config/ui.ts`. `useIdleTimeout` hook in `hooks/useIdleTimeout.ts`. `InactivityWarning` component in `components/ui/InactivityWarning.tsx`.

- **Warning at 13 min**, **sign out at 15 min** of inactivity (mouse/key/touch/scroll)
- Activity tracking throttled to 1s updates to avoid thrashing
- Check interval: 30s normally, 1s during warning countdown
- Auth-gated via `onAuthStateChange` — no timers for anonymous users
- Sign out calls `getClient().auth.signOut()` — redirect handled by auth state listeners
- "Stay signed in" resets `lastActivity` timestamp and clears warning

### What's NOT Offline

- **Chat**: Requires Claude API + MCP tools — fundamentally online-only
- **Individual conversation messages**: Loaded via Supabase, not cached (v2 candidate)
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
    auth/           # Auth components (EmailOTPModal, TOTPEnrollModal, TOTPChallengeModal). Passkey modals exist but non-functional (Supabase has no WebAuthn)
    layout/         # Layout (AppHeader, BottomTabs, Container)
    health/         # Health page (ConnectMedicare, CoverageCards, DiagnosisSummaryCard, ClaimsTimeline, ProviderSummary, AlertsSection, HealthAlertsBanner, AccountSection, FinancialSummary, AIDisclaimer, StatusBanner, ConditionsAlertBanner, PreDiabetesRiskCard)
    diabetes/       # Diabetes dashboard (A1CTrendChart, ScreeningReminders, RiskAlerts, QuickLog, InsightsCard)
  hooks/            # Custom hooks (useAuth, useChat, useConsent, useHealthData, useDiabetesSnapshots, useDiabetesLog, useDiabetesInsights, useOnlineStatus, useSettings, etc.)
  lib/              # Core libraries (claude.ts, supabase.ts, audit.ts, tools/, skills-loader.ts, denial-patterns.ts, diabetes-insights.ts, offline-cache.ts, offline-sync.ts)
  lib/fhir/         # Blue Button 2.0 (crypto, tokens, client, transforms, context, sync, snapshots)
  lib/skills/       # AI skills injected via skills-loader (health-records, medicare-notifications, diabetes-prevention)
  config/           # Config (api.ts, brand.ts, pricing.ts, ui.ts)
  types/            # TypeScript types (database.ts from Supabase gen)
  styles/           # Global styles + theme
```

### Edge Functions

Domain skills are implemented via Claude tool calling in `/api/chat`, NOT separate edge functions. Edge functions are only for background/async tasks:

```
supabase/functions/
  send-checklist-email/     # Email checklists via Resend
  process-learning-queue/   # Background learning job processor
  _shared/                  # Shared utilities (cors.ts, auth.ts)
```

---

## Testing

### Commands

```bash
cd app
npx vitest run          # 56 unit tests
npx playwright test     # 31 E2E tests (requires dev server or auto-starts)
npx tsc --noEmit        # Type check
```

### Unit Tests (Vitest)

**Config**: `app/vitest.config.ts` — `@/` alias, includes `src/**/*.test.ts`, excludes `e2e/**`.

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `src/lib/fhir/__tests__/eob-clinical.test.ts` | 35 | All 5 EOB extraction functions: conditions, medications (PDE enrichment), screenings (CPT mapping), providers (careTeam aggregation), hospitalizations (LOS, follow-up) |
| `src/config/__tests__/pricing.test.ts` | 12 | `getUploadLimitForPlan` (6 plan types), `formatPrice` (2), `formatFileSize` (4) |
| `src/app/api/consent/__tests__/route.test.ts` | 9 | Consent route handler: auth checks (GET/PUT 401), type validation (400), boolean validation (400), upsert with correct `granted_at`/`revoked_at` timestamps, 500 on DB error |

**Fixtures**: `src/lib/fhir/__tests__/fixtures/synthetic-claims.ts` — 7 synthetic `ClaimSummary` objects exercising all extractors (carrier, outpatient, Part D with PDE, inpatient).

**Route Handler Testing Pattern**: `consent/__tests__/route.test.ts` demonstrates how to unit-test Next.js App Router handlers with Vitest by mocking `createServerSupabaseClient` via `vi.mock()`. The mock returns a fake Supabase client with controllable `getUser()`, `from().select().eq()`, and `from().upsert()` methods. Route functions are imported and called directly with `new Request()` objects.

### E2E Tests (Playwright)

**Config**: `app/playwright.config.ts` — Chromium only, `baseURL: localhost:3000`, auto-starts dev server.

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `e2e/coverage-check.spec.ts` | 1 | Full chat flow: send message → SSE response renders → suggestions appear |
| `e2e/xss-security.spec.ts` | 7 | XSS prevention in paragraphs (4), tables (2), URL params (1) |
| `e2e/spoofing-security.spec.ts` | 4 | API access control: unauthenticated requests return empty/401 |
| `e2e/payment-trial.spec.ts` | 6 | Trial GET/POST 401, checkout auth/validation, webhook secret/signature checks |
| `e2e/rate-limiting.spec.ts` | 5 | Chat 429 rate limit (auth + anon), 403 trial expired, 503 checkout error, suggestion buttons |
| `e2e/consent-toggles.spec.ts` | 8 | Consent API access control (2) + UI toggle behavior: rendering, initial state, PUT payloads, optimistic revert on failure, toggle OFF sends `granted: false` (6) |

**SSE Mock Pattern**: All chat E2E tests mock `/api/chat` with `page.route()`, returning `text/event-stream` with `buildSSEResponse()` helper. Also mock `/api/profile` and `/api/conversations`. Trailing `\n\n` required to flush last SSE event from browser parser.

### Security Tests

**XSS Prevention** (`xss-security.spec.ts`):
- Detection: Sets `window.xssTriggered = false` before test, asserts still `false` after render
- Paragraph tests: `<script>`, `<img onerror>`, `<div onmouseover>`, `javascript:` URI — all escaped by `parseMarkdown()` (lines 51-54)
- Table tests: `<script>` in cell, `<img onerror>` in header — escaped by `parseTable()` HTML entity escaping
- URL param: `?message=<script>...` rendered as plain text in user bubble (React text nodes)

**Spoofing Prevention** (`spoofing-security.spec.ts`):
- `/api/conversations` without auth → `{ authenticated: false, conversations: [] }`
- `/api/profile` without auth → `{ authenticated: false }`, no plan/role/admin/credits leaked
- `/api/consent` without auth → 401
- `/api/diabetes/log` without auth → 401

**Payment & Trial Access Control** (`payment-trial.spec.ts`):
- `/api/trial` GET/POST without auth → 401
- `/api/checkout` POST without auth or Stripe key → 400/401/503
- `/api/checkout` POST with invalid plan → 400 `"Invalid plan type"`
- `/api/webhooks/stripe` POST without secret → 500; without signature → 400

**Consent Toggle Behavior** (`consent-toggles.spec.ts`):
- PUT `/api/consent` without auth → 401
- All 3 toggles render as `role="switch"` with correct `aria-checked` from GET response
- Clicking toggle sends PUT with correct `{ consentType, granted }` payload
- Toggle reverts to previous state when API returns 500 (optimistic revert)
- Toggling OFF sends `granted: false`

**XSS Fix Applied**: `MarkdownContent.tsx` `parseTable()` now escapes `&`, `<`, `>` in both header and body cells before bold processing — same defense as paragraph path. Without this fix, table cells were a live XSS vector via `dangerouslySetInnerHTML`.

---

## MCP Integration

Claude accesses real CMS coverage data through Model Context Protocol (MCP) servers. This is the **primary method** for healthcare data retrieval.

### Beta API Usage

MCP requires the beta API:

```typescript
// src/lib/claude.ts
const response = await claude.beta.messages.create({
  model: API_CONFIG.claude.model,
  max_tokens: API_CONFIG.claude.maxTokens,
  system: request.systemPrompt,
  messages,
  tools: localToolDefinitions,
  mcp_servers: MCP_SERVERS,
  betas: ["mcp-client-2025-04-04"],
});
```

- Use `claude.beta.messages.create()` NOT `claude.messages.create()`
- Import types from `@anthropic-ai/sdk/resources/beta/messages/messages`
- MCP tools: `mcp_tool_use` blocks (auto-handled by API)
- Local tools: `tool_use` blocks (executed by `processToolCalls()`)

### Debugging

Server-side logs (Vercel Functions, not browser console):

```
[CLAUDE API] Using BETA API with mcp_servers parameter
[CLAUDE API] >>> MCP TOOL CALLED: search_local_coverage
[CLAUDE API] >>> LOCAL TOOL CALLED: search_cpt
```

**Verification**:
1. Logs show `Using BETA API with mcp_servers parameter`
2. Response contains `mcp_tool_use` content blocks
3. Real policy references returned (e.g., `L34220`)
4. No `Local tools called: search_icd10` (that means MCP fallback was triggered — a bug)

---

## Learning System

### Layers

| Layer | Goal | Storage |
|-------|------|---------|
| Language | Understand user phrases | `symptom_mappings`, `procedure_mappings` |
| Clinical | Know what gets approved | `coverage_paths`, `appeal_outcomes` |
| Conversation | Optimal question flow | `conversation_patterns` |
| Policy | Track Medicare changes | `policy_cache` |
| User Behavior | Optimize UX | `user_events` |

### Triggers

| Trigger | What Happens |
|---------|--------------|
| Every message | Extract entities, queue mapping updates |
| Thumbs up | Reinforce all mappings in conversation (+0.1) |
| Thumbs down | Penalize mappings (-0.15), learn from correction |
| Appeal generated | Store coverage path as pending |
| Outcome reported | Update coverage path success/failure |
| Print/copy/download | Track user event |
| Nightly batch | Process queue, prune weak mappings, check policy updates |

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

**Identity & Security** (A1, Criteria 3/22/23/24/25): Blue Button OAuth (IAL2/AAL2 via Medicare.gov), PKCE+encrypted tokens, TOTP MFA opt-in, audit logging on all sensitive ops, consent preferences with enforcement, request purpose tagging on FHIR calls.

**Trial & Discovery** (A3/A4/A5): 14-day free trial, `/api/cms-metadata` for CMS directory, `CmsPledge` component (AI + Diabetes pledges).

**Conversational AI criteria**: Personalized AI across clinical record (coverage+denials+conditions+medications+screenings+providers+hospitalizations+classification — extracted from EOB claims via `eob-clinical.ts`). Blue Button PHR connection. AI-generated disclaimers (SparkleIcon + "Not medical advice"). "Talk to your doctor" patterns in all skills. Note: lab values (A1C etc.) not available from Blue Button — only lab procedures detected in EOB claims.

**Diabetes & Obesity criteria**: Full EOB extraction pipeline (`eob-clinical.ts`: 5 extractors — conditions, medications with PDE adherence data, screenings from CPT codes, providers with specialty, hospitalizations with follow-up flags → `classifyDiabetesStatus()`). `ScreeningReminders` driven by real CPT claim dates (8 screening types, 18 CPT codes). `RiskAlerts` expanded: high A1C, missing meds, med refill gaps, A1C trending up, no endocrinologist, post-discharge follow-up. Personalized coaching via `DIABETES_PREVENTION_SKILL`. `PreDiabetesRiskCard` (CDC risk test). Diabetes dashboard (diagnoses, medications, quick actions). `diabetes_snapshots` for longitudinal tracking. `QuickLog` for daily entries. `InsightsCard` for Claude-generated analysis.

**Medicare Notifications** (A2 partial): `MEDICARE_NOTIFICATIONS_SKILL` detects EOB/coverage changes from FHIR data.

**Chat & Appeal Infrastructure**: Rate limiting, sidebar auth+refresh, conversation persistence, requirement verification pipeline (vacuous truth fix), outcome incentive wiring, denial code extraction from user text, LCD prior auth prompt strengthening.

**Blue Button ToS v3 Compliance** (2026-02-24): Full audit completed against all ToS sections. Fixed two code gaps: (1) Blue Button attribution ("not endorsed or certified by CMS or HHS") added to connected health page (`health/page.tsx`) so it's visible whenever Medicare data is displayed — previously only on the pre-connect screen; (2) `context.ts` consent gate changed from `=== false` to `!== true` so `null`/`undefined` `consentHealthDataAi` never accidentally injects health data into Claude (null-safe allow-list pattern). All 7 Framework principles verified: Transparency ✅, Consent ✅, Use & Disclosure ✅, Individual Access ✅, Security ✅, Data Quality ✅, Accountability ✅.

**Patient-Facing Data Access History** (Criterion 4, 2026-02-24): Settings page "Activity Log" renamed to "Data Access History" with subtitle explaining it records Medicare data access events. Added "View all activity →" pagination (loads up to 50 entries). 16 action types covered with human-readable labels. IP masking implemented. Fully satisfies Criterion 4.

**Privacy Policy — CMS Blue Button Checklist** (2026-02-24): Full audit against CMS BB privacy policy checklist. All 16 checklist requirements now satisfied. Four gaps fixed: (1) Re-identification risk caveat added to §7 — anonymized data could theoretically re-identify individuals with uncommon conditions, as CMS explicitly requires disclosing; (2) Revocation data handling — dedicated clear statement added to §4 that disconnecting Medicare immediately and permanently deletes all cached health data; (3) Vendor data protection commitments — §5 now explicitly states all third-party providers are contractually required to protect data consistent with applicable law, with BAA/SOC2 Type II/PCI DSS certifications enumerated; (4) Breach notification user steps — §10 now lists specific protective actions users can take (monitor Medicare Summary Notices, call 1-800-MEDICARE, review credit report). Effective date updated to 2026-02-24.

### Remaining Gaps

| Gap | CMS Ref | Priority | Type |
|-----|---------|----------|------|
| **HIPAA compliance** | A6 | **P0** | Process — BAAs with Supabase/Vercel, compliance docs, breach notification plan |
| **HITRUST certification** | Criterion 26 | **P0** | Process — org-level security certification |
| **CMS security self-assessment** | A3 | **P0** | Docs — data source inventory + security checklist required for CMS review participation. In-app `/terms` (15 sections, fully compliant) and `/privacy` (16 sections, all CMS BB checklist requirements satisfied 2026-02-24) are complete. Remaining: submit formal security self-assessment document to CMS. |
| **Medicare.gov notification bridge** | A2 | **P1** | Code + API — direct Medicare.gov communication integration |
| **CMS credential service integration** | A1 | **P1** | Code — CLEAR (CMS-contracted for Medicare.gov, IAL2/AAL2) identity verification. Blue Button OAuth via Medicare.gov currently satisfies AAL2 as an intermediary PHR path. |
| **CMS review submission** | A3 | **P1** | Docs — submit data source inventory + security self-assessment to CMS |
| **CMS app directory submission** | A5 | **P1** | Docs — screenshots, descriptions for Medicare.gov listing |
| **AAL2 app auth** (if CMS tightens) | A1, Criteria 3, 23 | **P2** | Code — email+password + TOTP. Components ready; needs password migration |
| **FHIR USCDI v3 compliance** | Criterion 13 | **P2** | Code — verify Blue Button maps to USCDI v3 by July 2026 |

### Key Dates

| Date | Milestone |
|------|-----------|
| **Q1 2026** | CMS early adopter showcase target |
| **July 4, 2026** | FHIR API mandate (Criteria 13–16) |
