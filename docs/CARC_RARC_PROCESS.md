# CARC/RARC Denial Code Integration — Process Document

## What We Have

**Excel File**: `CARC-RARC-Consolidated List 12-10-2025.xlsx`
- **90 CARC codes** (Claim Adjustment Reason Codes) — the official "why" behind every Medicare denial
- **195 RARC codes** (Remittance Advice Remark Codes) — additional detail explaining the denial
- **1,873 EOB mappings** — connects internal EOB codes to CARC + RARC pairs

**Example**: EOB code `0201` → CARC `16` ("Claim lacks information needed for adjudication") → RARC `N280` ("Missing pay-to provider primary identifier")

---

## Current State (All Steps Complete)

All data lives in Supabase. There are no hardcoded denial patterns, appeal strategies, or reason code maps in the codebase. The file `denial-patterns.ts` contains only TypeScript types and async functions that query Supabase.

### Supabase Tables

| Table | Rows | Purpose |
|-------|------|---------|
| `carc_codes` | 90 | Each CARC code with its official description, a category (e.g., "Medical Necessity"), and a plain English translation |
| `rarc_codes` | 195 | Each RARC code with its description and plain English translation |
| `eob_denial_mappings` | 1,873 | Links EOB codes to their CARC + RARC pair — so if a patient reads a code off their EOB, we can trace it to the actual denial reason |
| `denial_patterns` | 12 | Common denial reasons with appeal strategies, documentation checklists, CPT lists, and estimated success rates |
| `appeal_levels` | 5 | Medicare's 5 appeal levels with timeframes, descriptions, and success rates |

**Versioning via `effective_date`**:
- All five tables include an `effective_date` column (DATE type)
- The initial seed uses `2025-12-10` (the CMS publish date on the Excel file)
- When CMS publishes updates (e.g., March 2026), insert new rows with `effective_date = '2026-03-15'`
- Old rows are never deleted — they stay for historical reference
- Five database views (`carc_codes_latest`, `rarc_codes_latest`, `eob_denial_mappings_latest`, `denial_patterns_latest`, `appeal_levels_latest`) always pull from the most recent `effective_date`
- All tools query these views, so they automatically use the latest data

**RLS**: All tables have Row Level Security enabled with public read-only policies. Views use `security_invoker = true`.

### Supabase Functions

| Function | Purpose |
|----------|---------|
| `get_denial_pattern_for_carc(carc_code)` | Maps a CARC code (e.g., "50", "CO-50") to the matching denial pattern via the `reason_codes` array. Strips group prefixes for matching. Returns appeal strategy, checklist, success rate, deadline. |
| `get_denial_patterns_for_cpt(cpt_code)` | Returns all denial patterns where the given CPT code appears in `common_cpts`. Used to warn about common denial reasons for a procedure. |
| `search_denial_codes(search_text)` | Full-text search across CARC, RARC, and EOB tables. |

---

## Implementation Steps (Completed)

### Step 1: Store CARC/RARC Data in Supabase

Created `carc_codes`, `rarc_codes`, and `eob_denial_mappings` tables with `effective_date` versioning and `_latest` views.

### Step 2: Convert Excel to SQL

Ran a one-time script that read the Excel file and generated SQL INSERT statements for all three tables. All rows tagged with `effective_date = '2025-12-10'`. For the ~15 most common CARCs (50, 96, 16, etc.), added a `plain_english` translation.

**Future updates**: When CMS publishes a new list, run the same script with the new Excel and a new effective_date. The `_latest` views automatically pick up the newest data.

### Step 3: Add Denial Code Tracking to Appeals

Added `carc_codes TEXT[]` and `rarc_codes TEXT[]` columns to the `appeals` table. When an appeal letter is generated, the denial codes involved are stored on the record.

### Step 4: Migrate Denial Patterns to Supabase

Created `denial_patterns` table (12 rows) and `appeal_levels` table (5 rows) in Supabase. These were previously hardcoded arrays in `denial-patterns.ts`. The `denial_patterns` table stores: reason, category, reason_codes, common_cpts, common_diagnoses, appeal_strategy, documentation_checklist, estimated_success_rate, and appeal_deadline_days.

