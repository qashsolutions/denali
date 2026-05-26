# Chunk 18: API Security & XSS Prevention

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 16 (4 positive + 12 negative)**
**Prerequisites**: Chunk 02 passed (for auth context)
**Account**: `ramanac@gmail.com` for authenticated tests
**Clean state**: Start unauthenticated, then sign in for positive tests

---

## Positive Tests

### 18.P1 — Health check is publicly accessible
**Steps**: `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/health`
**Expected**: HTTP 200.
**Log**: HTTP status.

### 18.P2 — CMS metadata is publicly accessible
**Steps**: `curl -s BASE_URL/api/cms-metadata`
**Expected**: HTTP 200 with valid JSON metadata.
**Log**: HTTP status, response keys.

### 18.P3 — Authenticated API returns profile
**Steps**: Sign in as `ramanac@gmail.com`. `curl -s BASE_URL/api/profile -b "cookies"`
**Expected**: HTTP 200 with profile JSON.
**Log**: HTTP status, profile fields present.

### 18.P4 — FHIR tokens encrypted at rest
**Steps**: Via AWS CLI, query the `ehr_connections` table for any connected user:
`aws rds-data execute-statement --resource-arn [RDS_ARN] --secret-arn [SECRET_ARN] --database denali --sql "SELECT fhir_access_token FROM ehr_connections LIMIT 1"`
Or use psql via jump host if available.
**Expected**: Token values are encrypted (base64 blob with AES-256-GCM format), NOT plaintext.
**Log**: Token appears encrypted yes/no. (Mark BLOCKED if DB access not available.)

---

## Negative Tests

### 18.N1 — Unauthenticated /api/profile
**Steps**: Clear cookies. `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/profile`
**Expected**: HTTP 401 or empty response.
**Log**: HTTP status.

### 18.N2 — Unauthenticated /api/conversations
**Steps**: `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/conversations`
**Expected**: HTTP 401 or empty.
**Log**: HTTP status.

### 18.N3 — Unauthenticated /api/fhir/data
**Steps**: `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/fhir/data`
**Expected**: HTTP 401 or empty.
**Log**: HTTP status.

### 18.N4 — Unauthenticated /api/chat
**Steps**: `curl -X POST BASE_URL/api/chat -H "Content-Type: application/json" -d '{"message":"test"}'`
**Expected**: HTTP 401 AUTH_REQUIRED.
**Log**: HTTP status, error code.

### 18.N5 — Unauthenticated /api/diabetes/log
**Steps**: `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/diabetes/log`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 18.N6 — XSS — script tag in chat
**Steps**: Sign in. Send chat message: `<script>alert('xss')</script>`
**Expected**: Rendered as plain text in UI. Script NOT executed. No alert dialog appears.
**Log**: Rendered as text yes/no, script executed yes/no.

### 18.N7 — XSS — onerror attribute
**Steps**: Send chat message: `<img src=x onerror=alert(1)>`
**Expected**: Sanitized. Image tag does not trigger JavaScript. No alert dialog.
**Log**: Sanitized yes/no, alert triggered yes/no.

### 18.N8 — XSS — onmouseover
**Steps**: Send chat message: `<div onmouseover=alert(1)>hover me</div>`
**Expected**: Sanitized. Event handler stripped. Hovering does not trigger alert.
**Log**: Sanitized yes/no.

### 18.N9 — XSS — javascript: URI
**Steps**: Send chat message: `<a href="javascript:alert(1)">click me</a>`
**Expected**: Sanitized. `href` stripped or neutralized. Clicking does NOT execute JavaScript.
**Log**: Link sanitized yes/no.

### 18.N10 — SQL injection in chat
**Steps**: Send chat message: `'; DROP TABLE users; --`
**Expected**: No database error. Chat responds normally (Claude treats it as text). No data loss.
**Log**: Normal response received yes/no, no error.

### 18.N11 — Path traversal in API
**Steps**: `curl -s -o /dev/null -w "%{http_code}" "BASE_URL/api/conversations/../../../etc/passwd"`
**Expected**: HTTP 404 or sanitized/blocked. Does NOT return system files.
**Log**: HTTP status, no file content leaked.

### 18.N12 — CORS headers present
**Steps**: `curl -sI BASE_URL/api/health`. Check for CORS headers.
**Expected**: Appropriate CORS headers set (e.g., `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`).
**Log**: CORS headers found, values.

---

## End of Chunk 18

**You must now**: Write `results/chunk-18-results.md` with every test result, then report summary to user and STOP.
