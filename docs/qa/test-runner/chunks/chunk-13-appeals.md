# Chunk 13: Appeal Letters & Outcome Tracking

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 16 (10 positive + 6 negative)**
**Prerequisites**: Chunks 08-09 passed (chat + tools working)
**Account**: `ramanac@gmail.com` (admin — bypasses paywall)
**Clean state**: Sign in fresh

---

## Positive Tests

### 13.P1 — Trigger appeal letter generation via chat
**Steps**: New conversation. Send: "I received a denial for an office visit (CPT 99213) with diagnosis type 2 diabetes (E11.65). The denial reason was CO-4. I need to appeal this denial. My doctor is Dr. Smith."
**Expected**: Claude gathers information through conversation, eventually triggers `generate_appeal_letter` tool.
**Log**: Tool triggered yes/no, conversation turns before trigger.

### 13.P2 — Appeal letter content quality
**Steps**: After letter generation in 13.P1, review the letter content.
**Expected**: Letter includes: ICD-10 codes (E11.65), CPT codes (99213), policy references (LCD/NCD if applicable), PubMed citations, proper formatting (MEDICARE APPEAL REQUEST header through Sincerely closing).
**Log**: Each element present yes/no.

### 13.P3 — AppealLetterModal opens
**Steps**: After letter generation, check if modal/display component appears.
**Expected**: AppealLetterModal displays the formatted letter with `extractLetterContent()`.
**Log**: Modal appeared yes/no, letter visible.

### 13.P4 — PDF download of appeal letter
**Steps**: In AppealLetterModal, click download/print button.
**Expected**: jsPDF generates a downloadable PDF. File downloads successfully.
**Log**: Download triggered yes/no, file received.

### 13.P5 — Appeals list API
**Steps**: Get conversationId from 13.P1. `curl -s "BASE_URL/api/appeals?conversationId=[ID]" -b "cookies"`
**Expected**: HTTP 200. Returns appeal record(s) for this conversation.
**Log**: HTTP status, appeal count, appeal ID.

### 13.P6 — Deadline banner in appeal UI
**Steps**: Check the appeal display for deadline information.
**Expected**: Deadline banner present. Color: amber (>30 days remaining), red (<=30 days), or gray (expired).
**Log**: Banner visible yes/no, color, days remaining shown.

### 13.P7 — Record appeal outcome
**Steps**: `curl -X POST BASE_URL/api/appeal-outcome -H "Content-Type: application/json" -d '{"appealId":"[ID_FROM_13P5]","outcome":"approved"}' -b "cookies"`
**Expected**: HTTP 200. Outcome recorded.
**Log**: HTTP status, response.

### 13.P8 — Outcome incentive grants free credit
**Steps**: After recording outcome in 13.P7, check profile: `curl -s BASE_URL/api/profile -b "cookies"`
**Expected**: `applyOutcomeIncentive()` should have granted 1 free appeal credit (may not apply to admin — log actual behavior).
**Log**: Credits before and after outcome report.

### 13.P9 — APPEAL_GENERATED audit log
**Steps**: `curl -s BASE_URL/api/audit-log -b "cookies"`. Look for appeal-related entries.
**Expected**: `APPEAL_GENERATED` audit entry present.
**Log**: Entry found yes/no, timestamp.

### 13.P10 — Outcome report via token (no auth)
**Steps**: If an outcome followup email was sent with a token link, use that token. Otherwise: `curl -X POST BASE_URL/api/outcome-report -H "Content-Type: application/json" -d '{"token":"[TOKEN]","outcome":"approved"}'`
**Expected**: Outcome submitted without auth (token-based).
**Log**: HTTP status, outcome recorded. (Mark BLOCKED if no token available.)

---

## Negative Tests

### 13.N1 — Appeal without credits triggers paywall
**Steps**: Sign in as `ramanac+c@gmail.com` (trial user, 0 credits). In chat, try to trigger appeal generation.
**Expected**: `AppealGate` shows PaywallModal before generating letter.
**Log**: Paywall triggered yes/no.

### 13.N2 — Appeals API without auth
**Steps**: Clear cookies. `curl -s -o /dev/null -w "%{http_code}" "BASE_URL/api/appeals?conversationId=test"`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 13.N3 — Appeal outcome without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/appeal-outcome -H "Content-Type: application/json" -d '{"appealId":"test","outcome":"approved"}'`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 13.N4 — Outcome report with invalid token
**Steps**: `curl -X POST BASE_URL/api/outcome-report -H "Content-Type: application/json" -d '{"token":"fake-invalid-token","outcome":"approved"}'`
**Expected**: Rejected — invalid token. Non-200.
**Log**: HTTP status, error.

### 13.N5 — Trial user appeal blocked (0 credits)
**Steps**: As trial user, verify `checkAppealAccess()` returns "paywall" status.
**Expected**: Access status = "paywall" (0 credits on trial).
**Log**: Access status returned.

### 13.N6 — Outcome report with missing fields
**Steps**: `curl -X POST BASE_URL/api/outcome-report -H "Content-Type: application/json" -d '{"token":"[VALID_TOKEN]"}'`
**Expected**: HTTP 400 — missing outcome field.
**Log**: HTTP status, error. (Mark BLOCKED if no valid token available.)

---

## End of Chunk 13

**You must now**: Write `results/chunk-13-results.md` with every test result, then report summary to user and STOP.