The function `getAppealStrategyForCARC()` in `denial-patterns.ts` now calls the Supabase RPC `get_denial_pattern_for_carc` instead of looping over an in-memory array.

### Step 5: Tool — `lookup_denial_code`

A tool Claude calls when a patient mentions a denial code.

**What it does**:
1. Patient says "my EOB says code CO-50" or "the letter mentions N362"
2. Claude calls `lookup_denial_code({ code: "50" })`
3. Tool queries `carc_codes_latest` in Supabase
4. Tool calls `getAppealStrategyForCARC()`, which queries `denial_patterns_latest` via RPC
5. Returns: official description + plain English translation + linked appeal strategy
6. Claude explains it to the patient in simple terms

**Search options**:
- By exact code: "CO-50", "50", "N362"
- By description text: "not medically necessary"
- By EOB code: "0201" (traces through the mapping table to find the CARC + RARC)

### Step 6: Tool — `get_common_denials`

A tool Claude calls proactively after giving coverage guidance to warn about common denial reasons.

**What it does**:
1. After Claude finishes explaining coverage requirements for (e.g.) a lumbar MRI
2. Claude calls `get_common_denials({ procedure_description: "lumbar MRI" })`
3. Tool calls `getDenialPatternsForCPT()`, which queries Supabase via RPC `get_denial_patterns_for_cpt`
4. Enriches results with CARC plain English descriptions from `carc_codes_latest`
5. Returns top 3 denial reasons with prevention tips
6. If no CPT-specific patterns match, falls back to querying `denial_patterns_latest` for the top 3 by category (Medical Necessity, Documentation, Coding)

### Step 7: Appeal Skill Prompt

Added an `APPEAL_SKILL` section to the skills system that loads when a user enters the appeal flow.

**What it tells Claude to do**:
1. Ask if the patient has their denial letter or EOB
2. Ask for the denial code (e.g., "There's usually a code like CO-50 on the letter")
3. Look up the code and explain it in plain English
4. Share the appeal strategy and success rate
5. Proceed to gather info for the appeal letter

### Step 8: Track Denial Codes in Session

Added `denialCodes: string[]` to the conversation session state so Claude remembers which codes were discussed throughout the conversation.

---

## Data Flow

### Flow 1: `lookup_denial_code` Tool

**Direction**: Claude → `tools/index.ts` → Supabase (all queries)

1. Tool receives a code, description search, or EOB code
2. If EOB code: queries `eob_denial_mappings_latest` → gets CARC + RARC codes
3. If CARC code: queries `carc_codes_latest` for description/category/plain English
4. Calls `getAppealStrategyForCARC()` which calls Supabase RPC `get_denial_pattern_for_carc` → returns appeal strategy, checklist, success rate, deadline from `denial_patterns_latest`
5. Returns combined result to Claude

**When it fires**:
- Patient says "my claim was denied, code CO-50"
- Patient says "the letter says adjustment reason 16"
- Patient reads an EOB code like "0201"

### Flow 2: `get_common_denials` Tool

**Direction**: Claude → `tools/index.ts` → Supabase (all queries)

1. Tool receives a procedure description and/or CPT code
2. Calls `getDenialPatternsForCPT()` which calls Supabase RPC `get_denial_patterns_for_cpt` → returns denial patterns where the CPT appears in `common_cpts`
3. For each pattern, queries `carc_codes_latest` for plain English descriptions
4. Returns top denial reasons with CARC codes, plain English, prevention tips, success rates

**When it fires**:
- After coverage guidance is delivered (proactive warning)
- When a patient asks "what could go wrong with my claim?"

### Flow 3: Appeal Letter Generator → Session State

**Direction**: Session state → `generate_appeal_letter` tool

When generating the final appeal letter, the tool has access to the specific CARC/RARC codes from the session. It includes the code meaning in the letter and tailors the appeal arguments to the specific denial reason.

### Flow 4: Appeals Table → Learning System

**Direction**: Appeal outcome → `appeals.carc_codes` column → future analysis

