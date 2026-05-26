# Chunk 15: Email Alerts System

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 14 (9 positive + 5 negative)**
**Prerequisites**: Chunks 07, 10 passed (paid plan or admin + BB connected)
**Accounts**: `ramanac@gmail.com` (admin — all alert types), `ramanac+c@gmail.com` (trial — no alerts)
**Note**: Alert processing requires `X-Alert-Secret` header. Get the value from AWS Secrets Manager or env config.
**Clean state**: Sign in as admin

---

## Positive Tests

### 15.P1 — Alert preferences load
**Steps**: `curl -s BASE_URL/api/alerts/preferences -b "cookies"` (as admin)
**Expected**: HTTP 200. Returns 4 alert types: `appeal_deadline`, `med_refill`, `new_denial`, `data_refresh` with eligibility status for each.
**Log**: HTTP status, alert types listed, eligibility per type.

### 15.P2 — Toggle alert preference OFF
**Steps**: `curl -X PUT BASE_URL/api/alerts/preferences -H "Content-Type: application/json" -d '{"alertType":"med_refill","enabled":false}' -b "cookies"`
**Expected**: HTTP 200. Preference updated. GET confirms `med_refill` is disabled.
**Log**: PUT status, GET verification.

### 15.P3 — Toggle alert preference back ON
**Steps**: `curl -X PUT BASE_URL/api/alerts/preferences -H "Content-Type: application/json" -d '{"alertType":"med_refill","enabled":true}' -b "cookies"`
**Expected**: HTTP 200. Preference re-enabled.
**Log**: PUT status, GET verification.

### 15.P4 — Alert processing dry run
**Steps**: Get `X-Alert-Secret` value (from env/secrets). Then:
`curl -X POST BASE_URL/api/alerts/process -H "Content-Type: application/json" -H "X-Alert-Secret: [SECRET_VALUE]" -d '{"dryRun":true}'`
**Expected**: HTTP 200. Returns what would be sent — user counts, alert types, but no actual emails.
**Log**: HTTP status, dry run output (user count, alert summary).

### 15.P5 — Alert processing real execution
**Steps**: `curl -X POST BASE_URL/api/alerts/process -H "Content-Type: application/json" -H "X-Alert-Secret: [SECRET_VALUE]" -d '{"dryRun":false}'`
**Expected**: HTTP 200. Processes eligible users. Sends emails via Resend. Ask user: "Did you receive any alert emails?"
**Log**: HTTP status, processing result, email received confirmation.

### 15.P6 — Alert deduplication
**Steps**: Run alert processing again (same as 15.P5).
**Expected**: Same alerts NOT re-sent (dedup via `alert_log` table). Lower or zero alert count.
**Log**: Alert count on second run vs first.

### 15.P7 — Safety cap — max 3 alerts per user per day
**Steps**: If possible, trigger conditions for 4+ alerts (multiple denial types, med refills, etc.). Run processing.
**Expected**: Maximum 3 alerts sent per user. 4th alert blocked by safety cap.
**Log**: Alert count per user. (Mark BLOCKED if cannot trigger 4+ alert conditions.)

### 15.P8 — Settings UI shows all 4 types for admin
**Steps**: In browser as admin, navigate to Settings → Email Alerts section.
**Expected**: All 4 alert types visible with active toggle switches (not locked).
**Log**: Types visible, all toggleable yes/no.

### 15.P9 — Alert preference change audit logged
**Steps**: Toggle a preference in Settings. Check audit log.
**Expected**: `ALERT_PREFERENCE_UPDATED` audit entry present.
**Log**: Audit entry found yes/no.

---

## Negative Tests

### 15.N1 — Alert processing without X-Alert-Secret
**Steps**: `curl -X POST BASE_URL/api/alerts/process -H "Content-Type: application/json" -d '{"dryRun":true}'`
**Expected**: Rejected — missing secret header. Non-200.
**Log**: HTTP status, error.

### 15.N2 — Alert processing with wrong secret
**Steps**: `curl -X POST BASE_URL/api/alerts/process -H "Content-Type: application/json" -H "X-Alert-Secret: wrong-secret-value" -d '{"dryRun":true}'`
**Expected**: Rejected — invalid secret. Non-200.
**Log**: HTTP status, error.

### 15.N3 — Trial user sees locked alert types
**Steps**: Sign in as `ramanac+c@gmail.com` (trial). Navigate to Settings → Email Alerts.
**Expected**: All alert types show locked/disabled state with badges: "Available on Plus" or "Available on Unlimited". Upgrade CTA at bottom.
**Log**: Lock state per type, badge text, upgrade CTA visible.

### 15.N4 — Alert preferences API without auth
**Steps**: Clear cookies. `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/alerts/preferences`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 15.N5 — PUT alert preference without auth
**Steps**: Clear cookies. `curl -X PUT BASE_URL/api/alerts/preferences -H "Content-Type: application/json" -d '{"alertType":"med_refill","enabled":false}'`
**Expected**: HTTP 401.
**Log**: HTTP status.

---

## End of Chunk 15

**You must now**: Write `results/chunk-15-results.md` with every test result, then report summary to user and STOP.
