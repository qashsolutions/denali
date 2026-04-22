# Current Appeal Process — Complete Reference

> Detailed walkthrough of how appeals work in Denali, end-to-end, verified against source code as of 2026-03-28.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Step 1: Appeal Detection](#2-step-1-appeal-detection)
3. [Step 2: Skill Loading & Claude Prompt Injection](#3-step-2-skill-loading--claude-prompt-injection)
4. [Step 3: Denial Code Lookup](#4-step-3-denial-code-lookup)
5. [Step 4: Gathering Denial Details](#5-step-4-gathering-denial-details)
6. [Step 5: Code Validation & Evidence Search](#6-step-5-code-validation--evidence-search)
7. [Step 6: Appeal Letter Generation (Levels 1–5)](#7-step-6-appeal-letter-generation-levels-15)
8. [Step 7: Server-Side Persistence](#8-step-7-server-side-persistence)
9. [Step 8: SSE Response to Client](#9-step-8-sse-response-to-client)
10. [Step 9: Client-Side Rendering](#10-step-9-client-side-rendering)
11. [Step 10: AppealGate — Access Control](#11-step-10-appealgate--access-control)
12. [Step 11: Appeal Letter Modal — View / Copy / Download / Print](#12-step-11-appeal-letter-modal--view--copy--download--print)
13. [Step 12: Appeal Outcome Reporting](#13-step-12-appeal-outcome-reporting)
14. [Step 13: Outcome Prompting on Return Visit](#14-step-13-outcome-prompting-on-return-visit)
15. [Medicare Advantage vs Original Medicare](#15-medicare-advantage-vs-original-medicare)
16. [Multi-Level Appeal Escalation (Levels 2–5)](#16-multi-level-appeal-escalation-levels-25)
17. [Credit System & Paywall](#17-credit-system--paywall)
18. [Deadline Calculation](#18-deadline-calculation)
19. [Database Tables & Functions](#19-database-tables--functions)
20. [File Reference Map](#20-file-reference-map)

---

## 1. Overview

The appeal process in Denali follows this high-level flow:

```
User mentions denial → Appeal detected → APPEAL_SKILL loaded → Claude gathers details
→ lookup_denial_code → code validation + PubMed search → generate_appeal_letter
→ Letter saved to DB (atomic: INSERT + credit decrement) → SSE response to client
→ AppealCard rendered → User clicks "View" → AppealGate checks auth + credits
→ AppealLetterModal displays letter → Copy / Download PDF / Print
→ (Later) User reports outcome → Free credit incentive → Learning system updated
```

**Model selection**: Sonnet 4.6 handles the chat. When `isAppeal` is detected, the system switches to **Opus 4.6** (via `ANTHROPIC_APPEAL_MODEL`) for higher-quality formal letter generation.

**Source**: `app/src/app/api/chat/route.ts:420` — `const modelOverride = sessionState.isAppeal`

---

## 2. Step 1: Appeal Detection

Appeals are detected from **user messages only** (not assistant responses) via regex in `extractUserInfo()`.

**Source**: `app/src/lib/claude.ts:1014–1071`

### Appeal Intent Detection

```
Regex: /\b(appeal|appealing|denied|denial|rejected|refused)\b/i
```

When matched, `sessionState.isAppeal = true` is set, which triggers:
- Model switch to Opus 4.6
- APPEAL_SKILL loading in skills-loader
- Appeal-specific tool access

### Appeal Level Detection (Level 2–5 Escalation)

If `isAppeal` is already true, additional regexes detect escalation:

| Regex | Sets `appealLevel` |
|-------|-------------------|
| `appeal was denied\|redetermination denied\|level 1 denied\|first appeal denied\|...` | 2 |
| `qic denied\|reconsideration denied\|level 2 denied\|second appeal denied\|ire denied` | 3 |
| `alj denied\|hearing denied\|judge denied\|level 3 denied\|third appeal denied` | 4 |
| `appeals council denied\|council denied\|level 4 denied\|fourth appeal denied` | 5 |

### Denial Code Extraction from User Messages

When in appeal context, regex patterns extract CARC/RARC codes:

```
CO-50, PR-1, OA-23         →  code patterns like /(?:CO|PR|OA|PI)-?(\d{1,4})/gi
CARC 50, RARC N123          →  /(?:CARC|RARC)\s*[:#-]?\s*(\d{1,4})/gi
"code 50", "denial code 96" →  /code\s*[:#]?\s*(\d{1,4})/gi
RARC N56, M144              →  /(?:RARC)\s*[:#-]?\s*([A-Z]\d{1,4})/gi
```

Extracted codes are pushed to `sessionState.denialCodes[]`.

### Denial Date Extraction

```
Regex: /(?:denied|denial|rejected).*?(\d{1,2}\/\d{1,2}\/\d{2,4}|...)/i
```

Matches formats: `1/15/2026`, `2026-01-15`, `January 15, 2026`, etc.
Stored in `sessionState.denialDate`.

---

## 3. Step 2: Skill Loading & Claude Prompt Injection

When `triggers.isAppeal` is true, the skills-loader injects the `APPEAL_SKILL` prompt section into Claude's system prompt.

**Source**: `app/src/lib/skills-loader.ts:488–492`

```typescript
if (triggers.isAppeal) {
  sections.push(APPEAL_SKILL);
}
```

`CODE_VALIDATION_SKILL` is also loaded alongside appeals (`triggers.isAppeal` is one of the conditions at line 484).

### What APPEAL_SKILL Tells Claude

**Source**: `app/src/skills/domain/appeal.ts`

The skill prompt instructs Claude to follow this exact flow:

1. Ask for the denial code from the user's EOB
2. Look up the code using `lookup_denial_code` (FIRST tool call)
3. Explain in plain English what it means
4. Provide the appeal strategy and estimated success rate
5. Ask for the denial date (CRITICAL for deadline calculation)
6. Verify diagnosis supports procedure via code validation
7. Search PubMed for clinical evidence
8. Generate the appeal letter with policy citations + PubMed evidence

**Tool efficiency rules** (prevents timeout):
- Maximum 10 tool-calling rounds
- Typical efficient appeal: 4–6 rounds
- Round 1: `lookup_denial_code`
- Round 2: Gather details from user (no tools)
- Round 3: `search_cpt` + ICD-10 + coverage lookup — batched
- Round 4: PubMed search
- Round 5: `generate_appeal_letter`

**Encouragement stats** (from CMS/OIG/KFF data, included in the prompt):
- MA appeals: 80%+ success rate
- Original Medicare: ~40% Level 1 success, 64% for DME
- ALJ hearings: ~70% rule in patient's favor
- Only 11.5% of denied patients actually appeal

---

## 4. Step 3: Denial Code Lookup

The **first tool Claude calls** in an appeal flow is `lookup_denial_code`.

**Source**: `app/src/lib/tools/index.ts:411–430`

### Tool Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | CARC or RARC code (e.g., "CO-50", "50", "N362") |
| `description_search` | string | Free-text search of denial descriptions |
| `eob_code` | string | EOB code from patient's Explanation of Benefits |

### What It Returns

The executor queries three database tables:
1. `carc_codes` — Claim Adjustment Reason Codes (90 codes)
2. `rarc_codes` — Remittance Advice Remark Codes (195 codes)
3. `eob_denial_mappings` — Maps payer EOB codes to standard CARC/RARC (1,873 mappings)

Then calls `get_denial_pattern_for_carc()` to get the appeal strategy.

**Response includes**:
- Plain English description of the denial code
- Category (e.g., "Medical Necessity", "Documentation")
- Appeal strategy text
- Documentation checklist (what to gather)
- Estimated success rate
- Appeal deadline in days

### Common Denial Codes (from the skill prompt)

| Code | Meaning | Appeal Success |
|------|---------|---------------|
| CO-50 / PR-50 | Not medically necessary | ~40% |
| CO-96 / PR-96 | Not covered / experimental | Lower |
| CO-16 | Missing information | Usually a billing fix |
| CO-167 | Diagnosis doesn't match procedure | Moderate |
| CO-97 | Bundled with another service | Moderate |
| CO-119 | Frequency limit reached | Lower |

---

## 5. Step 4: Gathering Denial Details

After the denial code lookup, Claude gathers information from the user conversationally (no tools needed):

1. **What was denied?** — procedure description
2. **When was it denied?** — denial date (CRITICAL for deadline)
3. **Why?** — denial reason (code or description)
4. **Prior treatments?** — what was tried first
5. **Provider name?** — ordering physician
6. **Medicare type?** — detected from Blue Button or asked

Claude asks one question at a time per the guardrails, and acknowledges each answer before moving on.

---

## 6. Step 5: Code Validation & Evidence Search

Once Claude has enough context, it batches multiple tool calls in one round:

### Code Validation Tools
- `search_icd10` — maps diagnosis description to ICD-10 codes
- `search_cpt` — maps procedure description to CPT codes
- `get_related_diagnoses` / `get_related_procedures` — cross-validates codes
- `check_prior_auth` — checks if prior authorization was required
- `search_local_coverage` / `search_national_coverage` — finds LCD/NCD policy references

### Clinical Evidence (PubMed)
- `search_pubmed` — searches for systematic reviews, meta-analyses, clinical guidelines
- Search terms: `"[condition] AND [procedure] AND (medical necessity OR clinical evidence)"`
- Limited to 1–3 strongest citations
- Included in the appeal letter under "Supporting Clinical Evidence"

---

## 7. Step 6: Appeal Letter Generation (Levels 1–5)

The final tool call is `generate_appeal_letter`.

**Source**: `app/src/lib/tools/index.ts:316–1419`

### Tool Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `denial_reason` | Yes | Why the claim was denied |
| `procedure_description` | Yes | What service was denied |
| `diagnosis_description` | Yes | Patient's diagnosis |
| `patient_history` | No | Relevant medical history |
| `prior_treatments` | No | Array of prior treatments tried |
| `patient_name` | No | Patient's first name |
| `provider_name` | No | Ordering physician name |
| `denial_date` | No | YYYY-MM-DD format |
| `policy_references` | No | LCD/NCD policy numbers + text |
| `pubmed_citations` | No | PubMed citations from search |
| `medicare_type` | No | "original" or "advantage" |
| `plan_name` | No | MA plan name (for advantage) |
| `appeal_level` | No | 1–5 (default: 1) |
| `prior_appeal_date` | No | Date of prior level's denial (Level 2+) |
| `amount_in_controversy` | No | Dollar amount (required for Level 3+) |

### Letter Generation by Level

#### Level 1: Redetermination (Original Medicare) / Request for Reconsideration (MA)
- Full formal letter generated
- Addressed to MAC (Original) or Plan Appeals Dept (MA)
- Sections: Medical Necessity, Clinical Evidence, Medicare Coverage Criteria, Requested Action
- Includes ICD-10/CPT codes inline, policy references, PubMed citations
- Enclosure checklist: denial notice, medical records, physician order, supporting documentation

#### Level 2: QIC Reconsideration (Original) / IRE Independent Review (MA)
- **Original Medicare**: Full formal letter generated, addressed to QIC. Beneficiary files within 180 days. 42 CFR §405.960.
- **Medicare Advantage**: The plan auto-forwards the case to the IRE per 42 CFR §422.590 — the beneficiary does NOT file separately. The generated letter title is "Supplementary Statement for Independent Review" and serves as supplementary evidence the beneficiary can submit to strengthen their case.
- References Level 1 denial decision date
- Additional section: "Errors in Prior Decision" + new evidence

#### Level 3: ALJ Hearing Request
- Full formal letter generated
- Addressed to OMHA (Office of Medicare Hearings and Appeals)
- **Amount-in-controversy gate**: asks user for dollar amount
  - 2026 threshold: $200 for ALJ hearing
  - Below threshold: warning included but letter still generated
- Hearing preference: in-person / telephone / video
- 42 CFR §405.1000 (Original) / 42 CFR §422.600 (MA)

#### Level 4: Medicare Appeals Council — INFORMATIONAL ONLY
- No formal letter generated (`letter: null, informational: true`)
- Returns guidance text + next steps
- Recommends SHIP counselors: **1-877-839-2675**
- 60 days to file from ALJ decision
- Legal representation recommended

#### Level 5: Federal District Court — INFORMATIONAL ONLY
- No formal letter generated (`letter: null, informational: true`)
- 2026 amount-in-controversy threshold: **$1,960**
- Attorney required
- 60 days from Appeals Council decision
- Returns guidance + next steps + SHIP referral

### All Letters Include

Every generated letter (Levels 1–3) starts with:

```
IMPORTANT: This is a DRAFT letter generated by AI. It is NOT legal advice.
Review all details carefully before submitting. Verify dates, codes, and
facts with your healthcare provider. Fill in all blank fields before mailing.
```

### Tool Return Data

```typescript
{
  success: true,
  data: {
    letter: string | null,           // Full letter text (null for Levels 4–5)
    informational: boolean,          // true for Levels 4–5
    appeal_level: number,            // 1–5
    level_name: string,              // e.g., "Federal District Court Review"
    guidance: string,                // For Levels 4–5
    next_steps: string[],            // For Levels 4–5
    denial_date: string,
    appeal_deadline: string,         // Formatted date
    days_remaining: number,
    deadline_expired: boolean,
    deadline_warning: string | null, // URGENT if <=14 days, WARNING if expired
    diagnosis_codes: Array<{code, description}>,
    procedure_codes: Array<{code, description}>,
    requirements: string[],
    instructions: string[],          // Level-specific mailing instructions
  }
}
```

---

## 8. Step 7: Server-Side Persistence

After Claude finishes, `route.ts` saves the appeal to the database.

**Source**: `app/src/app/api/chat/route.ts:499–532`

### What Gets Saved

```typescript
saveAppeal(conversationId, "", {
  appealLetter: result.appealLetter || result.content,
  denialReason: ss.denialCodes.length > 0 ? `CARC ${ss.denialCodes.join(", ")}` : undefined,
  denialDate: ss.denialDate || undefined,
  icd10Codes: ss.diagnosisCodes,
  cptCodes: ss.procedureCodes,
  lcdRefs: policyReferences.filter(r => r.startsWith("L")),
  ncdRefs: policyReferences.filter(r => r.startsWith("NCD")),
  medicareType: ss.medicareType || undefined,
  appealLevel: ss.appealLevel || 1,
  priorAppealId: ss.priorAppealId || undefined,
});
```

### Atomic Transaction (in `conversation-server.ts`)

**Source**: `app/src/lib/conversation-server.ts:9–113`

The save is wrapped in a database transaction:

1. **INSERT** the appeal row into the `appeals` table
2. **Decrement credit** — ONLY for Level 1 (`level === 1`). Level 2+ = free escalation.
3. If either operation fails, the entire transaction rolls back (no free appeals from failed decrements)

**Post-transaction** (fire-and-forget, non-critical):
- `increment_appeal_count()` — updates lifetime counter
- `scheduleOutcomeFollowups()` — schedules day_30 and day_60 followup reminders in `outcome_followups` table

### Deadline Calculation in `saveAppeal()`

```
Level 1: denialDate + getAppealDeadlineDays(medicareType)  → 120 days (Original) / 60 days (MA)
Level 2 FFS: denialDate + 180 days
Level 2 MA: null (plan auto-forwards to IRE per 42 CFR §422.590)
Level 3+: denialDate + 60 days
```

### Audit Logging

On successful save, an `APPEAL_GENERATED` audit event is logged with the appeal ID, conversation ID, and denial codes.

---

## 9. Step 8: SSE Response to Client

The appeal data is sent to the client as the final SSE event.

**Source**: `app/src/app/api/chat/route.ts:534–543`

```typescript
writeSSE("done", {
  content: result.content,           // Claude's conversational response
  suggestions: result.suggestions,
  conversationId,
  sessionState: result.sessionState,
  toolsUsed: result.toolsUsed,       // includes "generate_appeal_letter"
  appealId,                          // DB ID of saved appeal
  appealLetter: result.appealLetter, // Full letter text (separate from content)
});
```

The `appealLetter` field is separate from `content` — content has Claude's conversational explanation, while `appealLetter` has the formal letter text.

---

## 10. Step 9: Client-Side Rendering

### useChat Hook Processing

**Source**: `app/src/hooks/useChat.ts`

When the `done` SSE event arrives with `toolsUsed` including `"generate_appeal_letter"`:

1. `data.appealLetter` populates `letterContent` (falls back to `data.content`)
2. An `AppealLetterData` object is created with:
   - `letterContent` — the full markdown letter
   - `denialCodes` — from sessionState
   - `policyReferences` — LCD/NCD refs
   - `denialDate` / `appealDeadline` — from sessionState
   - `appealLevel` — 1–5
   - `isInformational` — true for Levels 4–5
   - `levelName` / `guidance` / `nextSteps` — for informational levels
3. `currentAction` is set to `{ type: "show_appeal", data: appealData }`

### AppealCard (Inline Chat Display)

**Source**: `app/src/components/appeal/AppealCard.tsx`

Renders a compact card in the message stream:

```
[PDF Icon]  Appeal Letter
            Denial: CO-50 · 45 days to file
            [View]
```

- Shows denial codes
- Shows days remaining (or "Deadline passed")
- "View" button triggers `showAppealModal()`

---

## 11. Step 10: AppealGate — Access Control

When the user clicks "View", the letter is wrapped in `AppealGate`.

**Source**: `app/src/components/appeal/AppealGate.tsx`

### Access Flow

```
1. Not authenticated (no email verified)
   → Show blurred preview + "Sign Up to Get Started" overlay
   → "Sign Up Free" button opens EmailOTPModal

2. Authenticated + checkAppealAccess()
   → "available" (has credits)     → Render letter, call onAccessGranted()
   → "allowed" (admin/unlimited)   → Render letter, call onAccessGranted()
   → "paywall" (no credits/trial)  → Show blurred preview + "Unlock Your Appeal Letter"
                                    → "View Pricing" button opens PaywallModal
```

### `checkAppealAccess()` Logic (in `useAuth.ts`)

```
Admin                          → "allowed"
Counselor/Provider role        → "allowed"
Not email verified             → "paywall"
Plan = "unlimited"             → "allowed"
Plan = "trial"                 → "paywall" (0 credits)
Plan = "starter" or "plus"     → credits > 0 ? "available" : "paywall"
```

**Type**: `AppealAccessStatus = "available" | "paywall" | "allowed"`

### Gated Display

- **Access denied**: Content is shown blurred (`blur-sm opacity-50 pointer-events-none`) behind a dark overlay with unlock prompt
- **Access granted**: Children render directly; action buttons (Copy/Download/Print) become visible

### PaywallModal

**Source**: `app/src/components/payment/PaywallModal.tsx`

Shows three subscription options:
- Starter: $10/mo (1 appeal credit)
- Plus: $20/mo (2 appeal credits) — "Most Popular"
- Unlimited: $60/mo (unlimited appeals)

Purchase flow: Select plan → POST `/api/checkout` → Stripe Checkout → webhook → plan upgrade + credit reset.

---

## 12. Step 11: Appeal Letter Modal — View / Copy / Download / Print

**Source**: `app/src/components/appeal/AppealLetterModal.tsx`

### Modal Structure

```
┌─────────────────────────────────────────┐
│ Header: "Appeal Letter" (or Level label) │
│ [Copy] [Download PDF] [Print] [X Close]  │
├─────────────────────────────────────────┤
│ Deadline Banner:                         │
│   Red:  ≤14 days remaining               │
│   Amber: >14 days remaining              │
│   Gray: Deadline passed                   │
├─────────────────────────────────────────┤
│ Free Escalation Banner (Level 2+):       │
│   "No additional credit used"             │
├─────────────────────────────────────────┤
│ Review Checklist:                         │
│   □ Fill in Medicare number               │
│   □ Sign and date the letter              │
│   □ Attach denial notice                  │
│   □ Include medical records               │
│   □ Mail to address on denial notice      │
├─────────────────────────────────────────┤
│ Letter Content (wrapped in AppealGate)   │
│   [Full markdown-rendered letter]         │
├─────────────────────────────────────────┤
│ Footer:                                   │
│   Policy references (LCD/NCD)             │
│   "Report appeal outcome" link            │
└─────────────────────────────────────────┘
```

### Informational Mode (Levels 4–5)

- No formal letter displayed
- "Guidance Only" banner
- Shows guidance text + next steps
- SHIP counselor number: 1-877-839-2675
- No Copy/Download/Print buttons
- No gating (guidance is always freely accessible)

### Letter Content Processing

- `extractLetterContent()` — extracts the formal letter from "MEDICARE APPEAL REQUEST" to "Sincerely"
- `getCleanLetter()` — strips markdown formatting for copy/PDF operations

### Actions (Visible Only When Access Granted)

1. **Copy**: `navigator.clipboard.writeText(cleanText)` — copies plain text letter
2. **Download PDF**: `buildPDF(cleanText, deadlineInfo)` → `doc.save("appeal-letter-YYYY-MM-DD.pdf")`
   - Page 1: Formal appeal letter (Helvetica 11pt, 1" margins)
   - Page 2: Instructions & tips for mailing
3. **Print**: `doc.output("blob")` → opens PDF in new browser tab → native print dialog
   - Never uses `window.print()` (would print the whole page)

---

## 13. Step 12: Appeal Outcome Reporting

Users can report what happened with their appeal.

**Source**: `app/src/app/api/appeal-outcome/route.ts`

### How It's Triggered

1. **In modal footer**: "Report appeal outcome" link
2. **In chat**: `AppealOutcomePrompt` component

### AppealOutcomePrompt UI

```
How did your appeal turn out?
[Approved] [Denied] [Partially Approved]
[Submit] [Skip]
```

### API: POST /api/appeal-outcome

**Request**:
```typescript
{
  appealId: string;
  outcome: "approved" | "denied" | "partial";
  denialReason?: string;
  approvalNotes?: string;
  daysToDecision?: number;
}
```

**Processing**:
1. Authenticate user
2. `recordAppealOutcome()` — updates appeal status + adjusts coverage path confidence:
   - Approved: +0.15 confidence
   - Partial: +0.05
   - Denied: -0.10
3. Audit log: `APPEAL_OUTCOME`
4. `applyOutcomeIncentive(email)` — awards **1 free appeal credit**

**Response**:
```json
{
  "success": true,
  "incentiveApplied": true,
  "message": "Thank you for reporting your appeal outcome! You've earned a free appeal credit."
}
```

---

## 14. Step 13: Outcome Prompting on Return Visit

When a user returns to chat and has an unreported appeal outcome, the system proactively asks about it.

**Source**: `app/src/skills/domain/outcome-prompting.ts`

### Detection

`route.ts` calls `getUnreportedOutcome(email)` which checks the `outcome_followups` table for scheduled followups (day_30, day_60) that haven't been reported yet.

### Prompt Injected into Claude

```
"Welcome back! Last time we worked on your Level {appealLevel} appeal
for {procedure}. Did you hear back from Medicare?"
```

### Branching

- **Approved** → Congratulate, record outcome, mention earned free credit
- **Denied** → Empathize, offer Level N+1 escalation: "It won't use any additional credits — escalation appeals for the same service are free."
- **Partially approved** → Acknowledge, ask if they want to appeal the remaining portion
- **Still waiting** → Acknowledge, move on to current question
- **Different topic** → Don't block — let them proceed

---

## 15. Medicare Advantage vs Original Medicare

The system detects Medicare type from Blue Button data or user input and branches the appeal flow accordingly.

**Source**: `app/src/lib/tools/index.ts`, `app/src/skills/domain/appeal.ts`, `app/src/config/ui.ts`

| Aspect | Original Medicare | Medicare Advantage |
|--------|-------------------|-------------------|
| **Level 1 Name** | Redetermination | Request for Reconsideration |
| **Level 1 Addressee** | Medicare Administrative Contractor (MAC) | Plan Appeals Department |
| **Level 1 Deadline** | 120 days (42 CFR 405.904) | 60 days (42 CFR §422.582) |
| **Level 2 Name** | QIC Reconsideration | IRE Independent Review |
| **Level 2 Filing** | 180 days (beneficiary files) | Auto-forwarded by plan (42 CFR §422.590) |
| **Level 2 Letter Title** | Request for Reconsideration | Supplementary Statement for Independent Review |
| **Level 2 Legal Cite** | 42 CFR §405.960 | 42 CFR §422.590 |
| **Level 3 Legal Cite** | 42 CFR §405.1000 | 42 CFR §422.600 |
| **Levels 3–5** | Same for both | Same for both |
| **Key Legal Argument** | Standard medical necessity | 42 CFR §422.101: MA plans must cover everything Original Medicare covers |
| **Mailing Address** | On denial notice | Plan card or denial notice |

**Detection**: `sessionState.medicareType` is set from:
1. Blue Button coverage data (Part C = "advantage", Part A/B = "original")
2. `extractUserInfo()` from user messages
3. Explicit user statement

---

## 16. Multi-Level Appeal Escalation (Levels 2–5)

### Summary

| Level | Name | Deadline | Threshold | Output | Credit Cost |
|-------|------|----------|-----------|--------|-------------|
| 1 | Redetermination (FFS) / Request for Reconsideration (MA) | 120d (FFS) / 60d (MA) | None | Full letter | 1 credit |
| 2 | QIC Reconsideration (FFS) / IRE Review (MA) | 180d (FFS) / auto-forwarded by plan (MA) | None | Full letter (FFS) / Supplementary statement (MA) | FREE |
| 3 | ALJ Hearing | 60 days | $200 (2026) | Full letter | FREE |
| 4 | Medicare Appeals Council | 60 days | None | Guidance only | FREE |
| 5 | Federal District Court | 60 days | $1,960 (2026) | Guidance only | FREE |

### Key Rule: One Credit Per Denial

Level 1 is the only appeal that costs a credit. All subsequent levels (2–5) for the **same denial** are free. This is enforced in the `saveAppeal()` transaction:

```typescript
// Only charge credit for Level 1 (new appeal).
// Level 2+ for the same denial = free escalation.
if (resolvedEmail && level === 1) {
  await txQuery(`SELECT decrement_appeal_credit($1)`, [resolvedEmail]);
}
```

### Level Linking

Level 2+ appeals are linked to the prior level via `prior_appeal_id` foreign key in the `appeals` table. This creates a chain: Level 1 → Level 2 → Level 3 → etc.

### Annual Thresholds (from CMS)

**Source**: `app/src/config/ui.ts:88–107`

| Year | ALJ Threshold | Federal Court Threshold | Part B Deductible |
|------|---------------|------------------------|-------------------|
| 2024 | $180 | $1,840 | $240 |
| 2025 | $190 | $1,900 | $257 |
| 2026 | $200 | $1,960 | $265 |

`getCurrentThresholds()` returns the thresholds for the current year (or most recent available).

---

## 17. Credit System & Paywall

### Credit Flow

```
Signup → Auto 14-day trial (0 appeal credits)
  ↓
Trial user tries appeal → Paywall (must subscribe)
  ↓
User subscribes:
  Starter ($10/mo) → 1 appeal credit
  Plus ($20/mo)    → 2 appeal credits
  Unlimited ($60/mo) → Bypasses all credit checks
  ↓
Appeal generated → decrement_appeal_credit (Level 1 only)
  ↓
User reports outcome → applyOutcomeIncentive() → +1 free credit
  ↓
Monthly renewal → reset_monthly_appeal_credits (Starter: 1, Plus: 2)
```

### Database Functions

| Function | Purpose |
|----------|---------|
| `decrement_appeal_credit(email)` | Decrements available credits. Returns remaining (-1 if none). SECURITY DEFINER |
| `add_appeal_credits(email, credits)` | Adds credits (used by Stripe fulfillment) |
| `reset_monthly_appeal_credits(email, credits)` | Resets to N credits (used on subscription renewal) |
| `increment_appeal_count(email, userId)` | Increments lifetime appeal counter |
| `apply_outcome_incentive(email)` | Awards 1 free credit for reporting outcome |

### Stripe Integration

**Source**: `app/src/lib/stripe-fulfillment.ts`

- `fulfillCheckoutSession()` — on checkout: sets plan + resets credits to plan amount
- `handleSubscriptionEvent()` — on renewal: resets credits; on cancellation: reverts plan
- Credit amounts per plan determined by `creditsForPlan()`:
  - Starter → 1
  - Plus → 2
  - Unlimited → skip (bypasses credit system entirely)

---

## 18. Deadline Calculation

**Source**: `app/src/lib/conversation-server.ts:43–52` and `app/src/lib/tools/index.ts:1050–1071`

### Formula

```
Level 1: denialDate + getAppealDeadlineDays(medicareType)
         → Original Medicare: denialDate + 120 days
         → Medicare Advantage: denialDate + 60 days

Level 2 FFS: baseDate + 180 days
             (baseDate = priorAppealDate if available, else denialDate)
Level 2 MA: null — plan auto-forwards to IRE, no beneficiary deadline

Level 3+: baseDate + 60 days
          (baseDate = priorAppealDate if available, else denialDate)
```

### Deadline Warnings

| Condition | Warning |
|-----------|---------|
| `daysRemaining <= 0` | "WARNING: The N-day appeal deadline passed X days ago. May still file with good cause for late filing, but success is less likely." |
| `daysRemaining <= 14` | "URGENT: Only N days remaining to file this appeal. The user must act immediately." |
| `daysRemaining > 14` | No warning |

### UI Color Coding

- **Red**: deadline expired OR ≤14 days remaining
- **Amber**: >14 days remaining
- **Gray**: deadline passed (informational)

---

## 19. Database Tables & Functions

### Appeals Table

```sql
appeals (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  email TEXT,
  user_id UUID REFERENCES users(id),
  appeal_letter TEXT NOT NULL,
  denial_date DATE,
  denial_reason TEXT,
  service_description TEXT,
  icd10_codes TEXT[],
  cpt_codes TEXT[],
  ncd_refs TEXT[],
  lcd_refs TEXT[],
  pubmed_refs TEXT[],
  appeal_level INTEGER NOT NULL DEFAULT 1,
  prior_appeal_id UUID REFERENCES appeals(id),
  deadline DATE,
  status TEXT DEFAULT 'draft',  -- draft, sent, approved, denied, pending, partial
  paid BOOLEAN DEFAULT FALSE,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### Supporting Tables

| Table | Purpose | Rows |
|-------|---------|------|
| `carc_codes` | Claim Adjustment Reason Codes | 90 |
| `rarc_codes` | Remittance Advice Remark Codes | 195 |
| `eob_denial_mappings` | Payer EOB → standard CARC/RARC | 1,873 |
| `denial_patterns` | Denial reasons + appeal strategies + checklists | 12 |
| `appeal_levels` | Medicare's 5 appeal levels with timeframes | 5 |
| `usage` | Appeal credits + lifetime count per email | Per user |
| `outcome_followups` | Scheduled day_30/day_60 outcome check-ins | Per appeal |

### Key Database Functions

| Function | Used By |
|----------|---------|
| `get_denial_pattern_for_carc(code)` | `lookup_denial_code` tool |
| `get_denial_patterns_for_cpt(code)` | `get_common_denials` tool |
| `search_denial_codes(text)` | Full-text search across CARC/RARC/EOB tables |
| `check_appeal_access(email)` | Legacy — client now checks credits directly |
| `decrement_appeal_credit(email)` | `saveAppeal()` transaction |
| `increment_appeal_count(email, userId)` | Post-save followup |
| `get_unreported_outcome(email)` | `route.ts` — detects pending outcomes |
| `record_appeal_outcome(id, outcome, ...)` | `appeal-outcome/route.ts` |
| `apply_outcome_incentive(email)` | Awards free credit on outcome report |

### Versioning

All denial-related tables use `effective_date` column. Views `carc_codes_latest`, `rarc_codes_latest`, etc. always return rows where `effective_date = MAX(effective_date)`. When CMS publishes updates, insert new rows with a newer date; old rows preserved for history.

---

## 20. File Reference Map

| File | Role in Appeal Flow |
|------|---------------------|
| `src/lib/claude.ts` | `extractUserInfo()` — appeal detection, denial code/date extraction, level detection |
| `src/lib/skills-loader.ts` | Injects `APPEAL_SKILL` when `triggers.isAppeal` |
| `src/skills/domain/appeal.ts` | The APPEAL_SKILL prompt — instructs Claude on the full appeal flow |
| `src/skills/domain/outcome-prompting.ts` | OUTCOME_PROMPTING_SKILL — asks returning users about appeal results |
| `src/lib/tools/index.ts` | `lookup_denial_code` + `generate_appeal_letter` tool definitions and executors |
| `src/lib/denial-patterns.ts` | Database queries for CARC strategies, denial patterns, appeal levels |
| `src/config/ui.ts` | `MEDICARE_CONSTANTS` — deadlines (120/60/180/60), thresholds ($200/$1,960) |
| `src/app/api/chat/route.ts` | Orchestrates: model switch → skill loading → Claude loop → `saveAppeal()` → SSE response |
| `src/lib/conversation-server.ts` | `saveAppeal()` — atomic transaction (INSERT + credit decrement), outcome followup scheduling |
| `src/hooks/useChat.ts` | Client-side appeal data extraction from SSE, `AppealLetterData` construction |
| `src/components/appeal/AppealGate.tsx` | Access control: email OTP → credit check → paywall pipeline |
| `src/components/appeal/AppealCard.tsx` | Compact inline card in chat message stream |
| `src/components/appeal/AppealLetterModal.tsx` | Full modal: letter display, deadline banner, actions, review checklist |
| `src/components/appeal/AppealOutcomePrompt.tsx` | Outcome reporting UI (approved/denied/partial) |
| `src/lib/appeal-pdf.ts` | `buildPDF()` — jsPDF letter generation (2-page: letter + instructions) |
| `src/components/payment/PaywallModal.tsx` | Subscription plans for appeal access |
| `src/app/api/appeal-outcome/route.ts` | POST endpoint: records outcome + applies credit incentive |
| `src/app/api/appeals/route.ts` | GET endpoint: retrieves appeals for a conversation |
| `src/lib/conversation-service.ts` | `loadAppealsForConversation()` — client-side fetch |
| `src/lib/stripe-fulfillment.ts` | Credit management on subscription events |
| `src/hooks/useAuth.ts` | `checkAppealAccess()` — determines `AppealAccessStatus` |
