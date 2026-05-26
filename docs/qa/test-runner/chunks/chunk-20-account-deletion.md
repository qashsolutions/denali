# Chunk 20: Account Deletion (DESTRUCTIVE — Run Last)

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 8 (6 positive + 2 negative)**
**Prerequisites**: ALL other chunks completed. Create a fresh throwaway account for deletion.
**Account**: `ramanac+e@gmail.com` (throwaway — will be permanently deleted)
**⚠️ WARNING**: This chunk permanently deletes data. Only use the designated throwaway account.
**Clean state**: Fresh sign-in for throwaway account

---

## Setup

Before starting tests, create the throwaway account:
1. Send OTP to `ramanac+e@gmail.com` → verify → auto-trial activated
2. Send a chat message (creates conversation + messages)
3. Submit a diabetes log entry (creates diabetes data)
4. Enable consent toggles (creates consent records)
5. This gives the account data in multiple tables to verify cascade deletion

---

## Positive Tests

### 20.P1 — Deletion UI shows 2-step confirmation
**Steps**: Sign in as `ramanac+e@gmail.com`. Navigate to `BASE_URL/app/settings` → Danger Zone. Click "Delete Account".
**Expected**: First confirmation step appears (e.g., "Are you sure?" dialog with consequences listed).
**Log**: First step visible yes/no, confirmation content.

### 20.P2 — Complete deletion
**Steps**: Confirm the first step. Complete the second confirmation step (may require typing "DELETE" or similar).
**Expected**: `DELETE /api/account/delete` executes. User receives success confirmation.
**Log**: HTTP status from deletion, confirmation message.

### 20.P3 — 12-step cascade completes
**Steps**: After deletion, verify via AWS CLI / DB access that all user data is removed:
- `health_reports` — no rows for this user
- `fhir_cache` — no rows
- `ehr_connections` — no rows
- `diabetes_snapshots`, `diabetes_log`, `diabetes_insights` — no rows
- `alert_log`, `alert_preferences` — no rows
- `chat_daily_usage` — no rows
- `consent_preferences` — no rows
- `user_feedback` — no rows
- `messages` — no rows for user's conversations
- `appeals` — no rows
- `conversations` — no rows
- `usage` — no rows
- `subscriptions` — no rows (Stripe subscription cancelled if any)
- `user_events` — no rows
- `user_verification` — no rows
- `users` — no row
**Expected**: All tables cleared for this user. Zero rows remaining.
**Log**: Per-table check results. (Mark BLOCKED per table if DB access unavailable — log which tables couldn't be verified.)

### 20.P4 — Cognito user deleted
**Steps**: `aws cognito-idp admin-get-user --user-pool-id [POOL_ID] --username ramanac+e@gmail.com`
**Expected**: Error — user not found (UserNotFoundException).
**Log**: User found or not found.

### 20.P5 — Audit logs survive deletion
**Steps**: Query audit_logs table for the deleted user's ID:
`SELECT count(*) FROM audit_logs WHERE user_id = '[DELETED_USER_ID]'`
Or via AWS CLI.
**Expected**: Audit records still present (HIPAA 6-year retention). Count > 0.
**Log**: Audit log count for deleted user. (Mark BLOCKED if DB access unavailable.)

### 20.P6 — Post-deletion redirect
**Steps**: After deletion, check browser state.
**Expected**: User redirected to `/` (landing page). Signed out. Cookies cleared.
**Log**: Final URL, signed out yes/no.

---

## Negative Tests

### 20.N1 — Admin self-delete blocked
**Steps**: Sign in as `ramanac@gmail.com` (admin). Navigate to Settings → Danger Zone. Attempt to delete account.
**Expected**: HTTP 403. Error message: admin accounts cannot be deleted (or delete button is disabled/hidden).
**Log**: 403 received yes/no, UI behavior (button hidden vs error on click).

### 20.N2 — Delete without auth
**Steps**: Clear cookies. `curl -X DELETE BASE_URL/api/account/delete`
**Expected**: HTTP 401.
**Log**: HTTP status.

---

## End of Chunk 20

**You must now**: Write `results/chunk-20-results.md` with every test result, then report summary to user and STOP.

---

## End of All Chunks

After Chunk 20, produce a final summary:
```
# FINAL TEST RESULTS SUMMARY

| Chunk | Passed | Failed | Blocked | Total |
|-------|--------|--------|---------|-------|
| 01    |        |        |         | 22    |
| 02    |        |        |         | 18    |
...
| 20    |        |        |         | 8     |
| TOTAL |        |        |         | 310   |
```
