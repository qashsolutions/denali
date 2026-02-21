# Denali Health — Complete Feature Inventory

**Date**: February 19, 2026
**Source**: Full codebase review (all `.ts`, `.tsx`, `.js`, `.json`, `.css` files)
**Excludes**: `.md` documentation files

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [AI Chat Engine](#2-ai-chat-engine)
3. [Skills System (22 AI Skills)](#3-skills-system-22-ai-skills)
4. [Tool System (10 Local + 3 MCP)](#4-tool-system-10-local--3-mcp)
5. [Medicare Coverage Guidance Flow](#5-medicare-coverage-guidance-flow)
6. [Appeal Letter Generation](#6-appeal-letter-generation)
7. [Denial Code Intelligence](#7-denial-code-intelligence)
8. [Blue Button 2.0 (Medicare FHIR)](#8-blue-button-20-medicare-fhir)
9. [EOB Clinical Extraction Pipeline](#9-eob-clinical-extraction-pipeline)
10. [Diabetes Management Suite](#10-diabetes-management-suite)
11. [Health Dashboard](#11-health-dashboard)
12. [Authentication & Identity](#12-authentication--identity)
13. [Payment & Subscription System](#13-payment--subscription-system)
14. [Rate Limiting & Access Control](#14-rate-limiting--access-control)
15. [PWA & Offline Support](#15-pwa--offline-support)
16. [Admin System](#16-admin-system)
17. [Counselor/Provider Dashboard](#17-counselorprovider-dashboard)
18. [CMS Content Management](#18-cms-content-management)
19. [Learning System](#19-learning-system)
20. [Outcome Tracking & Incentives](#20-outcome-tracking--incentives)
21. [Landing Page & Marketing](#21-landing-page--marketing)
22. [Blog System](#22-blog-system)
23. [Legal & Compliance Pages](#23-legal--compliance-pages)
24. [Settings Page](#24-settings-page)
25. [Conversation History](#25-conversation-history)
26. [Audit Logging](#26-audit-logging)
27. [Security Features](#27-security-features)
28. [Accessibility](#28-accessibility)
29. [SEO & Metadata](#29-seo--metadata)
30. [Testing Infrastructure](#30-testing-infrastructure)
31. [Infrastructure & Configuration](#31-infrastructure--configuration)
32. [Page Route Inventory](#32-page-route-inventory)
33. [API Route Inventory](#33-api-route-inventory)
34. [Database Schema](#34-database-schema)
35. [External Service Integrations](#35-external-service-integrations)

---

## 1. Platform Overview

Denali Health is a Next.js Progressive Web App that serves as a Medicare claims intelligence assistant. Claude AI drives all conversational logic, tool calling, and clinical reasoning. The platform targets Original Medicare and Medicare Advantage patients and caregivers with a focus on proactive denial prevention.

**Tech Stack**:
- **Frontend**: Next.js 15 App Router, TypeScript (strict), Tailwind CSS 4, CSS variables for theming
- **Backend**: Next.js API routes (Vercel serverless), Claude API (Beta with MCP), Supabase (PostgreSQL + auth)
- **AI**: Anthropic Claude (Sonnet 4.5 for chat, Opus 4.6 for appeals), 3 MCP servers, 10 local tools, 22 skills
- **Payments**: Stripe (checkout sessions, subscriptions, webhooks)
- **Health Data**: CMS Blue Button 2.0 FHIR API (OAuth PKCE)
- **PWA**: Custom service worker (no Workbox), IndexedDB via `idb`, offline queue

**Source Structure**: All source code under `app/src/`. Key directories: `app/api/` (19 API routes), `components/` (60+ components across 12 directories), `hooks/` (13 active hooks), `lib/` (core libraries), `skills/` (AI skill prompts), `config/` (7 config modules).

---

## 2. AI Chat Engine

**Files**: `src/app/api/chat/route.ts`, `src/lib/claude.ts`, `src/hooks/useChat.ts`

The chat engine is the core of the platform — a streaming agentic system where Claude orchestrates tool calls, applies domain skills, and maintains session state across messages.

### Server-Side (`route.ts`)
- **SSE Streaming**: Returns a `TransformStream` readable immediately. Claude's response streams via Server-Sent Events with event types: `delta` (text chunks), `tool` (tool execution progress), `done` (final response with full payload), `error`
- **5-Tier Rate Limiting**: Admin (unlimited) → Monthly (unlimited) → Per-Appeal (5/day) → Trial (3/day, with expiry check) → Anonymous (1/day). Enforced via `check_and_increment_chat` RPC (atomic upsert on `chat_daily_usage`)
- **Session State Initialization**: Extracts user info from messages (name, ZIP, symptoms, codes, dates via regex), detects triggers (onboarding, coverage, appeal, health data, diabetes), builds conditional system prompt
- **Health Data Context Injection**: When Blue Button is connected and consent granted, injects coverage, claims, labs, conditions, medications, screenings, providers, hospitalizations, diabetes classification, and denial reasons into the system prompt
- **Tool Loop**: Up to 10 iterations. Local tools executed via `processToolCalls()` (parallel `Promise.all`). MCP tools auto-handled by API. Each iteration has 60s timeout (Sonnet) or 120s (Opus)
- **File Attachment Support**: Accepts PDF, PNG, JPEG uploads. Plan-based size limits (0B anonymous, 2MB trial, 6MB per-appeal, 10MB monthly, unlimited admin). Files encoded as base64 and sent to Claude as multimodal content
- **Fire-and-Forget Persistence**: Messages, appeals, and learning jobs saved asynchronously after response — never blocking the stream
- **Error Handling**: Pre-stream errors return JSON (400/401/403/429/500). In-stream errors emit SSE error events. 403 `TRIAL_EXPIRED` for expired trial users. 429 with upsell info for rate-limited users

### Client-Side (`useChat.ts`)
- **780 lines** of state machine logic managing messages, streaming, tool calls, appeals, checklists, and actions
- **SSE Parsing**: Incremental parsing of `delta`/`tool`/`done`/`error` events. Falls back to JSON if `Content-Type` isn't `text/event-stream`
- **330s Client Timeout**: `AbortController` prevents infinite hangs
- **ChatAction Union**: `"none" | "show_print" | "prompt_email" | "email_sent" | "show_appeal" | "report_outcome"` — drives conditional rendering of modals and prompts
- **Checklist Extraction**: Regex parses Claude's response for `□` items and `?` questions to populate `checklistData`
- **Session State Sync**: Health data from `useHealthData` bridged into chat via `initialSessionState` (built with `useMemo`, synced via `useEffect`)

### Claude Client (`claude.ts`)
- **MCP Servers**: 3 registered — `cms-coverage` (LCD/NCD policies), `npi-registry` (provider lookup), `icd10-codes` (diagnosis codes). All at `mcp.deepsense.ai`
- **Beta API**: Uses `claude.beta.messages.create()` with `betas: ["mcp-client-2025-04-04"]`
- **SessionState**: 200+ fields covering onboarding, symptoms, procedures, provider, codes, coverage, appeal, requirements, denials, health data, diabetes context, MA plan info
- **Extraction Pipeline**: After each Claude response, 5 extractors run in sequence:
  1. `extractMedicareType()` — parses `[MEDICARE_TYPE]` block
  2. `extractRequirementsAndClean()` — parses `[REQUIREMENTS]` block
  3. `extractVerificationUpdates()` — parses `[VERIFIED]` blocks
  4. `extractPriorAuthFromLCD()` — parses `[PRIOR_AUTH_LCD]` block
  5. `extractSuggestionsAndClean()` — parses `[SUGGESTIONS]` block

---

## 3. Skills System (22 AI Skills)

**Files**: `src/lib/skills-loader.ts`, `src/skills/` (domain skills), `src/lib/skills/` (data-dependent skills)

Skills are conditional prompt sections loaded based on `SkillTriggers` (40+ boolean flags) detected in `route.ts`. They use a gated priority system where early gates prevent premature skill loading.

### Core Skills (Foundation)
| Skill | Purpose |
|-------|---------|
| **BASE_PROMPT** | Identity, mission, conversation rules. 8th grade reading level, warm empathetic tone. 10 mandatory rules (one question per turn, explain why, no jargon, etc.) |
| **TOOL_RESTRAINT** | Blocks ALL tool calls during onboarding and symptom gathering. Prevents Claude from jumping to code lookups before gathering context |
| **ONBOARDING_SKILL** | Two-step name + ZIP collection with "Skip this" option |
| **PROMPTING_SKILL** | Enforces `[SUGGESTIONS]` block on every response (max 2 options, <25 chars each) |
| **MEDICARE_TYPE_SKILL** | Detects Original vs Advantage vs Supplement. Emits `[MEDICARE_TYPE]` block |
| **MEDICARE_ADVANTAGE_SKILL** | MA-specific branching. Acknowledges Original ≠ MA rules, offers override |

### Domain Skills (Clinical Decision Logic)
| Skill | Purpose |
|-------|---------|
| **RED_FLAG_SKILL** | Emergency detection (911 triggers: chest pain+SOB, sudden paralysis) + expedited approval patterns (cancer, cauda equina, progressive weakness) |
| **SYMPTOM_SKILL** | Three-question intake: "What's going on?", "How long?", "Tried treatments?" |
| **PROCEDURE_SKILL** | Disambiguates vague terms ("back scan" → "MRI or CT? Neck, upper, or lower back?") |
| **PROVIDER_SKILL** | NPI lookup, Medicare acceptance verification, specialty matching. 3-attempt limit with auto-fallback to specialty search |
| **SPECIALTY_VALIDATION_SKILL** | Warns when non-specialist orders specialist procedures |
| **CODE_VALIDATION_SKILL** | ICD-10 ↔ CPT cross-validation, prior auth check, preventive service check, SAD list (Part B vs D) |
| **COVERAGE_SKILL** | LCD/NCD policy lookup. Extracts requirements into `[REQUIREMENTS]` block. Prior auth detection from LCD text |
| **PRIOR_AUTH_SKILL** | Yes/No/Maybe answer with 10-14 business day timeline. Patient coaching: "Ask your doctor: 'Has the prior auth been submitted?'" |
| **REQUIREMENT_VERIFICATION_SKILL** | Asks ONE requirement at a time with reason in italics. Emits `[VERIFIED]` blocks. Progress tracking. Skip handling ("just show me") |
| **GUIDANCE_SKILL** | Personalized checklist generation. Format: high-level answer → policy number → requirements AS-IS → user's situation (✓ confirmed items) → what to ask doctor → prior auth status → provider status → common denial warnings |
| **APPEAL_SKILL** | Denial code lookup FIRST (plain English + strategy), then detail gathering, tool searches, letter generation. 4-6 tool rounds max. Government-backed success stats (75-80% MA overturn, 64% DME overturn, ~70% ALJ) |
| **EOB_EXPLAINER_SKILL** | Bill/claim explanation using injected recent claims data. Structure: identify claim → what happened → charges → Medicare paid → patient owes → next step. Part A/B/D payment basics |
| **OUTCOME_PROMPTING_SKILL** | Gently asks returning users about pending appeal outcome. Free credit incentive |

### Data-Dependent Skills
| Skill | Trigger | Purpose |
|-------|---------|---------|
| **HEALTH_RECORDS_SKILL** | `hasHealthData` or `hasRecentDenials` | Uses Blue Button data proactively. Privacy rules (first name only). Coverage-aware responses |
| **MEDICARE_NOTIFICATIONS_SKILL** | `hasHealthData && hasRecentChanges` | Change detection: new EOBs, coverage changes, denied claims, renewals. Max 3 notifications |
| **DIABETES_PREVENTION_SKILL** | `hasDiabetesContext` | Classification-based coaching: Diabetic (DSMT, MNT, $35 insulin cap), Pre-diabetic (MDPP eligibility), At-risk (screening). A1C trend tracking |

### Channel Skills (Role-Based)
| Skill | Trigger | Purpose |
|-------|---------|---------|
| **COUNSELOR_SKILL** | `role === "counselor"` | SHIP Medicare counselors. Clinical terminology (CARC, LCD, CPT). Batch input processing. Case references. Unlimited free appeals |
| **PROVIDER_PILOT_SKILL** | `role === "provider"` | Healthcare providers. Shows codes directly. Batch denial processing. Practice analytics. Prior auth documentation requirements |

### Skill Loading Priority (Gated)
1. RED_FLAG (emergency override)
2. ONBOARDING (if missing name/ZIP) + TOOL_RESTRAINT
3. SYMPTOM_GATHERING (if procedure but no symptoms) + TOOL_RESTRAINT
4. PROVIDER_VERIFICATION (NPI tools only)
5. PROCEDURE_SKILL (disambiguation)
6. CODE_VALIDATION (mapping + checks)
7. REQUIREMENT_VERIFICATION (1 at a time)
8. SPECIALTY_VALIDATION (mismatch warning)
9. GUIDANCE_DELIVERY (only when `verificationComplete === true`)
10. APPEAL_SKILL (denial code + strategy + letter)
11. EOB_EXPLAINER (bills + health data)

---

## 4. Tool System (10 Local + 3 MCP)

**Files**: `src/lib/tools/index.ts`

### Local Tools (Executed by Server)
| Tool | Input | Output | Data Source |
|------|-------|--------|-------------|
| `search_cpt` | Procedure description | CPT codes with descriptions, categories, Medicare notes | AMA API (condition-based lookup → string search fallback) |
| `get_related_diagnoses` | CPT code | Related ICD-10 codes | Local mappings |
| `get_related_procedures` | ICD-10 code | Related CPT codes | Local mappings |
| `check_prior_auth` | CPT code | `commonly_requires_prior_auth` boolean, source (CMS PA Model / common list), recommendation, timeline | Local rules + CMS PA Model (blepharoplasty, botulinum, cervical fusion, facet joint, hip/knee replacement, spinal neuro) |
| `check_preventive` | CPT code | `is_preventive` boolean, cost-sharing status | Local rules |
| `search_pubmed` | Query, condition, intervention | Articles with PMID, title, authors, journal, year, DOI, citation | NCBI E-utilities (rate-limited: 3 req/sec, circuit breaker, exponential backoff) |
| `generate_appeal_letter` | Denial reason, procedure, diagnosis, history, treatments, names, dates, policy refs, PubMed citations, medicare_type, plan_name | Formatted letter + metadata (deadline, days remaining, codes, requirements, instructions) | Multi-source synthesis. 120-day deadline calculation. MA branching: "Organization Determination Appeal" to plan (42 CFR §422.101) vs "Level 1 Redetermination" to MAC |
| `check_sad_list` | Drug name, route | Part B vs Part D determination, HCPCS code, brand names, guidance | CMS SAD (Self-Administered Drug) exclusion list |
| `lookup_denial_code` | CARC/RARC code, description search, EOB code | Code details, plain English explanation, appeal strategy with success rate | Supabase (`carc_codes_latest`, `rarc_codes_latest`, `eob_denial_mappings_latest`) + `getAppealStrategyForCARC()` RPC |
| `get_common_denials` | Procedure description, CPT code | Denial reasons, CARC codes, prevention tips, appeal success rates | Supabase (`denial_patterns_latest` via `getDenialPatternsForCPT()` RPC) |

### MCP Tools (Auto-Handled by API)
| Server | URL | Tools |
|--------|-----|-------|
| `cms-coverage` | `mcp.deepsense.ai/cms_coverage/mcp` | `search_local_coverage`, `search_national_coverage`, `get_coverage_document` |
| `npi-registry` | `mcp.deepsense.ai/npi_registry/mcp` | `npi_lookup`, `npi_search` |
| `icd10-codes` | `mcp.deepsense.ai/icd10_codes/mcp` | `search_icd10` |

### Local Medicare Code Database

**Files**: `src/lib/medicare-codes.ts`, `src/lib/medicare-codes-extended.ts`, `src/lib/medicare-lookup.ts`, `src/lib/sad-list.ts`

The platform maintains a curated local database of ~1,350+ CPT and ICD-10 codes across 12 medical specialties, used as fallback when MCP/AMA API is unavailable and for cross-validation lookups.

**Code Files**:
| File | Contents |
|------|----------|
| `medicare-codes.ts` | ~600 codes across 4 specialties: E/M (49 codes: office/home/ED/hospital/nursing/care management/wellness), Cardiology (71 CPT + 88 ICD-10: ECG, echo, cath, stress test, Holter, pacemaker/ICD), Diabetes (31 CPT + 50 ICD-10: A1C, glucose, DSMT, eye, foot care, plus complications by organ system), Orthopedics (56 CPT + 63 ICD-10: joint replacement, injections, PT, MRI, bone density, fractures), Pulmonary (37 CPT + 43 ICD-10: spirometry, chest imaging, bronchoscopy, COPD, asthma, pneumonia). Types: `CPTCode`, `ICD10Code`, `ConditionMapping` |
| `medicare-codes-extended.ts` | ~750 codes across 8 specialties: Oncology (pathology, radiation, chemotherapy, infusions), Nephrology (CKD, dialysis, transplant), Neurology (EEG, sleep studies, nerve conduction, dementia, Parkinson, epilepsy), Ophthalmology (cataract, glaucoma, macular degeneration), Gastroenterology (colonoscopy, endoscopy, GERD), Mental Health (psychiatry, psychotherapy, depression, anxiety), Preventive (screening mammography, vaccines, counseling), DME (CPAP, wheelchairs, hospital beds, prosthetics) |
| `medicare-lookup.ts` | Search and lookup functions with O(1) access via `Map<string, Code>`. 35+ condition keyword categories with longest-match-wins search (e.g., "brain mri" matches Neurology, not generic Orthopedics). Functions: `searchCPT()`, `searchICD10()`, `getCPTsForCondition()`, `getICD10sForCondition()`, `getRelatedDiagnoses()`, `getRelatedProcedures()`, `getCPTsByCategory()`, `isPreventiveCode()` (annual wellness, cancer screening, vaccines), `commonlyRequiresPriorAuth()` (CMS PA Model codes + expanded list: spine, imaging, DME, cataract, bariatric) |
| `sad-list.ts` | 34 drug entries (12 SAD exclusion + 22 Part B covered). Each entry has: `genericName`, `route`, `partB`/`partD` booleans, `reason`, `exception`, optional `hcpcsCode`/`brandNames`. Rules: oral = Part D, self-injectable = Part D (exceptions: EPO, insulin pumps), physician-administered = Part B. Based on CMS Medicare Benefit Policy Manual Ch.15 §50 |

### Specialty Match Validation

**File**: `src/lib/specialty-match.ts`

Validates that a provider's specialty is appropriate for ordering specific procedures — helps prevent denials due to specialty mismatch (a common denial reason).

- **22 procedure-specialty mappings**: Imaging (spine, joint, brain, cardiac), Surgeries (knee/hip replacement, spine, cataract, colonoscopy), Therapies (PT, OT), DME (CPAP, wheelchair, walker)
- **`validateSpecialtyMatch(procedure, specialty)`**: Returns `SpecialtyMatchResult` with `isMatch`, `warning`, `recommendation`, `acceptableSpecialties[]`. Unknown procedures default to `isMatch: true`
- **`getRecommendedSpecialties(procedure)`**: Returns display names (e.g., "Orthopedic Surgeon", "Neurologist") for user-facing messages
- **Specialty display map**: 28 entries mapping raw taxonomy terms to friendly names

### Geographic Utilities

**File**: `src/lib/geo-utils.ts`

Maps ZIP codes to states and Medicare Administrative Contractors (MACs) for regional LCD lookups and provider searches.

- **ZIP-to-state mapping**: All 50 states + DC + territories (PR, VI, GU, AS, MP). Uses 3-digit ZIP prefix
- **State-to-MAC jurisdiction mapping**: Routes to correct Medicare Administrative Contractor for regional LCD searches
- **`getStateFromZIP(zip)`**, **`getMACForState(state)`**: Primary lookup functions

---

## 5. Medicare Coverage Guidance Flow

**End-to-end orchestration** across 6 phases, gated by skill loading order:

1. **Intake** (TOOL_RESTRAINT active): Gather name, ZIP, symptoms, duration, prior treatments, red flags. No tool calls allowed
2. **Provider Verification**: `npi_search` by name+ZIP → check Medicare enrollment + specialty match. Non-enrolled = automatic denial warning. Specialty mismatch = referral suggestion. Skippable
3. **Code Validation**: `search_icd10` → ICD-10, `search_cpt` → CPT, `get_related_diagnoses` → cross-validate, `check_preventive` → no cost-sharing?, `check_prior_auth` → PA required?, `check_sad_list` → Part B vs D
4. **Coverage Policy Lookup**: `search_local_coverage` (CPT+ICD-10+ZIP → LCD), `search_national_coverage` (CPT+ICD-10 → NCD), `get_coverage_document` (full policy text). Requirements shown AS-IS (not simplified)
5. **Requirement Verification**: Claude walks through each LCD/NCD requirement one at a time, checking user's situation. Stored in `sessionState.requirementAnswers`. Progress tracking ("3 of 5 confirmed")
6. **Guidance Delivery**: `get_common_denials` (top CARC reasons + prevention tips). Final output = personalized checklist with policy ref, requirements mapped to user data, denial warnings, provider status, prior auth status

---

## 6. Appeal Letter Generation

**Files**: `src/lib/tools/index.ts` (`generate_appeal_letter`), `src/components/appeal/`

### Generation
- **Tool chain**: `lookup_denial_code` (FIRST) → gather details → `search_icd10` + `search_cpt` → `search_local_coverage` → `search_pubmed` → `generate_appeal_letter`
- **120-day federal deadline** tracking with countdown. Deadline color coding: red (≤14 days), amber (>14 days), gray (expired)
- **MA branching**: When `medicareType === "advantage"`, letter title = "Organization Determination Appeal", addressee = plan name (from Blue Button coverage), cites 42 CFR §422.101. Original Medicare: "Level 1 Redetermination" to MAC
- **Content**: Medical necessity statement, clinical evidence, coverage criteria with LCD/NCD refs, diagnosis/procedure codes (internal), PubMed citations, requested action, post-submission checklist
- **Government success stats cited**: 75-80% MA overturn (Level 1), 64% DME overturn, ~70% ALJ hearings favor patient. "Most people who appeal, win. Most people never try."

### Presentation (`AppealLetterModal.tsx`)
- **AppealGate wrapper**: Email OTP → TOTP challenge → credit check → PaywallModal pipeline
- **Letter extraction**: `extractLetterContent()` finds formal letter between "MEDICARE APPEAL REQUEST" and "Sincerely"
- **Actions**: Copy (with "Copied!" feedback), Download PDF (`jsPDF` letter-format), Print (opens PDF in new tab — never `window.print()`)
- **Policy references footer**: LCD/NCD numbers displayed
- **"Report appeal outcome" link**: Transitions to outcome reporting

### PDF Generation (`appeal-pdf.ts`)
- Uses `jsPDF` for letter-format PDF
- Proper margins, font sizing, line wrapping
- Downloadable and printable

---

## 7. Denial Code Intelligence

**Files**: `src/lib/tools/index.ts` (`lookup_denial_code`, `get_common_denials`), `src/lib/denial-patterns.ts`

### Data
- **90 CARC codes** (Claim Adjustment Reason Codes — the "why" of a denial)
- **195 RARC codes** (Remittance Advice Remark Codes — additional detail)
- **1,873 EOB-to-CARC/RARC mappings** (maps payer EOB codes to standard codes)
- **12 denial patterns** with appeal strategies, CPT lists, checklists, success rates
- **5 appeal levels** with timeframes and success rates
- All versioned by `effective_date`. Views (`*_latest`) always return current rows. CMS data effective 2025-12-10

### Lookup Flows
1. **EOB code path**: Maps payer EOB codes → standard CARC/RARC via `eob_denial_mappings_latest`, enriches with appeal strategy
2. **Direct code path**: Normalizes "CO-50" → "50", searches CARC then RARC tables
3. **Description search**: Full-text RPC `search_denial_codes()` across all tables
4. **CPT-based denials**: `getDenialPatternsForCPT()` returns common denial reasons for a procedure with prevention tips

### User Experience
- Codes NEVER shown to user — always translated to plain English
- Appeal strategy includes: success rate, typical documentation gaps, time limit, level 1 tips
- "Would you like help appealing this?" offered after explanation

---

## 8. Blue Button 2.0 (Medicare FHIR)

**Files**: `src/lib/fhir/` (7 modules), `src/app/api/fhir/` (4 routes), `src/hooks/useHealthData.ts`

### OAuth Flow (PKCE)
1. User clicks "Connect Medicare" on `/app/health`
2. `GET /api/fhir/authorize`: Generate state (CSRF) + code_verifier (PKCE), compute code_challenge (SHA256→base64url), store in httpOnly cookies (10 min TTL), redirect to CMS authorize endpoint
3. User authorizes on Medicare.gov → redirected to `/api/fhir/callback`
4. `GET /api/fhir/callback`: Validate state cookie, exchange code+code_verifier for tokens via Basic Auth, encrypt tokens (AES-256-GCM), upsert `ehr_connections`, redirect to `/app/health?connected=true`

### Scopes
`patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read profile openid`

### Token Security
- AES-256-GCM encryption at rest (`FHIR_TOKEN_ENCRYPTION_KEY` — 32-byte hex)
- Token writes via admin client (bypass RLS); reads via server client (respects RLS)
- Auto-refresh when expiring within 5 minutes
- On refresh failure: connection marked "expired"

### Data Pipeline
```
Blue Button FHIR API
    ↓ fhirGet/fhirGetBundle (with token refresh, retry, pagination up to 5 pages)
    ↓
transformEOB() + 5 clinical extractors (eob-clinical.ts)
    ↓
fhir_cache (8 resource types, 24h TTL, upsert with conflict resolution)
    ↓
getCachedHealthData() (server-side, RLS-protected)
    ↓
buildHealthContextForPrompt() (text block injected into Claude system prompt)
```

### FHIR Client (`client.ts`)
- Purpose codes per CMS Section I.3: `treatment`, `coverage-determination`, `appeal`, `patient-request`
- Manual redirect handling (preserves Authorization header)
- Error handling: 401 token expired, 429 rate limited, 310 too many redirects
- Pagination: `_count=50`, max 5 pages (~150 EOBs)

### Data Available
Blue Button provides ONLY: Patient, Coverage, ExplanationOfBenefit. Observation, Condition, and MedicationRequest are NOT available — all clinical data is extracted from EOB claims.

### Disconnect
`POST /api/fhir/disconnect`: Parallel delete of `ehr_connections`, `fhir_cache`, `diabetes_snapshots`, `diabetes_insights`. Audit logged.

---

## 9. EOB Clinical Extraction Pipeline

**File**: `src/lib/fhir/eob-clinical.ts`

Five extraction functions mine clinical intelligence from EOB claims data:

### 1. `extractConditionsFromClaims()`
- **Input**: All claims
- **Output**: `DiagnosisSummary[]` — code, name, category, recordedDate
- **Logic**: Scans `diagnosisCodes[]` for diabetes ICD-10 prefixes: E10 (type1), E11 (type2), E13 (other-diabetes), R73.03/09 (pre-diabetic), E66 (obesity)
- **Dedup**: By code, keeps most recent date

### 2. `extractMedicationsFromClaims()`
- **Input**: Part D claims only
- **Output**: `MedicationSummary[]` with PDE enrichment
- **Logic**: Filters Part D/PDE claims, matches 30+ diabetes drug name patterns (metformin, insulin, GLP-1s, SGLT-2, DPP-4, etc.)
- **PDE Enrichment**: daysSupply, refillNumber, quantityDispensed, isBrandName from `claim.pdeInfo`
- **Computed Fields**: `estimatedRunOutDate` (fillDate + daysSupply), `gapDays` (positive = overdue for refill)
- **Sorting**: Diabetes meds first, then alphabetical

### 3. `extractScreeningsFromClaims()`
- **Input**: Carrier/Outpatient claims
- **Output**: `ScreeningHistory[]` — 8 screening types
- **Logic**: Matches `procedureCodes[]` against `SCREENING_CPT_MAP` (18 CPT codes → 8 types: A1C, eye-exam, kidney, ECG, office-visit, nutrition, DSMT, metabolic-panel)
- **Computed Fields**: `monthsSinceLast`, `isOverdue` (threshold-based: A1C/office 12mo, eye/metabolic/kidney 15mo, ECG 24mo, nutrition 18mo, DSMT 15mo)

### 4. `extractProvidersFromClaims()`
- **Input**: All claims with careTeam
- **Output**: `ProviderDetail[]` — NPI, name, role, specialty, visitCount, lastSeen, claimTypes
- **Logic**: Aggregates by NPI from `careTeam[]` (extracted in `transformEOB()`), tracks visit count and claim types
- **Sorting**: By visit count descending

### 5. `extractHospitalizationsFromClaims()`
- **Input**: Inpatient/SNF claims
- **Output**: `HospitalizationSummary[]` — admission/discharge dates, LOS, admission type, discharge status, diagnoses, provider, amounts
- **Computed Fields**: `lengthOfStay` (days), `daysSinceDischarge`, `needsFollowUp` (< 30 days)

### Transform Enrichments (`transforms.ts`)
`transformEOB()` populates additional fields on each `ClaimSummary`:
- `extractPDEInfo()`: `supportingInfo[]` → daysSupply, refillNumber, brandGenericIndicator, quantityDispensed
- `extractCareTeam()`: `careTeam[]` → NPI, name, role, specialty
- `extractPlaceOfService()`: `item[].locationCodeableConcept` via POS_CODE_MAP
- Inpatient-only: `extractAdmissionType()`, `extractDRGCode()`, `extractDischargeStatus()` from `supportingInfo[]`

### Diabetes Classification (`classifyDiabetesStatus()`)
Priority chain: diagnosis → lab A1C ≥6.5 → fasting glucose ≥126 → pre-diabetic diagnosis → A1C 5.7-6.4 → obesity → at-risk → none. Returns `{ classification, evidence[] }`.

---

## 10. Diabetes Management Suite

**Files**: `src/components/diabetes/`, `src/hooks/useDiabetes*.ts`, `src/app/api/diabetes/`, `src/lib/diabetes-insights.ts`, `src/lib/skills/diabetes-prevention.ts`

### A1C Trend Chart (`A1CTrendChart.tsx`)
- **SVG Sparkline**: Trend line with threshold reference lines (5.7% amber, 6.5% red)
- **Color-Coded Dots**: Green (<5.7), amber (5.7-6.5), red (>6.5)
- **Toggle View**: Chart ↔ list. List shows all values with delta arrows (↑/↓/→)
- **Data Source**: `diabetes_snapshots` table via `useDiabetesSnapshots` hook

### Screening Reminders (`ScreeningReminders.tsx`)
- **Severity Levels**: RED (overdue), AMBER (due soon)
- **Screening Types Checked**: A1C (>12mo=red, >6mo=amber for diabetics), eye exam, kidney function, DSMT
- **"Ask Denali" Buttons**: Route to chat with pre-filled screening question
- **Medicare Coverage Notes**: Informs user about covered services

### Risk Alerts (`RiskAlerts.tsx`)
- **A1C ≥9.0** (red): Critical diabetes control
- **No Diabetes Meds Despite Diagnosis** (amber): Potential treatment gap
- **Med Refill Overdue ≥14 Days** (amber): Adherence gap
- **A1C Trending Up ≥0.5 Points** (amber): Worsening control
- **No Endocrinologist Visits** (amber): Specialty care gap
- **Post-Discharge Follow-Up Needed <30 Days** (red): Hospital readmission risk
- Each alert includes pre-filled chat message for one-tap help

### Quick Log (`QuickLog.tsx`)
- **4-Tab Form**: Glucose (mg/dL + context), Activity (minutes + type), Meal (description), Note (free-form)
- **Context Options**: Fasting, Before Meal, After Meal, Bedtime, Other
- **Recent Entries**: Last 5 shown with emoji icons, values, timestamps, delete button
- **Offline Queue**: POSTs queued in IndexedDB when offline, replayed on reconnect
- **API**: `GET/POST/DELETE /api/diabetes/log` with validation

### Insights Card (`InsightsCard.tsx`)
- **Claude-Generated Analysis**: Summary, recommendations, risk alerts, screening reminders
- **Hash-Based Dedup**: `computeDataHash()` prevents redundant Claude calls when data unchanged
- **Consent-Gated**: Requires `health_data_ai` consent
- **Refresh Button**: POST to `/api/diabetes/insights` triggers regeneration

### Diabetes Prevention Skill
- **Diabetic**: Management optimization — DSMT, MNT, supplies, $35 insulin cap, screening schedules, foot/eye exams
- **Pre-Diabetic**: MDPP eligibility (A1C 5.7-6.4%, 22 sessions covered), lifestyle focus
- **At-Risk**: CDC risk test recommendation, A1C screening

### Pre-Diabetes Risk Card (`PreDiabetesRiskCard.tsx`)
- CDC pre-diabetes risk assessment card
- Displayed in Health Dashboard for eligible patients

---

## 11. Health Dashboard

**File**: `src/app/app/health/page.tsx`

### Layout: 6 Collapsible Accordion Cards
Each card has: status dot (red/amber/green) + title + one-line summary + chevron toggle. Multiple cards can be open simultaneously.

| Card | Status Dot Logic | Components |
|------|-----------------|------------|
| **Needs Attention** | Auto-expanded if issues, red/amber | Denied claims, overdue screenings, med gaps |
| **Coverage Status** | Green (active), red (inactive) | `CoverageCards` (horizontal scrollable) |
| **Diabetes Care** | Conditional on diabetes context | `A1CTrendChart`, `ScreeningReminders`, `RiskAlerts`, `QuickLog`, `InsightsCard` |
| **Health Conditions** | Severity-based | `DiagnosisSummaryCard` with RED/AMBER/GRAY color coding |
| **Claims & Providers** | Denied claims = red | `ClaimsTimeline` (monthly groups, expandable), `ProviderSummary` |
| **Medicare Account** | Sync age | `AccountSection`, `FinancialSummary` |

### Connect Medicare (`ConnectMedicare.tsx`)
- 3-step onboarding display (sign in → approve access → see data)
- Large "Connect Medicare" CTA
- Privacy message with lock icon
- "Powered by Medicare API" footer

### Claims Timeline (`ClaimsTimeline.tsx`)
- Monthly grouping, most recent expanded by default
- Color-coded: green (paid), amber (partial), red (denied)
- Denied claims: red highlight, "Denied" badge, denial reason, "Get Help" link (routes to chat with pre-filled message)
- Click for `ClaimDetail` modal
- Load More button (3 additional months)

### Condition Severity (`DiagnosisSummaryCard.tsx`)
- **Priority chain**: Structured category → RED keywords (18: cancer, stroke, heart failure, sepsis, etc.) → AMBER keywords (27: hypertension, diabetes, thyroid, COPD, etc.) → GRAY
- Left border color indicates severity
- Count of times seen + last date
- Name cleaning: strips U+25CC dotted circle artifacts from FHIR data

---

## 12. Authentication & Identity

**Files**: `src/hooks/useAuth.ts` (619 lines), `src/components/auth/`, `src/middleware.ts`

### Email OTP (Primary Auth)
- **`EmailOTPModal.tsx`**: Two-step flow. Step 1: email input (Enter to send). Step 2: 6-digit code input with auto-focus between fields, paste support, auto-submit on completion
- **`sendEmailOTP()`**: Via Supabase `signInWithOtp`
- **`verifyEmailOTP()`**: Verifies code → creates user record → starts 14-day trial → initializes usage with 1 appeal credit

### TOTP MFA (Opt-In)
- **`TOTPEnrollModal.tsx`**: QR code display, secret backup, verification
- **`TOTPChallengeModal.tsx`**: 6-digit code verification for returning MFA users
- **`enrollTOTP()`**: Returns QR, secret, factorId via Supabase MFA API
- **`challengeAndVerifyTOTP()`**: Handles both enrollment verification and login challenge

### AAL2 Compliance
- Blue Button satisfies CMS A1 — Medicare.gov handles IAL2/AAL2 as intermediary PHR path
- TOTP is opt-in (Settings > Security) for extra protection
- AAL level tracked and enforced for FHIR access

### Auth State Management
- **Module-level cache**: `_cachedAuthState` survives SPA navigations
- **Two-phase auth**: `setBasicAuth()` immediately (userId+email), `loadProfileData()` async from `/api/profile`
- **Profile cached in IndexedDB** (4h TTL) as offline fallback
- **`onAuthStateChange` canonical pattern**: Check `session?.user` existence, NOT event type name

### Middleware (`middleware.ts`)
- Supabase SSR middleware refreshes auth tokens on every request
- Prevents refresh token race condition between browser and server clients
- Calls `supabase.auth.getUser()` to trigger refresh, writes updated cookies to response
- Excludes: `sw.js`, static assets, API webhooks

---

## 13. Payment & Subscription System

**Files**: `src/components/payment/PaywallModal.tsx`, `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/lib/stripe-fulfillment.ts`, `src/config/pricing.ts`

### Pricing Tiers
| Plan | Price | Appeals | Chat/Day | How Obtained |
|------|-------|---------|----------|-------------|
| Anonymous | Free | None | 1 | No signup |
| Trial (14 days) | Free | 1 credit | 3 | Email OTP signup (auto) |
| Expired Trial | — | None | 0 (locked) | Trial lapses |
| Per-Appeal | $10/each | 1 credit per purchase | 5 | Stripe single payment |
| Monthly | $20/month | 3 credits/month | Unlimited | Stripe subscription |
| Admin | — | Unlimited | Unlimited | `users.is_admin = true` |

### PaywallModal
- Two plan options side-by-side: $10 single vs $20/month
- Monthly shows "Best value" badge
- Trial expired banner (amber) when applicable
- "Secured by Stripe" footer
- Loading spinner during checkout redirect

### Stripe Integration
- **Checkout**: `POST /api/checkout` creates Stripe Checkout Session. Plan must be "single" or "monthly". Maps to Stripe Price IDs. Returns checkout URL
- **Webhook**: `POST /api/webhooks/stripe` with HMAC signature verification
  - `checkout.session.completed` → `fulfillCheckoutSession()` (plan upgrade + credit add)
  - `customer.subscription.updated` → `handleSubscriptionEvent()` (status sync + credit reset on renewal)
  - `customer.subscription.deleted` → mark cancelled
  - `invoice.payment_failed` → mark past_due
- **Fulfillment**: Idempotent. Single: `add_appeal_credits(email, 1)` + plan→`per_appeal`. Monthly: `reset_monthly_appeal_credits(email, 3)` + subscription record
- **CRITICAL**: Checkout route uses `createServerSupabaseClient()` — browser client has no auth context server-side. Never returns `{ url: null }` (would grant free access — returns 503 instead)

### Credit System
- `usage.appeal_credits` column tracks available credits (separate from `appeal_count` lifetime counter)
- `saveAppeal()` calls both `increment_appeal_count` (lifetime) + `decrement_appeal_credit` (available)
- 3 RPCs: `decrement_appeal_credit`, `add_appeal_credits`, `reset_monthly_appeal_credits` — all SECURITY DEFINER

---

## 14. Rate Limiting & Access Control

### Chat Rate Limiting
- **Enforced via**: `check_and_increment_chat` RPC (atomic upsert on `chat_daily_usage`)
- **Identifiers**: user_id for authenticated, IP for anonymous
- **Limits**: ANON=1, TRIAL=3, PER_APPEAL=5, PAID=0 (unlimited), ADMIN=0 (unlimited)
- **Responses**: 429 with `{ error, code: "RATE_LIMITED", limit, count, isAuthenticated, upsell }`
- **Trial Expired**: 403 with `{ code: "TRIAL_EXPIRED" }` — separate from rate limiting

### Appeal Access Gating (`AppealGate.tsx`)
Pipeline: Email OTP → TOTP Challenge (if enrolled) → Credit Check → PaywallModal
- `checkAppealAccess()` returns: `"available"` (has credits), `"paywall"` (no credits), `"allowed"` (admin/counselor)
- Blurred preview with unlock overlay when access denied

### API Rate Limiting
- **Per-API configs** in `config/rate-limits.ts`: NPI (60/min), PubMed (3/min strict), CMS MCP (30/min), Claude (50/min)
- **Token bucket + circuit breaker** in `rate-limiter.ts`
- **Exponential backoff**: 3 retries, 1s initial, 30s max, 2x multiplier, ±20% jitter

---

## 15. PWA & Offline Support

**Files**: `public/sw.js`, `src/lib/offline-cache.ts`, `src/lib/offline-sync.ts`, `src/hooks/useOnlineStatus.ts`, `src/components/ui/OfflineBanner.tsx`

### Service Worker (`sw.js`)
Plain JS, no build step. Version `v3`. Route-based caching strategies:

| Pattern | Strategy | Cache |
|---------|----------|-------|
| `/_next/static/`, icons, favicons | Cache-first | `denali-static-v3` |
| `/api/chat` | Network-only | — |
| OAuth, checkout, webhooks | Network-only | — |
| GET `/api/conversations`, `/api/fhir/data`, `/api/profile`, `/api/diabetes/*` | Network-first, cache fallback | `denali-api-v3` |
| Navigation | Network-first → cached page → `/offline` | `denali-static-v3` |
| Everything else | Stale-while-revalidate | `denali-static-v3` |

Precached: `/offline`, `/manifest.json`, `/icon-192.png`, `/icon-512.png`. `skipWaiting()` + `clients.claim()` for faster SW activation.

### IndexedDB Cache (`offline-cache.ts`)
Database `denali-offline-cache` v1 with 6 object stores:

| Store | TTL | Content |
|-------|-----|---------|
| `conversations` | 24h | Conversation list |
| `health-data` | 24h | Full health snapshot (8 resource types) |
| `diabetes-log` | 24h | Log entries |
| `diabetes-insights` | 24h | AI insights |
| `profile` | 4h | Plan, role, credits, admin status |
| `offline-queue` | — | Failed POSTs awaiting replay |

### Offline Write Queue
- Only diabetes log POSTs queued (not deletes, not chat)
- Queue flow: `addEntry()` catch → `queueOfflineRequest()` → optimistic local update → on reconnect: `postMessage({ type: 'SYNC_QUEUE' })` to SW → SW reads queue from raw IndexedDB → replays POSTs → removes on success, drops after 3 retries

### Network-Aware UI
- **OfflineBanner**: Fixed amber banner below AppHeader (`z-30`), auto-dismisses on reconnect, `role="status"` with `aria-live="polite"`
- **Chat Input**: Disabled when offline with "Chat requires an internet connection" placeholder
- **Offline Page** (`/offline`): Mountain icon, "You're offline" message, links to cached health records and past conversations, "Try Again" button

### All Hooks Follow Same Pattern
```
fetch success → setState() → cacheSet() (fire-and-forget)
fetch failure → cacheGetIfFresh() → setState() from cache (if within TTL)
```

---

## 16. Admin System

- **`users.is_admin` boolean** — bypasses ALL rate limits and appeal paywalls
- **Chat**: `route.ts` sets `chatLimit = 0` (unlimited) for admin users
- **Appeals**: `checkAppealAccess()` returns `"allowed"` regardless of credits
- **UI**: "Admin" badge in AppHeader popover. Settings shows "Admin / Unlimited access", hides Upgrade button
- **Detection**: Via `/api/profile` server route → `isAdmin` field on `AuthState`

---

## 17. Counselor/Provider Dashboard

**Files**: `src/app/app/dashboard/page.tsx`, `src/components/dashboard/`

### Dashboard Page (`/app/dashboard`)
- **Role-Gated**: Redirects non-counselor/non-provider users to `/app`
- **Auth**: Requires session + counselor/provider role check
- **Stats**: Via `get_counselor_stats` RPC — open cases, filed this month, outcomes reported, approved/denied/partial counts, avg resolution days
- **Case List**: From `counselor_cases` table, 100 most recent
- **Outcome Reporting**: Inline update (outcome + date + status) with optimistic state update and stats refresh
- **"+ New Case" Button**: Links to `/app/claims?mode=new-case`

### Components
- **`CaseList`**: Renders case rows with outcome reporting actions
- **`OutcomeStats`**: Stats cards showing case metrics

### `/dashboard` Root Redirect
`/dashboard` redirects to `/app/dashboard`

---

## 18. CMS Content Management

**Files**: `src/app/admin/content/`, `src/lib/cms.ts`, `src/types/cms.ts`

### Admin Content Page (`/admin/content`)
- **Dynamic import with SSR disabled** (prevents Supabase client creation during build)
- **4-Tab Interface**: Settings, Sections, Pricing, Testimonials
- **CRUD Operations**: Edit site settings, landing content sections, pricing plans, testimonials
- **Data Source**: Supabase tables (`site_settings`, `landing_content`, `pricing_plans`, `testimonials`)

### CMS Library (`cms.ts`)
- **`getLandingPageData()`**: Fetches all landing page data in one call (SSR)
- **`getBlogPosts()`**: Published blog posts with category, date, slug
- **Build-time client**: Separate anon Supabase client for `generateStaticParams`

### CMS Types
- `SiteSetting`, `LandingSection`, `PricingPlan`, `Testimonial`, `LandingPageData`
- `BlogPost` with categories: "denial-codes" | "coverage" | "appeals" | "prior-auth"
- Content shapes: `HeroContent`, `FeatureItem`, `HowItWorksStep`, `CTAContent`

---

## 19. Learning System

**Files**: `src/lib/learning.ts`, `src/config/learning.ts`

### 5 Learning Layers
| Layer | Storage | Purpose |
|-------|---------|---------|
| **Language** | `symptom_mappings`, `procedure_mappings` | "dizzy spells" → R42 (confidence-scored) |
| **Clinical** | `coverage_paths`, `appeal_outcomes` | What gets approved/denied |
| **Conversation** | `conversation_patterns` | Optimal question sequences |
| **Policy** | `policy_cache` | Medicare policy change tracking |
| **User Behavior** | `user_events` | UX optimization |

### Confidence System
- Initial: 0.5, Range: 0.0-1.0
- Thumbs up: +0.1 boost, Thumbs down: -0.15 penalty
- Tool success: +0.05, Coverage success: +0.1
- Minimum for prompt injection: 0.6
- Pruning: <0.3 confidence AND (>90 days old OR <5 uses)

### Triggers
- **Every message**: Extract entities (77 regex patterns for symptoms, procedures, medications, providers, timeframes), queue mapping updates
- **Feedback**: Reinforce/penalize mappings
- **Appeal generated**: Store coverage path as pending
- **Outcome reported**: Update coverage path success/failure
- **Nightly batch**: Process queue, prune weak mappings, check policy updates

### Entity Extraction
`extractEntitiesFromMessages()` — 5 entity types, 77 regex patterns for symptoms, procedures, medications, providers, timeframes. Min phrase length 2, max 50.

---

## 20. Outcome Tracking & Incentives

**Files**: `src/app/outcome/`, `src/app/api/outcome-report/route.ts`, `src/app/api/appeal-outcome/route.ts`

### Token-Based Outcome Page (`/outcome`)
- **No login required** — token-based from email links
- **Auto-submit**: If `?outcome=approved` in URL, submits immediately
- **3-Button Form**: Approved (green), Denied (red), Still Waiting (amber)
- **Free Credit Incentive**: "As a thank you, reporting your outcome earns you a free appeal"
- **`Suspense` wrapper** for `useSearchParams()` (Next.js static prerendering requirement)

### API Flow
1. `POST /api/outcome-report` with token + outcome
2. Lookup `outcome_followups` by token
3. Update followup record with outcome + `responded_at`
4. Call `recordAppealOutcome()` → updates appeals, coverage paths, mappings
5. Call `apply_outcome_incentive()` RPC → free credit
6. Cancel remaining followups for same appeal
7. Return `{ success, earnedCredit }`

### In-Chat Outcome Reporting (`/api/appeal-outcome`)
- For authenticated users reporting via chat
- Same outcome processing + incentive application
- Audit logged

---

## 21. Landing Page & Marketing

**Files**: `src/app/page.tsx`, `src/components/landing/`

### Hero Section (`LandingHero.tsx`)
- Background image with gradient overlay (black/40-70%)
- Bottom fade-out transition to features section
- Two CTAs: "Ask About Coverage" (primary, accent) → `/app`, "Learn How It Works" (secondary) → `#how-it-works`
- Trust indicator: "Coverage guidance is always free"

### Features Section (`LandingFeatures.tsx`)
4 color-coded feature cards with staggered fade-in animation:
1. **Coverage Check** (teal): "Know Before You Go" — before treatment
2. **Medicare Dashboard** (red): "Your Claims, Your Data" — health records
3. **Diabetes Care** (violet): "Prevention That Works" — diabetes management
4. **Appeals** (coral): "When Medicare Says No" — denial response

Each card: accent-colored top bar, illustration, step number, audience tag, title, description, 3 feature tag pills. Hover: lift with shadow. Intersection observer for scroll animation.

### Custom SVG Illustrations (5)
- `CoverageCheckIllustration.tsx`
- `HealthRecordsIllustration.tsx`
- `DiabetesCareIllustration.tsx`
- `AppealIllustration.tsx`
- `PriorAuthIllustration.tsx`

### Other Landing Sections
- **How It Works** (`LandingHowItWorks.tsx`): Step-by-step process
- **Pricing** (`LandingPricing.tsx`): Plan comparison table
- **Testimonials** (`LandingTestimonials.tsx`): Patient stories

### Footer (`LandingFooter.tsx`)
- Top: Logo + company (left), FAQ · Privacy · HIPAA links (right)
- Bottom: Disclaimer (left), Copyright (right), border-t separator

---

## 22. Blog System

**Files**: `src/app/blog/`, `src/components/blog/`

### Routes
- `/blog` — Blog index with grid of post cards
- `/blog/[slug]` — Individual blog post (dynamic route)

### Components
- **`BlogCard.tsx`**: Post preview card
- **`BlogGrid.tsx`**: Grid layout for multiple cards
- **`BlogArticle.tsx`**: Full article display

### Categories
`"denial-codes" | "coverage" | "appeals" | "prior-auth"`

### Data Source
Supabase `blog_posts` table. Build-time static generation via `generateStaticParams()`.

---

## 23. Legal & Compliance Pages

| Route | Content | Key Details |
|-------|---------|-------------|
| `/privacy` | Privacy Policy | 15 sections with TOC, max-w-3xl, CSS variables |
| `/hipaa` | HIPAA Notice | HIPAA compliance disclosure |
| `/faq` | FAQ | 9 sections |
| `/terms` | Terms of Service | Terms and conditions |

All use `BRAND` config constants for company info. Linked from footer on all pages.

---

## 24. Settings Page

**File**: `src/app/app/settings/page.tsx`

### Sections (Authenticated)
| Section | Features |
|---------|----------|
| **Account** | Email display, plan badge, Sign Out button. Loading spinner while auth initializes |
| **Subscription** | Plan details, credit count. "Upgrade" opens PaywallModal inline. Monthly: "3 credits/month · Unlimited messages" |
| **Appearance** | Theme toggle: Light / Dark / Auto (3 buttons with sun/moon/auto icons). `aria-pressed` states |
| **Accessibility** | Text size slider (0.9× - 1.2×). Applied via `--text-scale` CSS variable |
| **Security** | TOTP MFA enrollment/unenrollment. Shows enrolled status |
| **Privacy & Data** | 3 consent toggles: Health Data AI, Health Data Storage, Analytics. `role="switch"` with `aria-checked`. Optimistic update with revert on failure |
| **Audit Log** | Activity history display (grouped by action+day with counts) |
| **Danger Zone** | 2-step delete: "Delete My Account" → confirmation with "Yes, Delete Everything". Cascades all data, cancels Stripe, signs out, redirects to landing |
| **Reset** | Reset to Defaults button |

### Sections (Not Authenticated)
- Email OTP sign-in flow: email input with `autoFocus`, blue focus ring, `<label htmlFor>`, 44px touch targets (py-3)
- 6-digit code input with auto-focus navigation

---

## 25. Conversation History

**Files**: `src/hooks/useConversationHistory.ts`, `src/components/layout/Sidebar.tsx`, `src/app/api/conversations/route.ts`

### Sidebar
- **Desktop**: Relative positioned, collapsible
- **Mobile**: Fixed with backdrop overlay, ESC key to close
- **Grouped by Date**: Today, Yesterday, This Week, Older
- **Conversation Items**: Truncated title (from first user message), preview (from last assistant message), appeal indicator (amber file icon), timestamp
- **Active State**: Highlighted for current conversation
- **"New Chat" Button**: Creates new conversation
- **Auto-Refresh**: On conversation ID changes

### Data Flow
`/api/conversations` (server-side, cookie-auth) → batch fetch conversations + messages → generate titles/previews → group by date. Cached in IndexedDB (24h TTL) for offline.

---

## 26. Audit Logging

**File**: `src/lib/audit.ts`, `src/app/api/audit-log/route.ts`

### Actions Logged
`FHIR_CONNECT`, `FHIR_DISCONNECT`, `FHIR_DATA_ACCESS`, `APPEAL_GENERATED`, `APPEAL_OUTCOME`, `CONSENT_UPDATED`, `ACCOUNT_DELETED`, `DIABETES_INSIGHT_GENERATED`, `DIABETES_LOG_ENTRY`, `CHECKOUT_STARTED`, `TRIAL_STARTED`

### Implementation
- **Write**: Admin client (bypasses RLS). Non-blocking fire-and-forget
- **Dedup**: FHIR_DATA_ACCESS deduped on write (2h window) — high frequency, low value
- **Fields**: user_id, action, resource_type, resource_id, metadata, ip_address (from request headers), user_agent
- **Read**: `/api/audit-log` with `get_grouped_audit_logs` RPC. Groups by action+resource_type+day with `entry_count`. IP last 2 octets masked (`.*.`)
- **Display**: Settings page shows activity history with count badges

---

## 27. Security Features

### XSS Prevention
- `MarkdownContent.tsx` `parseTable()` escapes `&`, `<`, `>` in header and body cells before bold processing
- `parseMarkdown()` escapes HTML entities in paragraph text
- URL params rendered as React text nodes (not dangerouslySetInnerHTML)
- **Tested**: 7 XSS vectors (script tags, img onerror, onmouseover, javascript: URI, table injection, URL params)

### API Access Control
- All data endpoints use `createServerSupabaseClient()` (cookie-authenticated)
- Unauthenticated requests to `/api/conversations` and `/api/profile` return `{ authenticated: false }` with no data leakage
- Unauthenticated requests to `/api/consent`, `/api/diabetes/*`, `/api/trial` return 401
- Stripe webhooks validated via HMAC signature

### FHIR Token Security
- AES-256-GCM encryption at rest
- httpOnly cookies for OAuth state (10 min TTL)
- State parameter for CSRF protection
- PKCE code challenge for OAuth

### HIPAA Inactivity Timeout
- **Warning at 13 min**, **sign out at 15 min** of inactivity
- Activity: mouse, key, click, touch, scroll (throttled 1s)
- Auth-gated: no timers for anonymous users
- "Stay signed in" button resets timer

### Exploit Scanner Block
`/api/block-scanner` returns 404 for WordPress/CMS exploit probing

### Data Deletion
GDPR/CCPA cascade: 13-step ordered deletion (FHIR → diabetes → chat → appeals → usage → Stripe → subscriptions → events → verification → user)

---

## 28. Accessibility

### Standards
- Minimum 16px font size (configurable 0.9×-1.2× via text scale)
- 44×44px minimum touch targets
- `role="switch"` with `aria-checked` on toggles
- `aria-label` on all interactive elements
- `aria-live="polite"` on status banners, `aria-live="assertive"` on warnings
- `aria-pressed` on theme toggle buttons
- `aria-current` on active navigation items
- `htmlFor` labels on form inputs
- Focus-visible rings on all interactive elements
- `prefers-reduced-motion` respected (intersection observer shows immediately)
- Keyboard navigation: Enter to submit, Escape to close, Tab navigation
- Screen reader compatible semantic HTML

### Theme Support
- Light, Dark, Auto (follows system preference)
- All colors via CSS variables (never hardcoded)
- High contrast: deprecated `data-high-contrast` attribute removed on load

---

## 29. SEO & Metadata

### Root Layout (`src/app/layout.tsx`)
- Title: "denali.health — Your Medicare Health Companion"
- Description: Medicare coverage guidance
- Open Graph + Twitter card metadata
- Viewport: `width=device-width, initial-scale=1, maximum-scale=5`
- Theme color: `#1e293b`
- PWA manifest link

### Per-Page Metadata
- Blog posts: Dynamic titles and descriptions from CMS
- Outcome page: `robots: "noindex"` (private token-based page)
- Legal pages: Descriptive titles

### PWA Manifest (`manifest.json`)
- Name: "DenaliHealth"
- Short name: "Denali"
- Start URL: `/app`
- Display: `standalone`
- Background: `#0f172a`
- Theme: `#1e293b`
- Icons: 192×192, 512×512

---

## 30. Testing Infrastructure

### Unit Tests (Vitest) — 56 Tests
**Config**: `vitest.config.ts` — Node.js environment, `@/` alias, includes `src/**/*.test.ts`

| File | Tests | Coverage |
|------|-------|----------|
| `fhir/__tests__/eob-clinical.test.ts` | 35 | All 5 EOB extraction functions with 7 synthetic claim fixtures |
| `config/__tests__/pricing.test.ts` | 12 | Upload limits (6 plan types), price formatting (2), file size formatting (4) |
| `api/consent/__tests__/route.test.ts` | 9 | Auth checks, type validation, boolean validation, upsert timestamps, DB error |

**Fixture Data**: `synthetic-claims.ts` — 7 synthetic `ClaimSummary` objects: Carrier (diabetes), Outpatient (pre-diabetic+obesity), Part D (Metformin PDE), PDE (Insulin Glargine), Carrier (A1C+office visit), Outpatient (eye exam+careTeam), Inpatient (5-day DKA stay)

### E2E Tests (Playwright) — 31 Tests
**Config**: `playwright.config.ts` — Chromium only, `localhost:3000`, auto-starts dev server

| File | Tests | Coverage |
|------|-------|----------|
| `coverage-check.spec.ts` | 1 | Full chat flow: send → SSE stream → suggestions render |
| `xss-security.spec.ts` | 7 | XSS in paragraphs (4), tables (2), URL params (1) |
| `spoofing-security.spec.ts` | 4 | API access control: unauthenticated → no data leak |
| `payment-trial.spec.ts` | 6 | Trial/checkout/webhook auth + validation |
| `rate-limiting.spec.ts` | 5 | Chat 429/403, checkout 503, upgrade UI |
| `consent-toggles.spec.ts` | 8 | API access control (2), toggle rendering (6 with optimistic revert) |

**E2E Patterns**: API mocking via `page.route()`, SSE streaming mock with `buildSSEResponse()`, XSS detection via `window.xssTriggered` flag, `role="switch"` accessibility selectors

### Type Checking
`npx tsc --noEmit` — TypeScript strict mode validation

---

## 31. Infrastructure & Configuration

### Configuration Modules (7)
| Module | Key Values |
|--------|------------|
| `api.ts` | Claude model (Sonnet 4.5), appeal model (Opus 4.6), maxTokens (4096), maxToolIterations (10), Blue Button config, MCP endpoints |
| `brand.ts` | "DenaliHealth", "www.denali.health", "Qash Solutions Inc", tagline |
| `pricing.ts` | Trial 14 days, credits (trial=1, monthly=3), chat limits (1/3/5/∞), upload limits (0/2MB/6MB/10MB/∞), Stripe price IDs |
| `ui.ts` | 4 starter questions, time-based greetings, Medicare thresholds (2024-2026: ALJ/Federal Court/Part B deductible), session timeout (13min warn/15min signout), accessibility config |
| `cache.ts` | TTL per data type (NPI 24h, PubMed 12h, NCD/LCD 6h, ICD-10/CPT 24h). 1000 max entries, 1h cleanup |
| `rate-limits.ts` | Per-API limits (NPI 60/min, PubMed 3/min, CMS 30/min, Claude 50/min). Retry: 3 attempts, 1s-30s backoff, ±20% jitter. Circuit breaker: 5 failures, 60s reset |
| `learning.ts` | Confidence: 0.5 initial, 0.6 min for prompt. Feedback: +0.1/−0.15. Pruning: 90 days, 5 min uses. Entity: 2-50 char phrases |

### Core Utility Libraries

| File | Purpose | Key Exports |
|------|---------|-------------|
| `lib/utils.ts` | Tailwind class merging + UI helpers | `cn()` (clsx + twMerge), `getGreeting()` (time-based: morning/afternoon/evening/hi), `formatTime()` (12h with AM/PM) |
| `lib/supabase.ts` | Browser Supabase client | `createClient()` (typed `Database` generic), `getClient()` (singleton — **CRITICAL**: all client-side code must use this, not `createClient()`, to maintain auth session) |
| `lib/supabase-server.ts` | Server Supabase client (cookie-authenticated) | `createServerSupabaseClient()` — reads/writes cookies for SSR auth. Used in ALL API routes for data fetching |
| `lib/supabase-admin.ts` | Admin/service-role client (bypasses RLS) | `createAdminClient()` — uses `SUPABASE_SERVICE_KEY`. Disables `autoRefreshToken` and `persistSession`. Used for webhooks, background jobs, audit writes |
| `lib/cache.ts` | In-memory API response cache with TTL | Generic `Cache<T>` class with: `get()`, `set()`, `getOrSet()` (fetch-or-cache pattern), `clearExpired()`, LRU eviction at max capacity. 7 singleton instances: `npiCache`, `pubmedCache`, `ncdCache`, `lcdCache`, `icd10Cache`, `cptCache`, `sadCache`. `cacheManager` aggregates stats/cleanup. Periodic cleanup interval |
| `lib/health-analytics.ts` | Dashboard metrics computation | Pure computation, no side effects. `computeDashboardMetrics(claims, coverage)` → `HealthDashboardMetrics`: financial totals (current year), denied claims with `daysUntilDeadline`/`isAppealable`, high-cost claims (>$200 owed), monthly grouping, top diagnoses/providers aggregation, tri-color status (red=denied appealable, amber=high cost/partially paid, green=all paid). Uses `MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS` (120 days) |

### TypeScript Type Definitions

| File | Purpose | Key Types |
|------|---------|-----------|
| `types/index.ts` | Core domain types | `Message` (id, role, content, timestamp, codes), `Conversation` (id, title, status, isAppeal, messages), `User` (id, phone, email, plan, theme, textSize, highContrast), `ChatResponse` (conversationId, message, suggestions, state), `Appeal` (id, denialDate, appealLetter, codes, policy refs, status, paid) |
| `types/attachment.ts` | File upload types | `FileAttachment` (fileName, mediaType, base64Data, sizeBytes), `AttachmentMediaType` (PNG/JPEG/PDF), `ALLOWED_MEDIA_TYPES` array, `FILE_INPUT_ACCEPT` string |
| `types/database.ts` | Supabase auto-generated types | Full `Database` interface with all table row/insert/update types. Regenerate with `npx supabase gen types` |

### Environment Variables
11 required: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_APPEAL_MODEL`, `BLUEBUTTON_CLIENT_ID`, `BLUEBUTTON_CLIENT_SECRET`, `BLUEBUTTON_BASE_URL`, `FHIR_TOKEN_ENCRYPTION_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PAY_PER_CLAIM`, `STRIPE_PRICE_UNLIMITED_MONTHLY`

### Next.js Config
- Server action body size limit: 15MB (for file uploads)
- Incremental TypeScript compilation enabled

### Package Dependencies (Key)
- `@anthropic-ai/sdk` v0.71.2 (Claude API)
- `@supabase/ssr` v0.8.0 + `@supabase/supabase-js` v2.93.2
- `idb` v8.0.3 (IndexedDB wrapper, ~1KB)
- `jspdf` v4.1.0 (PDF generation)
- `stripe` v20.2.0
- `next` 15.x, `react` 19.x
- `tailwindcss` v4, `typescript` v5
- `playwright` v1.58.2, `vitest` v4.0.18

---

## 32. Page Route Inventory

### Landing / Public Pages
| Route | Type | Data Fetching | Key Details |
|-------|------|---------------|-------------|
| `/` | Server (async) | `getLandingPageData()` from CMS tables, ISR 1h | Renders: Hero, Features, HowItWorks, Pricing, Testimonials, Footer. CMS-driven content |
| `/privacy` | Server (static) | None — 16 inline sections | Effective Feb 8 2026. TOC nav, max-w-3xl, uses BRAND config. Links to /hipaa |
| `/hipaa` | Server (static) | None | HIPAA notice: PHI, safeguards (technical/admin/physical), breach notification, incident response (5 phases), privacy officer contact |
| `/faq` | Server (static) | None — 9 sections, 15 Q&A | Covers: data privacy, health data, consent, Medicare, trial/pricing, appeals, AI disclosure, deletion, accessibility |
| `/terms` | Server (static) | None — 14 sections | Effective Feb 10 2026. Covers: eligibility, account, Medicare data, AI disclaimer, payment terms, acceptable use, IP, liability, CMS non-endorsement |
| `/blog` | Server (async) | `getBlogPosts(category)`, ISR 1h | Category filtering via `?category=` param. BlogGrid + LandingFooter |
| `/blog/[slug]` | Server (async) | `getBlogPost(slug)`, `generateStaticParams()` SSG | Dynamic metadata from post `meta_title`/`meta_description`. Returns `notFound()` if missing |

### App Shell Pages
| Route | Type | Data Fetching | Key Details |
|-------|------|---------------|-------------|
| `/app` | Client | None (greeting utility only) | Home hub: time-based greeting + 3 feature cards (My Health, Ask Denali, Diabetes Care) |
| `/app/chat` | Client (Suspense) | `useAuth`, `useHealthData`, `useDiabetesSnapshots`, `useChat`, `useOnlineStatus` | Reads `?id=` (conversation load), `?message=`/`?q=` (auto-send), `?topic=diabetes` (empty state), `?payment=success|cancelled` (toast). Builds `initialSessionState` from FHIR data. Auto-detects Medicare type from Part C coverage. Chat disabled when offline. 6 suggestion cards in empty state |
| `/app/health` | Client (Suspense) | `useHealthData` → `/api/fhir/data` | Three states: loading (skeleton), not connected (ConnectMedicare + OAuth error), connected (6 accordion cards with status dots). Handles `?connected=true` callback and `?error=` display |
| `/app/diabetes` | Client | `useHealthData`, `useConsent`, `useDiabetesSnapshots`, `useDiabetesLog`, `useDiabetesInsights`, `useAuth` | Comprehensive dashboard: risk alerts, AI insights (consent-gated), A1C trend, classification badge, medications, screenings, quick log (4-tab), quick actions, coverage reference, A1C guide, MDPP section (conditional), CDC risk card (when not connected) |
| `/app/settings` | Client | `useAuth`, `useTheme`, `useSettings`, `useConsent`, fetch `/api/audit-log` | 8 sections: Account (OTP flow or signed-in), Subscription (PaywallModal inline), Appearance, Accessibility, Security (TOTP), Privacy (3 toggles), Activity Log, Danger Zone (2-step delete), Reset |
| `/app/dashboard` | Client | Direct Supabase: session → role check → `get_counselor_stats` RPC → `counselor_cases` | Role-gated (counselor/provider only, redirects others). Stats + case list + outcome reporting + "New Case" button |
| `/app/claims` | Server | None | Redirect → `/app/chat` (placeholder/legacy route) |

### Other Pages
| Route | Type | Key Details |
|-------|------|-------------|
| `/admin/content` | Client (dynamic, SSR disabled) | 4-tab CMS editor: Settings, Sections, Pricing, Testimonials. Auth check on mount |
| `/outcome` | Server page + Client form (Suspense) | Token-based outcome reporting (no login). Reads `?token=` + `?outcome=`. Auto-submits if outcome in URL. 3 buttons: Approved/Denied/Still Waiting. Free credit incentive. `robots: "noindex"` |
| `/offline` | Client | Precached by SW. Mountain icon, "You're offline", links to cached health records + conversations, "Try Again" reload button |
| `/chat` | Server | Redirect → `/app/chat` |
| `/settings` | Server | Redirect → `/app/settings` |
| `/dashboard` | Server | Redirect → `/app/dashboard` |

### Error Boundaries
| Page | Behavior |
|------|----------|
| **Error** (`error.tsx`) | Full-screen error card, warning icon, "Something Went Wrong", 5s countdown auto-redirect (back if same-origin referrer, home otherwise), "Try Again" calls `reset()` |
| **Not Found** (`not-found.tsx`) | Full-screen card, info icon, "Page Not Found", 3s countdown auto-redirect, "Go to App" links to `/app` |

### Layouts
| Layout | Scope | Renders |
|--------|-------|---------|
| **Root** (`layout.tsx`) | All routes | `<html>` with Playfair Display font, inline theme script (prevents FOUC), SW registration script (register + 60min update check + SYNC_QUEUE on reconnect), ThemeProvider → AppHeader → OfflineBanner → InactivityWarning → children. Favicon links (SVG, ICO, 16px, 32px, apple-touch). OG + Twitter metadata |
| **App Shell** (`app/layout.tsx`) | `/app/*` routes | `min-h-screen flex flex-col`, content with `pb-16 md:pb-0`, desktop footer (logo + disclaimer + copyright + legal links), `BottomTabs` (mobile: Home, Health, Ask Denali, Settings) |

---

## 33. API Route Inventory

19 API routes total:

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/chat` | POST | Optional (affects rate limit tier) | Main chat with streaming SSE + tool calling + MCP |
| `/api/profile` | GET | Server-side | User plan, role, admin, credits |
| `/api/conversations` | GET | Server-side | Conversation history with titles/previews |
| `/api/consent` | GET/PUT | Server-side (401) | Consent preferences (3 types) |
| `/api/trial` | GET/POST | Server-side (401) | Trial status and activation |
| `/api/checkout` | POST | Server-side (401) | Stripe Checkout session creation |
| `/api/webhooks/stripe` | POST | Signature (HMAC) | Stripe event processing |
| `/api/appeal-outcome` | POST | Server-side (401) | In-chat appeal outcome reporting |
| `/api/outcome-report` | POST | Token-based | Email-link outcome submission (no login) |
| `/api/account/delete` | DELETE/POST | Server-side (401) | GDPR/CCPA cascade deletion |
| `/api/fhir/authorize` | GET | Server-side + AAL2 | Blue Button OAuth initiation (PKCE) |
| `/api/fhir/callback` | GET | State cookie | Blue Button OAuth token exchange |
| `/api/fhir/data` | GET | Server-side (401) | FHIR data retrieval with cache + sync |
| `/api/fhir/disconnect` | POST | Server-side (401) | Revoke Blue Button + purge data |
| `/api/diabetes/log` | GET/POST/DELETE | Server-side (401) | Daily log CRUD |
| `/api/diabetes/insights` | GET/POST | Server-side (401, 403 consent) | AI insights retrieval/regeneration |
| `/api/cms-metadata` | GET | None (public) | CMS directory listing |
| `/api/audit-log` | GET | Server-side | Grouped audit log viewer |
| `/api/block-scanner` | GET/POST | None | Returns 404 for exploit scanners |

---

## 34. Database Schema

### Core Tables (22)
`users`, `user_verification`, `subscriptions`, `usage`, `conversations`, `messages`, `appeals`, `user_feedback`, `audit_logs`, `consent_preferences`, `ehr_connections`, `fhir_cache`, `diabetes_snapshots`, `diabetes_log`, `diabetes_insights`, `chat_daily_usage`, `counselor_cases`

### Denial Code Tables (5)
`carc_codes` (90 rows), `rarc_codes` (195 rows), `eob_denial_mappings` (1,873 rows), `denial_patterns` (12 rows), `appeal_levels` (5 rows). All versioned by `effective_date` with `*_latest` views.

### Learning Tables (7)
`symptom_mappings`, `procedure_mappings`, `coverage_paths`, `conversation_patterns`, `appeal_outcomes`, `policy_cache`, `user_events`, `learning_queue`

### CMS Content Tables (4)
`site_settings`, `landing_content`, `pricing_plans`, `testimonials`, `blog_posts`

### Key RPCs (10)
`check_and_increment_chat`, `decrement_appeal_credit`, `add_appeal_credits`, `reset_monthly_appeal_credits`, `increment_appeal_count`, `check_appeal_access`, `process_feedback`, `record_appeal_outcome`, `get_learning_context`, `search_denial_codes`, `get_denial_pattern_for_carc`, `get_denial_patterns_for_cpt`, `get_grouped_audit_logs`, `get_counselor_stats`, `delete_user_cascade`, `apply_outcome_incentive`

---

## 35. External Service Integrations

| Service | Purpose | Auth | Routes |
|---------|---------|------|--------|
| **Anthropic Claude API** | Chat, tool calling, MCP, diabetes insights, appeal letters | API key (env var) | `/api/chat`, `/api/diabetes/insights` |
| **Supabase** | PostgreSQL DB, Auth (OTP, TOTP), RLS, RPCs | Cookie (server), JWT (client), admin (service role) | All routes |
| **CMS Blue Button 2.0** | Medicare FHIR data (Patient, Coverage, EOB) | OAuth 2.0 PKCE | `/api/fhir/*` |
| **Stripe** | Payments, subscriptions, webhooks | API key + webhook HMAC | `/api/checkout`, `/api/webhooks/stripe`, `/api/account/delete` |
| **NCBI PubMed** | Clinical evidence search | Rate-limited HTTP (3/sec) | Via tools in `/api/chat` |
| **CMS Coverage MCP** | LCD/NCD policy data | MCP protocol (via Anthropic API) | Via MCP in `/api/chat` |
| **NPI Registry MCP** | Provider NPI lookup | MCP protocol | Via MCP in `/api/chat` |
| **ICD-10 Codes MCP** | Diagnosis code lookup | MCP protocol | Via MCP in `/api/chat` |

---

## Component Inventory Summary

| Directory | Components | Purpose |
|-----------|-----------|---------|
| `components/ui/` | 7 | Primitives: Button, Card, Input, OfflineBanner, InactivityWarning, PrintButton, CmsPledge |
| `components/chat/` | 7 | Chat: Message, LoadingMessage, ChatInput, Suggestions (exports `Suggestions` + `QuickAction`), MarkdownContent, EmailPrompt, PrintableChecklist |
| `components/layout/` | 7 | Layout: AppHeader, Sidebar, SidebarToggle, BottomTabs, Container, Header, FeatureCard |
| `components/appeal/` | 4 | Appeal: AppealGate, AppealLetterModal, AppealOutcomePrompt, AppealCard |
| `components/auth/` | 4 | Auth: EmailOTPModal, TOTPEnrollModal, TOTPChallengeModal, PhoneOTPModal |
| `components/payment/` | 1 | Payment: PaywallModal |
| `components/health/` | 20+ | Health: ConnectMedicare, CoverageCards, DiagnosisSummaryCard, ClaimsTimeline, ClaimDetail, ClaimsList, PatientCard (FHIR PatientSummary demographics — avatar, age, gender, Medicare ID), ConditionsCard, ProviderSummary, FinancialSummary, AlertsSection (denied/high-cost/partially-paid alerts from `HealthDashboardMetrics`), AccountSection, AIDisclaimer, StatusBanner, HealthAlertsBanner, ConditionsAlertBanner, PreDiabetesRiskCard, LabResultsCard, MedicationsCard, DiabetesConsentCard, ConnectionStatus, HealthHubCard |
| `components/diabetes/` | 5 | Diabetes: A1CTrendChart, ScreeningReminders, RiskAlerts, QuickLog, InsightsCard |
| `components/landing/` | 8+ | Landing: LandingHero, LandingFeatures, LandingPricing, LandingHowItWorks, LandingTestimonials, LandingHeader, LandingFooter, 5 Illustration SVGs (CoverageCheck, HealthRecords, DiabetesCare, Appeal, PriorAuth) |
| `components/blog/` | 3 | Blog: BlogCard, BlogGrid, BlogArticle |
| `components/dashboard/` | 2 | Dashboard: CaseList, OutcomeStats |
| `components/icons/` | 1 (18 icons) | SVG icons: MountainIcon (64×64 PNG data URI logo), ShieldCheckIcon, DocumentTextIcon, ScaleIcon, ChatBubbleIcon, MagnifyingGlassIcon, ClipboardCheckIcon, CheckIcon, StarIcon (fill toggle), ArrowRightIcon, SunIcon, MoonIcon, HeartPulseIcon, DiabetesIcon, ClaimsIcon, SparkleIcon, GearIcon, HomeIcon. Plus `getIconByName(name)` dynamic lookup function (18 registered names) |
| `components/ThemeProvider.tsx` | 1 | Theme context with CSS variables |

---

## Hook Inventory Summary

| Hook | Lines | Purpose |
|------|-------|---------|
| `useAuth` | 619 | Auth state, OTP, TOTP, plan/role/admin, appeal credits, auto-trial |
| `useChat` | 780 | Chat state machine, SSE streaming, tool calls, actions, appeals |
| `useConsent` | 80 | Health/analytics consent toggles with optimistic updates |
| `useConversationHistory` | 202 | Sidebar history, date grouping, auth sync |
| `useHealthData` | 195 | Blue Button FHIR data, connect/disconnect/refresh |
| `useDiabetesSnapshots` | 76 | Longitudinal A1C/lab data from snapshots table |
| `useDiabetesLog` | 126 | Daily log CRUD, offline queue |
| `useDiabetesInsights` | 74 | Claude-generated insights, hash-based dedup |
| `useOnlineStatus` | 42 | SSR-safe online/offline detection |
| `useIdleTimeout` | 100 | HIPAA 15-min timeout with 13-min warning |
| `useSettings` | 98 | Text scale via localStorage + CSS variable |
| `useIntersectionObserver` | 56 | Scroll-triggered fade-in animations |
| `useTheme` | — | Dead code (consumers use ThemeProvider) |
| `useSupabase` | — | Dead code (consumers use getClient()) |

---

*Generated from full codebase review on February 19, 2026. All features verified against actual source code.*
