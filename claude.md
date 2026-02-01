# Denali.health

<!-- CLAUDE.md — Project instructions for Claude Code (the coding assistant).
     This file is auto-loaded into every Claude Code context window.
     Keep it accurate to the ACTUAL codebase, not aspirational.
     Last updated: 2026-02-01
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
| **First appeal** | Free (phone OTP required) |
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

---

## Key Files

Where to find specific logic in the codebase.

| File | What It Does |
|------|-------------|
| `src/app/api/chat/route.ts` | Main chat endpoint. Orchestrates: extractUserInfo → detectTriggers → buildSystemPrompt → chat loop → persistLearning |
| `src/lib/claude.ts` | Claude API client. MCP server config, Beta API call, tool-use loop, SessionState type |
| `src/lib/tools/index.ts` | All 12 local tool definitions + executors (search_cpt, lookup_denial_code, generate_appeal_letter, etc.) |
| `src/lib/skills-loader.ts` | Conditional prompt builder. Loads skill sections based on SkillTriggers (onboarding, symptom gathering, coverage, appeal, etc.) |
| `src/lib/denial-patterns.ts` | 13 denial categories with appeal strategies. `getAppealStrategyForCARC()`, `getDenialPatternsForCPT()` |
| `src/types/database.ts` | Supabase-generated TypeScript types. Regenerate with `npx supabase gen types` |
| `src/app/api/chat/route.ts` | Request flow: parse messages, restore sessionState, detect triggers, build prompt, run chat loop, persist learning |

### API Routes

```
src/app/api/
  chat/route.ts           # Main chat with Claude + tools + MCP
  appeal-outcome/route.ts # Record appeal results
  account/delete/route.ts # GDPR/CCPA account deletion
  checkout/route.ts       # Stripe payment
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
```

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
| `check_prior_auth` | Check if CPT requires prior auth | Local rules |
| `check_preventive` | Check if service is preventive (no cost-sharing) | Local rules |
| `search_pubmed` | Clinical evidence search (rate-limited) | NCBI E-utilities |
| `generate_appeal_letter` | Build Level 1 appeal with inline codes + citations | Combines multiple sources |
| `check_sad_list` | Part B (physician) vs Part D (self-administered) drug routing | CMS SAD list |
| `lookup_denial_code` | CARC/RARC code lookup + appeal strategy | Supabase `carc_codes`, `rarc_codes`, `eob_denial_mappings` |
| `get_common_denials` | Top denial reasons for a procedure + prevention tips | Supabase + `denial-patterns.ts` |

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
| `subscriptions` | Plan type, Stripe customer ID, billing status |
| `usage` | Appeal count per phone number |
| `conversations` | Chat history per user |
| `messages` | Individual messages (role: user/assistant) |
| `appeals` | Generated appeal letters with codes, policy refs, `carc_codes TEXT[]`, `rarc_codes TEXT[]` |
| `user_feedback` | Thumbs up/down + corrections |

### Denial Code Tables

| Table | Purpose | Row Count |
|-------|---------|-----------|
| `carc_codes` | Claim Adjustment Reason Codes (the "why" of a denial) | 90 |
| `rarc_codes` | Remittance Advice Remark Codes (additional detail) | 195 |
| `eob_denial_mappings` | Maps payer EOB codes to standard CARC/RARC | 1,873 |

**Versioning**: All three tables use `effective_date` column. Views `carc_codes_latest`, `rarc_codes_latest`, `eob_denial_mappings_latest` always return `WHERE effective_date = MAX(effective_date)`. When CMS publishes updates, insert new rows with a newer `effective_date`; old rows stay for history.

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
| `check_appeal_access(phone)` | Returns 'free', 'paywall', or 'allowed' |
| `increment_appeal_count(phone)` | Increments usage counter |
| `process_feedback(message_id, rating, correction)` | Handle thumbs up/down, update mappings |
| `update_symptom_mapping(phrase, code, boost)` | Upsert symptom -> ICD-10 |
| `update_procedure_mapping(phrase, code, boost)` | Upsert procedure -> CPT |
| `record_appeal_outcome(appeal_id, outcome, ...)` | Store user-reported result |
| `get_learning_context(symptoms, procedures)` | Get learned data for prompts |
| `search_denial_codes(search_text)` | Full-text search across CARC/RARC/EOB tables |
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
| 3 | Has procedure but missing symptoms/duration | SYMPTOM_GATHERING | + TOOL_RESTRAINT |
| 4 | Has symptom info but no provider confirmed | PROVIDER_VERIFICATION | NPI tools only |
| 5 | Has procedure | CODE_VALIDATION | ICD-10 <-> CPT mapping |
| 6 | Has coverage but not all requirements verified | REQUIREMENT_VERIFICATION | Ask 1 requirement at a time |
| 7 | Has coverage and all requirements verified | GUIDANCE_DELIVERY | Proactive checklist |
| 8 | Appeal detected | APPEAL_SKILL | Denial code lookup + strategy |

**TOOL_RESTRAINT**: During onboarding and symptom gathering, the prompt explicitly forbids all tool calls. This prevents Claude from jumping ahead to code lookups before gathering enough context.

### Base Prompt (always loaded)

- Identity & mission (denial prevention, plain English, empathy)
- Conversation rules (one question, brief responses, explain "why")
- Error handling (graceful failures, progressive disclosure)

### Implementation

