# Chunk 02: Authentication — Email OTP Flow

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 18 (10 positive + 8 negative)**
**Prerequisites**: Chunk 01 passed (app is up and pages load)
**Account**: `ramanac+a@gmail.com` (fresh), `ramanac@gmail.com` (admin w/ MFA)
**Clean state**: Clear all cookies and storage before starting

---

## Positive Tests

### 2.P1 — Send OTP to valid email
**Steps**: `curl -X POST BASE_URL/api/auth/send-otp -H "Content-Type: application/json" -d '{"email":"ramanac+a@gmail.com"}'`
**Expected**: HTTP 200. User receives OTP email. Ask user: "OTP needed for ramanac+a@gmail.com. Please check email and provide the code."
**Log**: HTTP status, whether OTP was requested from user.

### 2.P2 — Verify OTP successfully
**Steps**: Using the OTP code provided by user, call: `curl -X POST BASE_URL/api/auth/verify-otp -H "Content-Type: application/json" -d '{"email":"ramanac+a@gmail.com","otp":"USER_CODE"}'` — capture cookies from response.
**Expected**: HTTP 200. Response sets `access_token` and `refresh_token` as httpOnly cookies.
**Log**: HTTP status, cookie names present in Set-Cookie headers.

### 2.P3 — Auto-trial on first signup
**Steps**: Using cookies from 2.P2, call: `curl -s BASE_URL/api/profile -b "cookies_from_2P2"`
**Expected**: Response JSON has `plan: "trial"` with a 14-day expiry window.
**Log**: Plan value, trial expiry date.

### 2.P4 — Usage record created
**Steps**: Check profile response from 2.P3 for usage/credits data.
**Expected**: Usage record exists with 0 appeal credits.
**Log**: Credits value.

### 2.P5 — Signed-in user redirected from /
**Steps**: In browser with valid cookies, navigate to `BASE_URL/`
**Expected**: Automatically redirects to `/app` (dashboard).
**Log**: Final URL.

### 2.P6 — Dashboard loads post-auth
**Steps**: Navigate to `BASE_URL/app` with valid session.
**Expected**: Dashboard renders with: 5 feature cards, hero greeting (may include user's name), nudges, and walkthrough elements.
**Log**: Count of feature cards visible, greeting text.

### 2.P7 — Sign out works
**Steps**: Call `curl -X POST BASE_URL/api/auth/signout -b "cookies"` — then try accessing `/api/profile` with same cookies.
**Expected**: Signout returns 200. Cookies cleared. Subsequent `/api/profile` call returns 401 or empty.
**Log**: Signout HTTP status, post-signout profile status.

### 2.P8 — Token refresh works
**Steps**: After signing in, manually expire/clear the `access_token` cookie but keep `refresh_token`. Then call: `curl -X POST BASE_URL/api/auth/refresh -b "refresh_token=VALUE"`
**Expected**: New `access_token` issued. Subsequent API calls work.
**Log**: Refresh HTTP status, new access_token present.

### 2.P9 — OTP code in email subject line
**Steps**: Ask user to check the email received in 2.P1.
**Expected**: The OTP code is visible in the email SUBJECT LINE (for notification banner visibility). Ask user: "Is the OTP code visible in the email subject line? (yes/no)"
**Log**: User's confirmation.

### 2.P10 — Sign in with admin account (MFA flow)
**Steps**:
1. Send OTP: `curl -X POST BASE_URL/api/auth/send-otp -d '{"email":"ramanac@gmail.com"}'`
2. Ask user for OTP code.
3. Verify OTP.
4. Since MFA is enabled, a TOTP challenge will be required. Ask user for TOTP code.
5. Complete MFA challenge via `/api/auth/mfa/challenge`.
6. Call `/api/profile`.
**Expected**: Profile shows `is_admin: true`. Full session established.
**Log**: Each step's HTTP status, final profile admin status.

---

## Negative Tests

### 2.N1 — Invalid OTP code
**Steps**: `curl -X POST BASE_URL/api/auth/verify-otp -H "Content-Type: application/json" -d '{"email":"ramanac+a@gmail.com","otp":"000000"}'`
**Expected**: Non-200 response (401 or 400). No cookies set.
**Log**: HTTP status, response body.

### 2.N2 — Expired OTP code
**Steps**: Send a new OTP to `ramanac+a@gmail.com`. Wait for the OTP to expire (typically 5-10 minutes — ask user to provide the code after waiting, or use the code from 2.P1 if enough time has passed). Attempt to verify.
**Expected**: Rejection — code expired. Non-200 response.
**Log**: HTTP status, error message.

### 2.N3 — Empty email in send-otp
**Steps**: `curl -X POST BASE_URL/api/auth/send-otp -H "Content-Type: application/json" -d '{}'`
**Expected**: HTTP 400 Bad Request.
**Log**: HTTP status, error message.

### 2.N4 — Malformed email
**Steps**: `curl -X POST BASE_URL/api/auth/send-otp -H "Content-Type: application/json" -d '{"email":"notanemail"}'`
**Expected**: HTTP 400 or validation error.
**Log**: HTTP status, error message.

### 2.N5 — Replay OTP code
**Steps**: Using the same OTP code that was already successfully verified in 2.P2, try to verify again: `curl -X POST BASE_URL/api/auth/verify-otp -d '{"email":"ramanac+a@gmail.com","otp":"ALREADY_USED_CODE"}'`
**Expected**: Rejected — code already consumed. Non-200 response.
**Log**: HTTP status, error message.

### 2.N6 — Access protected route without auth
**Steps**: Clear all cookies. `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/profile`
**Expected**: HTTP 401 (AUTH_REQUIRED) or empty response.
**Log**: HTTP status.

### 2.N7 — Tampered access_token
**Steps**: `curl -s BASE_URL/api/profile -b "access_token=garbage_token_abc123"`
**Expected**: HTTP 401 or silent refresh attempt that fails (no valid refresh_token).
**Log**: HTTP status, response.

### 2.N8 — Sign out with no session
**Steps**: Clear all cookies. `curl -X POST BASE_URL/api/auth/signout`
**Expected**: HTTP 200 (idempotent no-op) or graceful response. No 500 error.
**Log**: HTTP status.

---

## End of Chunk 02

**STATUS: COMPLETED** — 2026-03-10
**Results**: 18 passed, 0 failed, 0 blocked out of 18
**Results file**: `results/chunk-02-results.md`

**You must now**: Write `results/chunk-02-results.md` with every test result, then report summary to user and STOP.
