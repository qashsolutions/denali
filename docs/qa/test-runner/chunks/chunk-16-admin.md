# Chunk 16: Admin Features

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 12 (7 positive + 5 negative)**
**Prerequisites**: Chunk 02 passed
**Accounts**: `ramanac@gmail.com` (admin), `ramanac+a@gmail.com` (non-admin)
**Clean state**: Sign in as admin first

---

## Positive Tests

### 16.P1 — Admin CMS page loads
**Steps**: Sign in as `ramanac@gmail.com`. Navigate to `BASE_URL/admin/content`.
**Expected**: CMS content management interface renders. Can see/edit content.
**Log**: Page loaded yes/no, content visible.

### 16.P2 — GET CMS content API
**Steps**: `curl -s BASE_URL/api/admin/cms -b "cookies"`
**Expected**: HTTP 200. Returns CMS content data (JSON).
**Log**: HTTP status, top-level keys.

### 16.P3 — PATCH CMS content API
**Steps**: `curl -X PATCH BASE_URL/api/admin/cms -H "Content-Type: application/json" -d '{"key":"hero_heading","value":"Test Heading Update"}' -b "cookies"`
**Expected**: HTTP 200. Content updated. (Note: revert after test if this modifies production content.)
**Log**: HTTP status, response. Remember to note if revert is needed.

### 16.P4 — Policy change email (dry run)
**Steps**: `curl -X POST BASE_URL/api/admin/email/policy-change -H "Content-Type: application/json" -d '{"dryRun":true,"subject":"Test Policy Change","body":"This is a test."}' -b "cookies"`
**Expected**: HTTP 200. Returns preview + recipient count. No actual emails sent.
**Log**: HTTP status, recipient count, preview present.

### 16.P5 — Policy change email (real send)
**Steps**: `curl -X POST BASE_URL/api/admin/email/policy-change -H "Content-Type: application/json" -d '{"dryRun":false,"subject":"Test Policy Change","body":"This is a test notification."}' -b "cookies"`
**Expected**: HTTP 200. Emails sent to all users. Audit-logged. Ask user: "Did you receive a policy change email?"
**Log**: HTTP status, email confirmed. (WARNING: This sends to ALL users. Consider dry-run only if there are real users.)

### 16.P6 — Admin bypasses rate limits (verification)
**Steps**: As admin, rapidly send 5 chat messages within 30 seconds.
**Expected**: All succeed with no 429 errors.
**Log**: All 5 succeeded yes/no.

### 16.P7 — Admin cannot self-delete
**Steps**: As `ramanac@gmail.com`, navigate to Settings → Danger Zone. Attempt to delete account.
**Expected**: HTTP 403. Admin accounts blocked from self-deletion.
**Log**: 403 received yes/no, error message.

---

## Negative Tests

### 16.N1 — Non-admin access to /admin/content
**Steps**: Sign in as `ramanac+a@gmail.com` (non-admin). Navigate to `BASE_URL/admin/content`.
**Expected**: HTTP 403 or redirect to non-admin page.
**Log**: HTTP status or redirect behavior.

### 16.N2 — Non-admin CMS API access
**Steps**: As `ramanac+a@gmail.com`: `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/admin/cms -b "cookies"`
**Expected**: HTTP 403.
**Log**: HTTP status.

### 16.N3 — Non-admin policy email
**Steps**: As `ramanac+a@gmail.com`: `curl -X POST BASE_URL/api/admin/email/policy-change -H "Content-Type: application/json" -d '{"dryRun":true,"subject":"test","body":"test"}' -b "cookies"`
**Expected**: HTTP 403.
**Log**: HTTP status.

### 16.N4 — Admin CMS without auth
**Steps**: Clear cookies. `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/admin/cms`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 16.N5 — Admin email without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/admin/email/policy-change -H "Content-Type: application/json" -d '{"dryRun":true,"subject":"test","body":"test"}'`
**Expected**: HTTP 401.
**Log**: HTTP status.

---

## End of Chunk 16

**You must now**: Write `results/chunk-16-results.md` with every test result, then report summary to user and STOP.