Skills are NOT separate files or edge functions. They are string constants in `skills-loader.ts` that get concatenated into the system prompt based on trigger booleans. The function `buildSystemPromptWithLearning()` in `route.ts` calls the skills loader and also injects learned context (high-confidence mappings, successful coverage paths).

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
  New user -> Signup wall -> Mobile OTP
  appeal_count=0 -> Show letter (FREE)
  appeal_count>=1 -> Check subscription -> Paywall ($10 or $25/mo)
  |
  v
[Letter revealed] Full letter with citations, Print/Copy/Download
```

---

## Orchestration Flows

How ICD-10, CMS coverage, CARC/RARC, and NPI data come together in end-to-end tool sequences. These are the canonical patterns — Claude should follow these sequences when handling each scenario.

### Flow 1: Coverage Guidance (Proactive Denial Prevention)

**Trigger**: User asks about Medicare coverage for a procedure.

**Example**: "Will Medicare cover a lumbar MRI for my back pain?"

| Step | Who | Tool / Action | Input | Output | Stored In |
|------|-----|--------------|-------|--------|-----------|
| 1 | Claude | No tools (ONBOARDING gate) | — | Ask name, ZIP | `sessionState.name`, `.zip` |
| 2 | Claude | No tools (SYMPTOM gate) | — | Ask symptoms, duration, prior treatments | `.symptoms`, `.duration`, `.priorTreatments` |
| 3 | MCP | `npi_search` (npi-registry) | Doctor name + ZIP | NPI, specialty, Medicare enrollment status | `.provider`, `.providerNPI` |
| 4 | MCP | `search_icd10` (icd10-codes) | "chronic low back pain radiating to left leg" | M54.5, M54.41 | `.diagnosisCodes` |
| 5 | Local | `search_cpt` | "lumbar MRI" | 72148, 72149 | `.procedureCodes` |
| 6 | MCP | `search_local_coverage` (cms-coverage) | CPT 72148 + ICD M54.5 + state from ZIP | LCD L35936, coverage criteria text | `.coverageCriteria`, `.policyReferences` |
| 7 | Claude | REQUIREMENT_VERIFICATION skill | LCD criteria vs. user's answers | Requirements met/not met | `.requirementAnswers` |
| 8 | Local | `get_common_denials` | CPT 72148 | Top 3 denial reasons (CO-50, CO-96, CO-167) + prevention tips | Used in guidance output |
| 9 | Claude | GUIDANCE_DELIVERY skill | All accumulated data | Plain English checklist with policy ref, requirements AS-IS, denial warnings | Final response to user |

**Data handoff chain**: Symptoms -> ICD-10 -> CPT -> LCD policy -> Requirements -> Guidance + Denial warnings

**Key rule**: Steps 1-3 are gated. No tools fire until onboarding and symptom intake are complete. Provider verification can be skipped if user says "show coverage first."

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
| 8 | — | PAYWALL GATE | `check_appeal_access(phone)` | free / paywall / allowed | Letter revealed or paywall shown |

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
              +------------+------------+
              |                         |
              v                         v
     MCP: icd10-codes           Local: search_cpt
     (symptoms -> ICD-10)       (procedure -> CPT)
              |                         |
              +------------+------------+
                           |
                           v
                  MCP: cms-coverage
                  (ICD-10 + CPT -> LCD/NCD policy)
                           |
              +------------+------------+
              |                         |
              v                         v
     Local: get_common_denials   GUIDANCE_DELIVERY
     (CPT -> CARC codes          (policy + user data
      -> prevention tips)         -> checklist)
              |                         |
              v                         v
     Supabase: carc_codes       User sees: plain English
     + denial-patterns.ts       requirements + warnings
              |
              v
     Local: generate_appeal_letter
     (all codes + policy -> formatted letter)
```

---

## Business Model & Auth

### Pricing

| Plan | Price | Limits | Auth Required |
|------|-------|--------|---------------|
| Free | $0 | 1 appeal (lifetime) | Mobile OTP |
| Pay Per Appeal | $10/appeal | Unlimited | Mobile + Email OTP |
| Unlimited | $25/month | Unlimited appeals | Mobile + Email OTP |

Coverage guidance is **always free** (unlimited, no signup). Paywall only appears for appeal letters.

### Auth Gating

| Feature | Auth Required |
|---------|---------------|
| Coverage guidance | None |
| First appeal | Mobile OTP only |
| Additional appeals | Mobile OTP + Payment |
| $25/month subscription | Mobile OTP + Email OTP |

### Gating Logic

```
1. User requests appeal letter
2. Check phone number:
   - Not found -> Signup wall (mobile OTP)
   - Found, appeal_count=0 -> Generate letter (FREE), increment count
   - Found, appeal_count>=1 -> Check subscription:
     - Active -> Allow
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
  app/api/          # API routes (chat, appeal-outcome, account, checkout)
  components/
    ui/             # Primitives (Button, Input, Card, Modal)
    chat/           # Chat-specific (Message, ChatInput, Suggestions)
    appeal/         # Appeal-specific (AppealLetter, StatusBadge)
    layout/         # Layout (Header, Container)
  features/         # Self-contained feature modules (coverage, appeal, auth)
  hooks/            # Shared custom hooks (useSupabase, useClaude)
  lib/              # Core libraries (claude.ts, supabase.ts, tools/, skills-loader.ts, denial-patterns.ts)
  types/            # TypeScript types (database.ts from Supabase gen)
  utils/            # Shared utilities (format, validate, constants)
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
ANTHROPIC_MODEL=claude-opus-4-5-20251101
```
