# Denali.health

<!-- CLAUDE.md — Project instructions for Claude Code (the coding assistant).
     This file is auto-loaded into every Claude Code context window.
     Keep it accurate to the ACTUAL codebase, not aspirational.
     Last updated: 2026-02-08
     Maintainer: @cvr
-->

<!-- IMPORTANT FOR CLAUDE CODE:
     - Read this file carefully before making changes to the codebase
     - Sections are ordered by importance: critical rules first, reference material last
     - If a section says "CRITICAL" or "MUST", treat it as a hard constraint
     - The "Key Files" section tells you where to look for specific logic
-->

> Medicare claims intelligence PWA. Claude is the brain — driving conversations, calling tools, synthesizing coverage guidance, and learning from interactions. Focus: **proactive denial prevention** through plain English.

---

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Target User** | Original Medicare patients & caregivers |
| **NOT for** | Commercial payers, Medicaid, billers, coders |
| **Tone** | Warm, simple, no jargon, empathetic, 8th grade reading level |
| **Coverage guidance** | Always free, unlimited, no signup |
| **First 3 appeals** | Free (email OTP required) |
| **More appeals** | $10 each OR $25/month unlimited |
| **Tech Stack** | Next.js PWA, Supabase (auth + DB), Claude API (agentic), Stripe |
| **AI Model** | Claude via Beta API with MCP servers |
| **Deploy** | Vercel |

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Critical Rules](#critical-rules)
3. [Key Files](#key-files)
4. [Architecture](#architecture)
5. [Tools & Data Sources](#tools--data-sources)
6. [Database Schema](#database-schema)
7. [Skills & Prompt System](#skills--prompt-system)
8. [User Flows](#user-flows)
9. [Orchestration Flows](#orchestration-flows)
10. [Business Model & Auth](#business-model--auth)
11. [UI/UX Guidelines](#uiux-guidelines)
12. [Learning System](#learning-system)
13. [Coding Standards](#coding-standards)
14. [MCP Integration](#mcp-integration)
15. [Blue Button 2.0 (Medicare FHIR API)](#blue-button-20-medicare-fhir-api)
16. [CMS Interoperability Framework](#cms-interoperability-framework)

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
- **CRITICAL: Chain message saves after claimConversation.** Server creates conversations with `user_id=NULL` (anon role). Client must call `claimConversation()` BEFORE `saveMessage()`. If `saveMessage()` races ahead while the conversation still has `user_id=NULL`, it fails RLS silently and chat history is lost. In `useChat.ts`, message saves are chained inside `.then()` of `claimConversation()` to guarantee ordering.
- **CRITICAL: Hooks that depend on auth state must subscribe to `onAuthStateChange`.** Calling `getSession()` once on mount is NOT sufficient — the session may not be hydrated yet (cookies parse asynchronously). If `getSession()` returns `null` at mount and the hook never re-checks, auth-dependent UI stays in the "not signed in" state permanently. Always add `supabase.auth.onAuthStateChange()` listener and re-fetch on `SIGNED_IN`/`SIGNED_OUT`/`TOKEN_REFRESHED` events. Use `getClient()` (singleton) instead of `createClient()` to prevent unstable references in dependency arrays.
- **Timeout guards on pre-Claude async calls**: `route.ts` uses `withFallback()` for non-critical Supabase queries before the Claude API call (e.g., `getUnreportedOutcome` at 5s, `buildSystemPromptWithLearning` at 10s). Falls back to defaults on timeout instead of blocking.
- **AbortController for Claude API**: `withTimeout()` in `claude.ts` uses `AbortController` to truly cancel hung requests (not just `Promise.race`). 60s per iteration for Sonnet, 120s for Opus.
- **Client-side timeout**: `useChat.ts` wraps `fetch()` with a 330s `AbortController` to prevent infinite hangs on the client.
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
| `src/lib/audit.ts` | Audit logging utility. `logAudit(action, options)` writes to `audit_logs` via admin client (bypasses RLS). Non-blocking fire-and-forget |
| `src/lib/fhir/` | Blue Button 2.0 FHIR library: `crypto.ts` (AES-256-GCM encryption), `tokens.ts` (refresh), `client.ts` (FHIR API), `transforms.ts` (FHIR→UI + `extractDiabetesLabs()` + `extractDiabetesConditions()` + `extractDiabetesMedications()` + `classifyDiabetesStatus()`), `context.ts` (AI prompt injection: coverage + labs + conditions + medications + classification + lab trends + denials), `sync.ts` (cache sync: Patient + Coverage + EOB + Observation + Condition + MedicationRequest + snapshot append), `snapshots.ts` (append diabetes labs to `diabetes_snapshots` for longitudinal tracking) |
| `src/lib/diabetes-insights.ts` | Claude-powered diabetes insight generation. `generateDiabetesInsight(data)` calls Sonnet for structured analysis, `computeDataHash()` for change detection to avoid redundant API calls |
| `src/components/diabetes/` | Diabetes dashboard components: `A1CTrendChart` (SVG sparkline + list toggle), `ScreeningReminders` (due date alerts from lab dates), `RiskAlerts` (proactive alerts: high A1C, missing meds, trending up), `QuickLog` (4-tab daily entry form: glucose/activity/meal/note), `InsightsCard` (Claude-generated analysis display) |
| `src/hooks/useDiabetesSnapshots.ts` | Fetches longitudinal lab data from `diabetes_snapshots`. Returns `{ snapshots, a1cHistory, isLoading }` |
| `src/hooks/useDiabetesLog.ts` | CRUD for daily log entries via `/api/diabetes/log`. Returns `{ entries, isLoading, addEntry, deleteEntry }` |
| `src/hooks/useDiabetesInsights.ts` | AI insight fetch/refresh via `/api/diabetes/insights`. Returns `{ insight, isLoading, refresh }` |
| `src/components/layout/AppHeader.tsx` | Universal header (root layout). Auth-aware Sign In / Settings gear. Desktop nav + mobile hamburger. Colored icons |
| `src/components/layout/BottomTabs.tsx` | Mobile bottom nav for `/app/*` pages: Home, Health, Ask Denali, Settings |
| `src/components/landing/LandingFooter.tsx` | Footer for landing + blog: brand left, legal links right (FAQ, Privacy, HIPAA) |
| `src/hooks/useAuth.ts` | Auth state: email OTP, TOTP MFA enroll/challenge, AAL tracking, plan/role/trial detection, appeal access gating |
| `src/hooks/useConsent.ts` | Consent preferences: fetches/updates `consent_preferences` table, gates health data injection |
| `src/hooks/useHealthData.ts` | Blue Button FHIR data: connect/disconnect/refresh, fetches from `/api/fhir/data`. Returns patient, coverage, claims, labs, conditions, medications |
| `src/config/api.ts` | API endpoints, Claude model config, Blue Button OAuth config (scopes, callback path) |
| `src/config/pricing.ts` | Pricing constants: free appeal limit, trial duration, daily chat limits, Stripe price IDs |
| `src/hooks/useConversationHistory.ts` | Chat sidebar history. Subscribes to `onAuthStateChange` for reactive auth. Uses `getClient()` singleton. Groups conversations by date |
| `src/components/layout/Sidebar.tsx` | Chat sidebar: new chat button, conversation history grouped by date, sign-in prompt for unauthenticated users |
| `src/types/database.ts` | Supabase-generated TypeScript types. Regenerate with `npx supabase gen types` |

### API Routes

```
src/app/api/
  chat/route.ts               # Main chat with Claude + tools + MCP
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
                                       denialDate, priorAuthRequired
```

**Population sources** — how fields get populated during the chat loop:

| Field | Populated By | Mechanism |
|-------|-------------|-----------|
| `diagnosisCodes` | MCP `search_icd10` / Local `generate_appeal_letter` | Regex from Claude text / `updateSessionFromToolResults()` |
| `procedureCodes` | Local `search_cpt` / `generate_appeal_letter` | `updateSessionFromToolResults()` |
| `denialCodes` | Local `lookup_denial_code` | `updateSessionFromToolResults()` |
| `policyReferences` | MCP `search_local_coverage` / `search_national_coverage` | Regex from Claude text (LCD L\d{5}, NCD patterns) |
| `priorAuthRequired` | Local `check_prior_auth` | `updateSessionFromToolResults()` |
| `denialDate` | User message | `extractUserInfo()` regex |
| `isAppeal` | User message | `extractUserInfo()` keyword detection |

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
| `generate_appeal_letter` | Build Level 1 appeal with inline codes + policy refs + PubMed citations | Combines multiple sources + policy_references + pubmed_citations inputs |
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
| `users` | Auth, phone (primary), email, plan, theme, accessibility settings |
| `user_verification` | Email + mobile OTP status |
| `subscriptions` | Plan type, Stripe customer ID, billing status, `trial_start`/`trial_end`/`trial_converted` |
| `usage` | Appeal count per phone number |
| `conversations` | Chat history per user |
| `messages` | Individual messages (role: user/assistant) |
| `appeals` | Generated appeal letters with codes, policy refs, `carc_codes TEXT[]`, `rarc_codes TEXT[]` |
| `user_feedback` | Thumbs up/down + corrections |
| `audit_logs` | CMS compliance audit trail — who, what, when, why (IP, user agent). RLS: users read own logs, service role writes |
| `consent_preferences` | Per-user consent toggles: `health_data_ai`, `health_data_storage`, `analytics`. Versioned, audit-logged on change |
| `ehr_connections` | Blue Button OAuth tokens (AES-256-GCM encrypted), FHIR patient ID, connection status |
| `fhir_cache` | Transformed FHIR data (patient, coverage, claims, labs, conditions, medications), 24h TTL. RLS-protected reads |
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
| `check_appeal_access(email)` | Returns 'free', 'paywall', or 'allowed' |
| `increment_appeal_count(email)` | Increments usage counter |
| `process_feedback(message_id, rating, correction)` | Handle thumbs up/down, update mappings |
| `update_symptom_mapping(phrase, code, boost)` | Upsert symptom -> ICD-10 |
| `update_procedure_mapping(phrase, code, boost)` | Upsert procedure -> CPT |
| `record_appeal_outcome(appeal_id, outcome, ...)` | Store user-reported result |
| `get_learning_context(symptoms, procedures)` | Get learned data for prompts |
| `search_denial_codes(search_text)` | Full-text search across CARC/RARC/EOB tables |
| `get_denial_pattern_for_carc(carc_code)` | Match CARC code to denial pattern with appeal strategy |
| `get_denial_patterns_for_cpt(cpt_code)` | Get denial patterns commonly associated with a CPT code |
| `check_and_increment_chat(p_identifier, p_daily_limit)` | Atomic rate limit check: returns `{allowed, count}`. SECURITY DEFINER — upserts `chat_daily_usage` and increments count if under limit |
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
| 9 | Has coverage and all requirements verified | GUIDANCE_DELIVERY | Proactive checklist + denial warnings + prior auth status |
| 10 | Appeal detected | APPEAL_SKILL | Denial code lookup + strategy + PubMed evidence + letter generation |

**TOOL_RESTRAINT**: During onboarding and symptom gathering, the prompt explicitly forbids all tool calls. This prevents Claude from jumping ahead to code lookups before gathering enough context.

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
| `OUTCOME_PROMPTING_SKILL` | `src/skills/domain/outcome-prompting.ts` | Returning user with pending appeal |
| `COUNSELOR_SKILL` | `src/skills/channel/counselor.ts` | `role === "counselor"` |
| `PROVIDER_PILOT_SKILL` | `src/skills/channel/provider.ts` | `role === "provider"` |

### Implementation

Skills are string constants exported from `src/skills/` (core domain skills) and `src/lib/skills/` (data-dependent skills). They get concatenated into the system prompt by `skills-loader.ts` based on trigger booleans. The function `buildSystemPromptWithLearning()` in `route.ts` calls the skills loader and also injects learned context (high-confidence mappings, successful coverage paths).

---

## User Flows

### Coverage Guidance Flow (Free, No Auth)

```
User: "Will Medicare cover my MRI?"
  |
  v
[ONBOARDING] Name? ZIP? (TOOL_RESTRAINT active)
  |
  v
[SYMPTOM GATHERING] What symptoms? How long? Treatments tried? (TOOL_RESTRAINT active)
  |
  v
[PROVIDER VERIFICATION] Who's your doctor? (NPI tools only)
  -> MCP: npi_search by name + ZIP -> validate specialty
  |
  v
[CODE VALIDATION] All tools unlock
  -> MCP: icd10_codes -> diagnosis codes
  -> Local: search_cpt -> CPT codes
  -> MCP: cms-coverage -> LCD/NCD for CPT + diagnosis
  |
  v
[REQUIREMENT VERIFICATION] Interactive Q&A
  "Has she had symptoms for 6+ weeks?" -> check requirement
  |
  v
[GUIDANCE DELIVERY] Proactive checklist
  -> Policy reference (e.g., LCD L35936)
  -> Requirements shown AS-IS (exact medical language)
  -> User's data mapped to requirements
  -> Local: get_common_denials -> warn about likely denial reasons
```

### Appeal Flow (Requires Phone OTP)

```
User: "Medicare denied my MRI, code CO-50"
  |
  v
[APPEAL_SKILL loaded]
  -> Local: lookup_denial_code("CO-50")
     -> Supabase: carc_codes_latest + eob_denial_mappings_latest
     -> denial-patterns.ts: getAppealStrategyForCARC("50")
     -> Returns: description, plain English, appeal strategy, success rate, deadline
  |
  v
[Gather denial details] Date, procedure, doctor, patient history
  |
  v
[Generate appeal]
  -> Local: generate_appeal_letter(denial_reason, procedure, diagnosis, history, ...)
     -> Internally calls: searchICD10 + searchCPT for codes
     -> Builds letter with inline codes, coverage requirements, deadline
  |
  v
[PAYWALL GATE]
  New user -> Signup wall -> Email OTP
  appeal_count<3 -> Show letter (FREE)
  appeal_count>=3 -> Check subscription -> Paywall ($10 or $25/mo)
  |
  v
[Letter revealed] Full letter with citations, Print/Copy/Download
```

---

## Orchestration Flows

How ICD-10, CMS coverage, CARC/RARC, and NPI data come together in end-to-end tool sequences. These are the canonical patterns — Claude should follow these sequences when handling each scenario.

### Flow 1: Coverage Guidance (Proactive Denial Prevention)

**Trigger**: User asks about Medicare coverage for a procedure or treatment.

**Example**: "Will Medicare cover a lumbar MRI for my back pain?"

**Goal**: Walk the user through every check needed so that when they show up for treatment, the claim does NOT get denied. This means verifying the provider, the codes, the policy, the requirements, and warning about common denial traps — all before the service happens.

#### Phase 1: Intake (No Tools — TOOL_RESTRAINT active)

No tool calls allowed during this phase. Claude gathers context through conversation only.

| Step | Action | What Claude Asks | Why (Denial It Prevents) | Stored In |
|------|--------|-----------------|--------------------------|-----------|
| 1a | Get name | "What's your name?" | Personalization, used in checklist | `.name` |
| 1b | Get ZIP | "What ZIP code are you in?" | Determines MAC jurisdiction for regional LCD lookup | `.zip` |
| 2a | Get symptoms | "Can you tell me what's going on?" | Maps to ICD-10 diagnosis — wrong diagnosis = denial | `.symptoms` |
| 2b | Get duration | "How long has this been going on?" | Many LCDs require minimum duration (e.g., 6 weeks conservative treatment) | `.duration` |
| 2c | Get prior treatments | "What have you tried so far?" | LCDs often require failed conservative treatment before approving imaging/surgery | `.priorTreatments` |
| 2d | Get red flags | Claude listens for: bowel/bladder issues, progressive weakness, fever, trauma, weight loss | Red flags can EXPEDITE approval and bypass duration requirements | `.redFlagsPresent` |

**Gate**: All of 2a-2c must be answered before tools unlock. If user has asked about 2+ procedures before (rush mode), symptom gathering can be abbreviated.

#### Phase 2: Provider Verification (NPI Tools Only)

Only NPI registry tools allowed. No ICD-10, CPT, or coverage lookups yet.

| Step | Tool | Input | What It Checks | Why (Denial It Prevents) |
|------|------|-------|---------------|--------------------------|
| 3a | Claude (no tool) | — | "Do you have a doctor for this?" | — |
| 3b | MCP: `npi_search` | Doctor name + ZIP | NPI number, Medicare enrollment status | **Non-enrolled provider = automatic denial.** Medicare won't pay providers not enrolled in their system |
| 3c | MCP: `npi_search` result | — | Provider's specialty | **Specialty mismatch = higher denial risk.** E.g., family medicine ordering advanced imaging may trigger review |
| 3d | Local: `validateSpecialtyMatch()` (internal) | Procedure + provider specialty | Does specialty match the procedure? | If mismatch: warn user, suggest referral or strong medical necessity documentation |

**Stored**: `.provider` (name, NPI, specialty), `.providerNPI`

**Skippable**: User can say "not yet" or "show coverage first" to skip. Claude proceeds but notes the gap.

**What to tell the user**:
- If provider IS enrolled: "Dr. Chen is enrolled in Medicare — good."
- If specialty mismatch: "Dr. Chen is Family Medicine. She can order this, but a referral from a specialist (orthopedist, neurologist) strengthens the case."
- If provider NOT found: "I couldn't find that provider in Medicare's system. Double-check the name, or confirm they accept Medicare before your visit."

#### Phase 3: Code Validation (All Tools Unlock)

| Step | Tool | Input | Output | Why (Denial It Prevents) |
|------|------|-------|--------|--------------------------|
| 4 | MCP: `search_icd10` | User's symptom description | ICD-10 codes (e.g., M54.5, M54.41) | **Wrong diagnosis code = denial.** The ICD-10 must match the LCD's covered indications |
| 5 | Local: `search_cpt` | User's procedure description | CPT codes (e.g., 72148, 72149) | **Wrong procedure code = denial.** CPT must be on the LCD's covered procedure list |
| 5a | Local: `get_related_diagnoses` | CPT code | Related ICD-10 codes that support this CPT | Cross-validates: does the diagnosis actually justify the procedure? |
| 5b | Local: `check_preventive` | CPT code | Is this a preventive service? | **If preventive: no cost-sharing** (no deductible, no coinsurance). Different coverage path |
| 5c | Local: `check_prior_auth` | CPT code | Does this commonly require prior authorization? | **Missing prior auth = denial.** Provider must submit PA request BEFORE the service |
| 5d | Local: `check_sad_list` | Drug name (if applicable) | Part B vs Part D coverage | **Wrong Part = denial.** Self-administered drugs go to Part D, physician-administered to Part B |

**Stored**: `.diagnosisCodes`, `.procedureCodes`

**What to tell the user** (plain English, never codes):
- If prior auth required: "Your doctor will need to get pre-approval from Medicare before scheduling this. Ask them to submit a prior authorization."
- If preventive: "This is a preventive service — Medicare covers it with no out-of-pocket cost when done by a participating provider."
- If SAD list applies: "This medication is covered under Part B (your doctor administers it) / Part D (you pick it up at a pharmacy)."

#### Phase 4: Coverage Policy Lookup

| Step | Tool | Input | Output | Why |
|------|------|-------|--------|-----|
| 6a | MCP: `search_local_coverage` | CPT + ICD-10 + state from ZIP | LCD (e.g., L35936) with full coverage criteria text | Regional policies (LCDs) have specific requirements per MAC jurisdiction |
| 6b | MCP: `search_national_coverage` | CPT + ICD-10 | NCD (if applicable) | National policies override regional. Some procedures only have NCDs |
| 6c | MCP: `get_coverage_document` | Policy ID from 6a/6b | Full policy text with indications, limitations, documentation requirements | The actual rules that determine approval or denial |

**Stored**: `.coverageCriteria`, `.policyReferences`

**Critical rule**: LCD/NCD requirements are shown **AS-IS** to the user. Do not simplify the medical language — the doctor needs to see the exact terms Medicare uses.

#### Phase 5: Requirement Verification (Interactive Q&A)

Claude walks through each LCD requirement one at a time, checking the user's situation against the policy.

| Step | Action | Example | Why |
|------|--------|---------|-----|
| 7a | Ask about each unmet requirement | "Has she had symptoms for at least 6 weeks?" | LCD L35936 requires 6-week duration of symptoms |
| 7b | Ask about prior imaging | "Has she had an X-ray of the lower back already?" | Many LCDs require step therapy (X-ray before MRI) |
| 7c | Ask about conservative treatment | "Has she tried physical therapy or anti-inflammatory medication?" | LCDs often require 4-6 weeks of failed conservative treatment |
| 7d | Check red flags again | "Any numbness, tingling, or weakness in the legs? Bladder issues?" | Red flags bypass duration/conservative treatment requirements and expedite approval |

**Stored**: `.requirementAnswers` (map of requirement -> met/not met)

#### Phase 6: Proactive Denial Prevention + Guidance Delivery

| Step | Tool | Input | Output |
|------|------|-------|--------|
| 8 | Local: `get_common_denials` | CPT code | Top 3 CARC denial reasons + prevention tips |
| 9 | Claude: GUIDANCE_DELIVERY | All accumulated session data | Final personalized checklist |

**What the user sees** (example output):

```
Based on what you've told me, here's what Medicare needs to approve this lumbar MRI.

Policy: LCD L35936

What your doctor needs to document:
  [requirements shown AS-IS from LCD]

Your situation:
  Duration: 3 months of symptoms ✓
  Conservative treatment: Physical therapy for 6 weeks ✓
  Prior imaging: No X-ray yet ☐ — Ask your doctor about this

Heads up — common reasons this gets denied:
  1. "Not medically necessary" (CO-50) — Make sure your doctor documents
     WHY the MRI is needed and what treatments have failed
  2. "Insufficient documentation" (CO-167) — The doctor's notes must
     include symptom duration, failed treatments, and functional limitations

Provider: Dr. Chen (NPI verified, Medicare enrolled ✓)
  Note: Dr. Chen is Family Medicine. Consider asking for a referral note
  from a specialist to strengthen the claim.

Print this checklist and bring it to your appointment.
```

**Data handoff chain**: Symptoms -> ICD-10 + CPT -> Provider NPI (enrolled? specialty match?) -> Prior auth check -> Preventive check -> SAD list (if drug) -> LCD/NCD policy -> Requirements Q&A -> Common denials -> Personalized checklist

**Every check in this flow exists to prevent a specific denial reason.** If any check fails (provider not enrolled, prior auth missing, wrong diagnosis code, unmet LCD requirement), Claude warns the user and tells them how to fix it BEFORE the claim is submitted.

### Flow 2: Appeal (Reactive Denial Response)

**Trigger**: User mentions a denial, appeal, or denial code.

**Example**: "My MRI was denied. The letter says CO-50."

| Step | Who | Tool / Action | Input | Output | Stored In |
|------|-----|--------------|-------|--------|-----------|
| 1 | Local | `lookup_denial_code` | code="CO-50" | CARC description, plain English, category | `.denialCodes` |
| 1a | — | `getAppealStrategyForCARC("50")` (internal) | CARC code "50" | Appeal strategy, documentation checklist, ~40% success rate, 120-day deadline | Returned with step 1 |
| 2 | Claude | APPEAL_SKILL prompt | Denial explanation | Plain English: "Medicare said this wasn't medically necessary" + appeal strategy | Response to user |
| 3 | Claude | Gather details (no tools) | — | Ask: denial date, procedure, doctor, patient history | `sessionState` fields |
| 4 | MCP | `search_icd10` (icd10-codes) | User's diagnosis description | ICD-10 codes | `.diagnosisCodes` |
| 5 | Local | `search_cpt` | User's procedure description | CPT codes | `.procedureCodes` |
| 6 | MCP | `search_local_coverage` (cms-coverage) | CPT + ICD-10 + state | LCD/NCD policy text (for citations in letter) | `.policyReferences` |
| 7 | Local | `generate_appeal_letter` | denial_reason, procedure, diagnosis, history, provider, policy refs | Formatted Level 1 appeal with inline codes + citations + deadline | Appeal letter |
| 8 | — | PAYWALL GATE | `check_appeal_access(email)` | free / paywall / allowed | Letter revealed or paywall shown |

**Data handoff chain**: Denial code -> CARC/RARC lookup -> Appeal strategy -> User details -> ICD-10 + CPT -> LCD policy -> Appeal letter

**Key rule**: `lookup_denial_code` is the FIRST tool called. It immediately gives Claude enough context to explain the denial in plain English, before gathering additional details for the letter.

### Flow 3: Quick Denial Code Lookup

**Trigger**: User asks what a denial code means (no full appeal requested).

**Example**: "What does code 96 on my EOB mean?"

| Step | Who | Tool / Action | Input | Output |
|------|-----|--------------|-------|--------|
| 1 | Local | `lookup_denial_code` | code="96" | CARC 96: "Non-covered charge(s)" + plain English + category |
| 1a | — | Also checks `eob_denial_mappings` | eob_code="96" if no CARC match | Mapped CARC/RARC if it's a payer-specific EOB code |
| 1b | — | `getAppealStrategyForCARC("96")` | CARC code | Appeal strategy if available |
| 2 | Claude | Respond | All lookup results | Plain English explanation + "Would you like help appealing this?" |

**Single tool call, instant response.** No gates, no intake — just explain and offer next steps.

### Flow 4: Coverage-to-Appeal Bridge

**Trigger**: User goes through coverage guidance, then later returns saying it was denied.

**Example**: Session starts with coverage guidance for lumbar MRI, user returns weeks later saying "it got denied."

| Step | Who | Tool / Action | Input | Output |
|------|-----|--------------|-------|--------|
| 1 | Claude | Detect appeal intent from message | "it got denied" / "Medicare said no" | `triggers.isAppeal = true`, APPEAL_SKILL loads |
| 2 | Claude | Ask for denial code | — | "Can you find the code on your denial letter? It usually looks like CO-50 or a number." |
| 3 | Local | `lookup_denial_code` | User's code | CARC explanation + appeal strategy |
| 4 | — | Reuse session data | `sessionState` already has diagnosisCodes, procedureCodes, policyReferences from earlier coverage flow | No need to re-gather |
| 5 | Local | `generate_appeal_letter` | All session data + denial reason | Appeal letter with all codes and policy citations already populated |

**Key advantage**: If the user already went through coverage guidance in the same session, `sessionState` retains their ICD-10 codes, CPT codes, provider NPI, and policy references. The appeal letter can be generated with minimal additional questions.

### Tool Interaction Summary

How each data source connects to the others:

```
                       User's words (plain English)
                                  |
                 +----------------+----------------+
                 |                |                 |
                 v                v                 v
        MCP: icd10-codes   Local: search_cpt   MCP: npi-registry
        (symptoms->ICD-10) (procedure->CPT)    (doctor->NPI)
                 |                |                 |
                 |                +---+---+         |
                 |                    |   |         |
                 |                    v   v         v
                 |        Local: check_   Local:   Enrolled in
                 |        prior_auth    check_     Medicare?
                 |        check_prev    sad_list   Specialty
                 |        (PA needed?)  (B vs D?)  match?
                 |                    |
                 +--------+-----------+
                          |
                          v
                 MCP: cms-coverage
                 (ICD-10 + CPT + ZIP -> LCD/NCD policy)
                          |
             +------------+------------+
             |                         |
             v                         v
    Claude: Requirement       Local: get_common_denials
    Verification Q&A          (CPT -> CARC codes
    (LCD reqs vs user data)    -> prevention tips)
             |                         |
             v                         v
    GUIDANCE_DELIVERY:         Supabase: carc_codes
    Personalized checklist     + denial-patterns.ts
    with policy ref +          (appeal strategies)
    user's data mapped              |
    to requirements                 v
             |              Local: generate_appeal_letter
             v              (if denied later)
    User sees: plain English
    checklist + denial warnings
```

---

## Business Model & Auth

### Pricing

| Plan | Price | Appeals | Chat Messages/Day | Auth Required |
|------|-------|---------|-------------------|---------------|
| Anonymous | $0 | — | 3 | None |
| Free | $0 | 3 (lifetime) | 10 | Email OTP |
| Trial | $0 (14 days, CMS A4) | Unlimited | 10 | Email OTP |
| Pay Per Appeal | $10/appeal | Unlimited | Unlimited | Mobile + Email OTP |
| Unlimited | $25/month | Unlimited | Unlimited | Mobile + Email OTP |

Coverage guidance is **always free** (unlimited, no signup). Paywall only appears for appeal letters. Chat rate limiting enforced via `check_and_increment_chat` RPC (identifier = user_id for authenticated, IP for anonymous). Returns 429 when limit exceeded.

### Auth Gating

| Feature | Auth Required |
|---------|---------------|
| Coverage guidance (3 msgs/day) | None |
| Coverage guidance (10 msgs/day) | Email OTP |
| First 3 appeals | Email OTP only |
| 14-day trial | Email OTP only |
| Additional appeals | Mobile OTP + Payment |
| $25/month subscription (unlimited chat + appeals) | Mobile OTP + Email OTP |
| Medicare health data | Email OTP + Blue Button OAuth (+ TOTP challenge if user has opted in) |

### AAL2 Compliance Strategy (CMS A1 / NIST 800-63B)

**CMS A1 requirement**: "Support data exchange with patient identity verification **either** via an intermediary personal health record application **or** using a CMS-approved service for IAL2/AAL2, in order to generate digital credentials that can be used to access health records."

**Blue Button satisfies CMS A1** — no additional auth (TOTP, passkeys) is required by CMS:

| Layer | What It Protects | Method | Status |
|-------|-----------------|--------|--------|
| **FHIR connection** (CMS A1) | Identity proofing — verifies this is the right Medicare beneficiary | Blue Button OAuth via Medicare.gov (IAL2/AAL2 handled by CMS) | **DONE** |
| **TOTP MFA** (opt-in) | Extra protection for cached health data if user's email is compromised | TOTP authenticator app via Settings > Security | **Available** — opt-in, not required |

**TOTP is opt-in, not required.** CMS A1 is fully satisfied by Blue Button OAuth. TOTP is available in Settings > Security for users who want extra protection. It is never required to use any feature. Target users are rural Medicare patients (65+, limited tech experience) — mandatory TOTP would be a barrier to access.

**Supabase limitation**: WebAuthn/passkeys NOT supported on any plan. TOTP and Phone are the only MFA factor types.

**Future (P1)**: If app-level AAL2 is ever needed (e.g., CMS tightens requirements), the path is email+password (memorized secret per NIST 800-63B) + TOTP. Components are built; migration would add `signInWithPassword()` alongside email OTP.

### Gating Logic

```
1. User requests appeal letter
2. Check email:
   - Not found -> Signup wall (email OTP)
   - Found, appeal_count<3 -> Generate letter (FREE), increment count
   - Found, appeal_count>=3 -> Check subscription:
     - Active (monthly or active trial) -> Allow
     - None -> Show paywall ($10 or $25/month)
3. After payment -> Reveal letter, increment count
```

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
| **Desktop** | Logo + tagline → `/` | Nav: Health (rose), Ask Denali (blue), Blog (violet) | Sign In button (not auth) / Gear icon (auth) |
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
    ui/             # Primitives (Button, Input, Card, Modal, CmsPledge)
    chat/           # Chat-specific (Message, ChatInput, Suggestions)
    appeal/         # Appeal-specific (AppealLetter, StatusBadge)
    auth/           # Auth components (EmailOTPModal, TOTPEnrollModal, TOTPChallengeModal). Passkey modals exist but non-functional (Supabase has no WebAuthn)
    layout/         # Layout (AppHeader, BottomTabs, Container)
    health/         # Health page (ConnectMedicare, PatientCard, CoverageCards, LabResultsCard, ConditionsCard, MedicationsCard, ClaimsList, PreDiabetesRiskCard, DiabetesConsentCard)
    diabetes/       # Diabetes dashboard (A1CTrendChart, ScreeningReminders, RiskAlerts, QuickLog, InsightsCard)
  hooks/            # Custom hooks (useAuth, useChat, useConsent, useHealthData, useDiabetesSnapshots, useDiabetesLog, useDiabetesInsights, useSettings, etc.)
  lib/              # Core libraries (claude.ts, supabase.ts, audit.ts, tools/, skills-loader.ts, denial-patterns.ts, diabetes-insights.ts)
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

### Environment Variables (Vercel)

```
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_APPEAL_MODEL=claude-opus-4-6    # No date suffix — Opus for appeals
BLUEBUTTON_CLIENT_ID=...          # CMS Blue Button OAuth client ID
BLUEBUTTON_CLIENT_SECRET=...      # CMS Blue Button OAuth client secret
BLUEBUTTON_BASE_URL=https://sandbox.bluebutton.cms.gov  # or production URL
FHIR_TOKEN_ENCRYPTION_KEY=...     # 32-byte hex key for AES-256-GCM token encryption
STRIPE_SECRET_KEY=sk_...          # Stripe API key
STRIPE_WEBHOOK_SECRET=whsec_...   # Stripe webhook signing secret
```

---

## Blue Button 2.0 (Medicare FHIR API)

Blue Button connects patients to their Medicare claims data via FHIR APIs.

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

- Client-side `useHealthData()` fetches from `/api/fhir/data` → populates sessionState fields (`healthDataAvailable`, `activeCoverage`, `recentDenials`, `labs`, `conditions`, `medications`, `diabetesClassification`)
- Chat page bridges health data into `useChat` via `initialSessionState` (built with `useMemo`, synced via `useEffect` for async loading)
- Server-side `buildHealthContextForPrompt()` injects health context into Claude system prompt: active coverage, lab results (with clinical interpretations), diabetes diagnoses, active medications, diabetes classification with action directives, recent denials (gated by `health_data_ai` consent)
- `HEALTH_RECORDS_SKILL` loaded when `hasHealthData` or `hasRecentDenials` triggers fire
- `DIABETES_PREVENTION_SKILL` loaded when `hasDiabetesContext` triggers (from conditions, labs, or user keywords)

---

## CMS Interoperability Framework

**Sources**:
- Framework (26 network criteria): https://www.cms.gov/health-technology-ecosystem/interoperability-framework
- Categories (app-specific pledges): https://www.cms.gov/health-technology-ecosystem/categories
- Early adopters: https://www.cms.gov/health-tech-ecosystem/early-adopters
- Pledge form: https://surveys.cms.gov/jfe/form/SV_6SbVcS5IOqXXOnk

Denali participates as a **Patient-Facing App** under two CMS early adopter categories:
1. **Conversational AI Assistants** — Ask Denali (chat)
2. **Diabetes & Obesity Prevention** — Diabetes Care feature

**Key rule**: "You must meet the FULL list of criteria to be considered in this category." This means ALL 6 overall app criteria + ALL category-specific criteria.

### Patient-Facing App Criteria (ALL Apps — 6 Requirements)

These apply to Denali regardless of category. Source: categories page.

| # | Requirement | Denali Status |
|---|-------------|---------------|
| **A1** | **IAL2/AAL2 identity verification** — via intermediary PHR app or CMS-approved service (passkeys, mDLs) | **DONE.** Blue Button OAuth through Medicare.gov = IAL2/AAL2 via intermediary PHR path. PKCE + encrypted token storage. TOTP MFA available as opt-in extra security (Settings > Security) but not CMS-required |
| **A2** | **Medicare.gov connectivity** — notify Medicare beneficiaries of communications (notices, EOBs, fraud alerts) | **PARTIAL.** `MEDICARE_NOTIFICATIONS_SKILL` exists but `hasRecentChanges` trigger was not wired — now fixed. Skill detects EOB/coverage changes from FHIR data. Still need: direct Medicare.gov notification bridge API |
| **A3** | **CMS review participation** — disclose data sources, terms/agreements, complete basic security checklist | **PARTIAL.** `/api/cms-metadata` exposes app metadata for CMS directory. Still need: terms doc, security self-assessment |
| **A4** | **Trial access for Medicare patients** if app charges a fee | **DONE.** 14-day free trial via `/api/trial`. Trial status tracked in `subscriptions` table. Settings shows trial days remaining |
| **A5** | **CMS discovery experience** — allow app to be listed as recommended option on Medicare.gov | **PARTIAL.** `/api/cms-metadata` returns app listing metadata. Still need: CMS submission |
| **A6** | **HIPAA compliance** when provided by a covered entity or business associate | **IN PROGRESS.** Audit logging + consent management done. Need: BAA with Supabase/Vercel, HIPAA compliance documentation |

### Conversational AI — Additional Criteria

| Requirement | Denali Status |
|-------------|---------------|
| Personalized AI support across clinical record — symptom checking, care planning, coordination, chronic disease | **DONE.** Core product functionality. Coverage + denials + lab results (A1C/glucose/BMI) + diabetes diagnoses + medications + classification flow to AI context |
| Must connect to CMS Aligned Network directly OR via personal health record app | **DONE.** Blue Button 2.0 (PHR path) with PKCE OAuth, encrypted tokens, audit logging. Future: direct CMS Aligned Network |
| Responses must clearly indicate AI-generated + disclaimers when not replacing clinical judgment | **DONE.** SparkleIcon + "AI-generated · Not medical advice" on all assistant messages |
| Clearly distinguish educational content from clinical guidance; guide to health professional when needed | **DONE.** Coverage guidance framing + "talk to your doctor" patterns in skills |

### Diabetes & Obesity — Additional Criteria

| Requirement | Denali Status |
|-------------|---------------|
| Must connect to CMS Aligned Network directly or via PHR app | **DONE.** Blue Button 2.0 (PHR path). Health data flows to chat via `DIABETES_PREVENTION_SKILL` |
| Use clinical record for personalized coaching, reminders, risk alerts | **DONE.** `DIABETES_PREVENTION_SKILL` with classification-based coaching (diabetic/pre-diabetic/at-risk), lab trend awareness, screening reminders (>6mo/>12mo since last A1C), risk alerts (A1C >= 9.0, diagnosis without meds). FHIR pipeline: Observation + Condition + MedicationRequest → `classifyDiabetesStatus()` → AI context. Diabetes page: personalized status (A1C range bar, diagnoses, medications), context-aware quick actions |
| Support both prevention AND active management (meds, lab trends, nutrition/activity) | **DONE.** Prevention: MDPP eligibility guidance, CDC pre-diabetes risk test, lifestyle coaching prompts. Management: medication coaching (insulin $35/month cap, Part D coverage), lab trend tracking (A1C up/down/stable), MNT referral suggestions, DSMT coverage. Health page shows labs + conditions + medications. AI skill covers nutrition/activity coaching with actual A1C references |
| Must specifically provide resources for pre-Diabetic patients | **DONE.** `PreDiabetesRiskCard` (CDC 7-question risk test on diabetes page when not connected), MDPP section (eligibility criteria, enrollment CTA) shown for pre-diabetic/at-risk users, `DIABETES_PREVENTION_SKILL` has dedicated pre-diabetic coaching section |
| HIPAA compliance | Same as A6 above |

### Framework Section I: Patient Access & Empowerment

These are network-level criteria but affect how Denali interacts with CMS Aligned Networks.

| Criterion | Requirement | Denali Impact |
|-----------|-------------|---------------|
| **1 — Universal Data Access** | Patients access electronic medical info via apps of their choice | **DONE.** Blue Button 2.0 with PKCE OAuth. Future: CMS Aligned Network connectivity |
| **2 — Claims & Benefits** | Access claims, EOBs, prior auths, clinical data from payers | **DONE.** Health page shows patient info, coverage, claims list + detail |
| **3 — Simplified Identity** | IAL2/AAL2 credentials, no extra logins | **DONE.** Blue Button OAuth = IAL2/AAL2 via Medicare.gov (no extra login needed). TOTP MFA opt-in for extra security. See A1 |
| **4 — Audit Log Transparency** | Accounting of all data access — who, when, why | **DONE.** `audit_logs` table + `logAudit()` calls on all sensitive operations (FHIR, appeals, consent, account deletion, checkout) |
| **5 — Consent Preferences** | Patient consent preferences shared with all parties; honor restrictions | **DONE.** `consent_preferences` table + Settings UI toggles + enforcement in FHIR context pipeline |

### Framework Section V: Identity, Security & Trust

| Criterion | Requirement | Denali Impact |
|-----------|-------------|---------------|
| **22 — Request Purpose** | All queries include purpose code | **DONE.** `X-Request-Purpose` header on FHIR calls, derived from skill triggers (appeal/coverage-determination/patient-request) |
| **23 — Digital Credentials** | Accept IAL2/AAL2 via CMS-approved service | **DONE.** Blue Button OAuth provides IAL2/AAL2 via Medicare.gov. TOTP MFA opt-in for additional security. See A1 |
| **24 — Access Control** | Enforce access control + consent policy per context | **DONE.** Consent preferences gate health data injection. FHIR authorize checks TOTP enrollment and requires AAL2 challenge if enrolled |
| **25 — Audit Records** | Verifiable logs for all auth requests/responses | **DONE.** `audit_logs` table with action, resource, IP, user agent, metadata. See Criterion 4 |
| **26 — Security Validation** | HITRUST certification or CMS-approved equivalent | **REQUIRED.** Org-level process |

### Framework Sections II–IV (Reference)

| Section | Focus | Key Deadlines |
|---------|-------|--------------|
| **II — Provider Access** | Provider delegation, quality gap queries, 60-day claims encounter access | — |
| **III — Data Standards** | USCDI v3, FHIR APIs (US Core IG), LOINC/RxNorm/SNOMED, FHIR subscriptions | **July 4, 2026**: FHIR API mandate |
| **IV — Network Connectivity** | CMS National Provider Directory, inter-network queries, metrics reporting | — |

### CMS Pledges (Implemented)

Pledge text displayed via `CmsPledge` component (`src/components/ui/CmsPledge.tsx`):
- **AI Assistant pledge**: shown on Ask Denali (chat) page, above input
- **Diabetes & Obesity pledge**: shown on Diabetes Care page, below feature preview

### Compliance Status Summary

#### Completed (Code Done)

| Item | CMS Ref | What's Implemented |
|------|---------|-------------------|
| **Blue Button IAL2/AAL2** | A1 (Layer 1) | Blue Button OAuth via Medicare.gov = IAL2/AAL2 via intermediary PHR path. PKCE (S256) + encrypted token storage + audit logging |
| **Audit logging** | Criteria 4, 25 | `audit_logs` table + `logAudit()` on 7+ API routes (FHIR, appeals, consent, account, checkout, trial) |
| **Consent preferences** | Criterion 5 | `consent_preferences` table + Settings toggles + enforcement in FHIR context pipeline |
| **TOTP MFA (opt-in)** | Defense-in-depth | `TOTPEnrollModal`/`TOTPChallengeModal` in Settings > Security. Opt-in extra security — not CMS-required. FHIR authorize gates on AAL2 if enrolled |
| **14-day free trial** | A4 | `/api/trial` (start/check), `subscriptions` trial fields, paywall bypass for active trials |
| **Daily chat rate limiting** | — | `check_and_increment_chat` RPC, `chat_daily_usage` table, 429 response in `route.ts`, `useChat.ts` handles limit-reached UI |
| **Sidebar auth reactivity** | — | `useConversationHistory` subscribes to `onAuthStateChange`, uses `getClient()` singleton. Sidebar updates immediately on sign-in/sign-out |
| **Chat history RLS fix** | — | `useChat.ts` chains `saveMessage()` after `claimConversation()` to prevent RLS race condition (server creates conversations with `user_id=NULL`) |
| **CMS metadata API** | A3, A5 | `/api/cms-metadata` returns app listing data for CMS directory |
| **Request purpose tagging** | Criterion 22 | `X-Request-Purpose` header on FHIR calls (`patient-request`, `appeal`, `coverage-determination`) |
| **Consent enforcement** | Criterion 24 | Consent state gates health data injection into AI prompts |
| **AI-generated disclaimers** | Conv. AI criteria | SparkleIcon + "AI-generated . Not medical advice" on every assistant message |
| **CMS pledges** | Conv. AI + Diabetes | `CmsPledge` component with AI Assistant and Diabetes & Obesity pledge text |
| **Medicare notifications skill** | A2 (partial) | `MEDICARE_NOTIFICATIONS_SKILL` detects EOB/coverage changes from FHIR data. `hasRecentChanges` trigger wired |
| **Diabetes prevention skill** | Diabetes criteria | `DIABETES_PREVENTION_SKILL` with classification-based coaching, lab trends, screening reminders, risk alerts, medication coaching, MDPP guidance, nutrition/activity coaching |
| **Guide to health professional** | Conv. AI criteria | Skills consistently pattern: "ask your doctor to document...", "consult specialist" |
| **Diabetes page** | Diabetes criteria | Personalized dashboard: classification badge, A1C range bar, diagnoses, medications, context-aware quick actions, A1C guide (highlighted range), MDPP section, `PreDiabetesRiskCard` (CDC risk test) |
| **FHIR Observation pipeline** | Diabetes criteria | `syncHealthData()` fetches Observations (laboratory), `extractDiabetesLabs()` extracts A1C/glucose/BMI, labs cached in `fhir_cache`, AI context includes lab values with clinical interpretations |
| **FHIR Condition pipeline** | Diabetes criteria | `syncHealthData()` fetches Conditions, `extractDiabetesConditions()` extracts diabetes diagnoses (ICD-10 E10/E11/E13/R73/E66), cached as `resource_type: "conditions"` |
| **FHIR Medication pipeline** | Diabetes criteria | `syncHealthData()` fetches MedicationRequests, `extractDiabetesMedications()` extracts meds with `isDiabetesMed` flag (~30 drug classes), cached as `resource_type: "medications"` |
| **Diabetes classification** | Diabetes criteria | `classifyDiabetesStatus()` in transforms.ts: diabetic/pre-diabetic/at-risk/none from diagnoses + labs + medications with evidence tracking. Shared by chat page + diabetes page |
| **Chat ↔ Health data bridge** | Diabetes + Conv. AI | `useChat` accepts `initialSessionState`, syncs async health data via `useEffect`. Chat page builds sessionState from `useHealthData()` including conditions, medications, classification |
| **Health page labs/conditions/meds** | Diabetes criteria | `LabResultsCard` (with A1C trends), `ConditionsCard` (diabetes diagnoses), `MedicationsCard` (diabetes meds highlighted) on health page |
| **Pre-diabetes resources** | Diabetes criteria | `PreDiabetesRiskCard` (CDC 7-question risk test), MDPP eligibility section, dedicated pre-diabetic coaching in AI skill |
| **Unified navigation** | — | Diabetes integrated into Ask Denali chat; 3-item nav (Health, Ask Denali, Blog); diabetes page kept as reference |
| **Longitudinal lab storage** | Diabetes criteria | `diabetes_snapshots` table — append-only, auto-populated on FHIR sync. `useDiabetesSnapshots` hook, `A1CTrendChart` SVG sparkline + list toggle |
| **Nutrition/activity tracking** | Diabetes criteria | `diabetes_log` table + `QuickLog` component (glucose/activity/meal/note). Any signed-in user. `/api/diabetes/log` CRUD route |
| **Proactive screening reminders** | Diabetes criteria | `ScreeningReminders` component on diabetes dashboard — calculates from lab dates (>3mo diabetic, >6mo amber, >12mo red) |
| **Dashboard risk alerts** | Diabetes criteria | `RiskAlerts` component — A1C >= 9.0 (red), dx without meds (amber), A1C trending up (amber). Links to chat |
| **Diabetes consent flow** | Data privacy | `DiabetesConsentCard` on health page — gates AI analysis + storage consent. Shown when connected + diabetes data + no consent |
| **Stored AI diabetes analysis** | Diabetes criteria | `diabetes_insights` table + `diabetes-insights.ts` (Claude Sonnet, structured JSON) + `/api/diabetes/insights` API + `InsightsCard` component. Hash-based dedup, auto-triggered on FHIR sync |
| **Chat lab trend context** | Diabetes + Conv. AI | `labTrends` + `recentLogSummary` on SessionState. `buildHealthContextForPrompt()` injects A1C history with arrows (improving/rising/stable) |

#### Remaining Gaps

| Gap | CMS Ref | Priority | Type |
|-----|---------|----------|------|
| **HIPAA compliance** | A6 | **P0** | Process — BAAs with Supabase/Vercel, compliance docs, breach notification plan |
| **HITRUST certification** | Criterion 26 | **P0** | Process — org-level security certification |
| **Terms of service + security checklist** | A3 | **P0** | Docs — required for CMS review participation |
| **Medicare.gov notification bridge** | A2 | **P1** | Code + API — direct integration with Medicare.gov communication system (beyond FHIR change detection) |
| **CMS credential service integration** | A1 | **P1** | Code — connect to CMS-approved identity service when available |
| **CMS review submission** | A3 | **P1** | Docs — data source inventory, security self-assessment for CMS |
| **CMS app directory submission** | A5 | **P1** | Docs — screenshots, descriptions for Medicare.gov listing |
| **Patient-facing audit log viewer** | Criterion 4 | **P1** | Code — let users see who accessed their data (Settings Activity Log) |
| **AAL2 app auth** (if CMS tightens) | A1, Criteria 3, 23 | **P2** | Code — email+password sign-in + TOTP for full AAL2 at app level. TOTP components ready; would need password migration. Only needed if CMS requires app-level AAL2 beyond Blue Button |
| **EOB detail enrichment** | Criterion 2 | **P2** | Code — CARC/RARC extraction from FHIR EOB adjudication items |
| **FHIR USCDI v3 compliance** | Criterion 13 | **P2** | Code — verify Blue Button data maps to USCDI v3 by July 2026 |

### Key Dates

| Date | Milestone |
|------|-----------|
| **Q1 2026** | CMS early adopter showcase target |
| **July 4, 2026** | FHIR API mandate (Criteria 13–16) |