When an appeal is generated, the CARC/RARC codes involved are stored on the `appeals` record. When the patient later reports the outcome (won/lost), we can correlate which CARC codes have the best appeal success rates.

---

## Use Cases

### Use Case 1: Patient Gets a Denial Letter

Mary, 72, had her lumbar MRI denied. She has the denial letter in hand.

1. Mary opens Denali: "My MRI was denied, can you help me appeal?"
2. Claude detects appeal intent, loads the APPEAL_SKILL
3. Claude: "I'm sorry to hear that. Do you have your denial letter handy? There's usually a reason code on it — something like CO-50 or a number."
4. Mary: "It says adjustment reason 50"
5. Claude calls `lookup_denial_code({ code: "50" })`
   - Supabase `carc_codes_latest` returns: CARC 50 = "Non-covered services because this is not deemed a medical necessity"
   - Supabase `denial_patterns_latest` (via RPC) returns: appeal strategy + documentation checklist + "high" success rate
6. Claude: "That code means Medicare is saying the MRI wasn't medically necessary. Appeals for this reason succeed about 40% of the time at the first level, and up to 70% if it goes to a hearing. Here's what we need to make a strong case..."
7. Claude walks Mary through gathering documentation, then generates a targeted appeal letter

**Without this feature**: Claude would have to guess from "MRI denied" and give generic appeal advice.

---

### Use Case 2: Proactive Denial Prevention During Coverage Guidance

James, 68, wants to know if Medicare will cover his knee replacement.

1. James goes through the normal coverage flow: symptoms, duration, treatments tried, provider
2. Claude delivers coverage guidance with a checklist
3. Claude calls `get_common_denials({ procedure_description: "knee replacement", cpt_code: "27447" })`
   - Returns top denial reasons: CARC 50 (not medically necessary), CARC 15 (missing prior auth), CARC 167 (diagnosis mismatch)
4. Claude: "One more thing — the most common reason knee replacements get denied is 'not medically necessary.' To prevent that, make sure your doctor documents that you've tried physical therapy for at least 6 weeks, your specific functional limitations, and that non-surgical options have been exhausted."
5. James goes to his appointment prepared. His doctor documents everything. The claim goes through.

**Without this feature**: James might miss the documentation details that prevent denials.

---

### Use Case 3: Patient Has an EOB Code They Don't Understand

Linda, 75, got an Explanation of Benefits in the mail with a code she doesn't understand.

1. Linda: "I got a paper from Medicare with code 0201, what does that mean?"
2. Claude calls `lookup_denial_code({ eob_code: "0201" })`
   - Traces through `eob_denial_mappings_latest`: EOB 0201 → CARC 16 + RARC N280
   - CARC 16 = "Claim/service lacks information or has submission/billing error(s)"
   - RARC N280 = "Missing/incomplete/invalid pay-to provider primary identifier"
3. Claude: "That code means there was a billing error — specifically, your provider's billing information was missing or incorrect. This usually isn't something you caused. Your doctor's billing office needs to resubmit the claim with the correct provider information."
4. Linda knows it's not her problem to solve, just needs to call her doctor's office.

**Without this feature**: Linda would be confused by the EOB and might not know what action to take.

---

## Updating Data

**When CMS publishes new CARC/RARC codes**:
1. Run the Excel-to-SQL conversion script with the new file and a new `effective_date`
2. Insert new rows into `carc_codes`, `rarc_codes`, `eob_denial_mappings`
3. The `_latest` views automatically return the newest data
4. No code deploy needed

**When denial patterns or appeal strategies need updating**:
1. Insert new rows into `denial_patterns` with a new `effective_date`
2. Or update existing rows' `is_active` flag to deactivate outdated patterns
3. The `denial_patterns_latest` view automatically returns active rows from the newest effective_date
4. No code deploy needed

**When CMS updates appeal level thresholds** (annual):
1. Insert new rows into `appeal_levels` with a new `effective_date` and updated descriptions/thresholds
2. Update `MEDICARE_CONSTANTS` in `app/src/config/ui.ts` for the annual ALJ/Federal Court thresholds (these are used in UI calculations and remain in config)
