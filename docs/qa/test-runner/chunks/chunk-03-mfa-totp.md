# Chunk 03: MFA / TOTP Enrollment & Challenge

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 14 (7 positive + 7 negative)**
**Prerequisites**: Chunk 02 passed (auth working). Admin `ramanac@gmail.com` has MFA enabled.
**Accounts**: `ramanac@gmail.com` (admin, MFA on), `ramanac+b@gmail.com` (for enrollment tests)
**Clean state**: Clear cookies but keep Chunk 02 knowledge of working auth flow

---

## Positive Tests

### 3.P1 — MFA status check (enrolled user)
**Steps**: Sign in as `ramanac@gmail.com` (full OTP + MFA flow from Chunk 02). Then: `curl -s BASE_URL/api/auth/mfa/status -b "cookies"`
**Expected**: Response shows `enrolled: true` (or equivalent).
**Log**: HTTP status, enrolled value.

### 3.P2 — MFA challenge completes successfully
**Steps**: This was partially done in 2.P10. Verify that after OTP verify + TOTP challenge for `ramanac@gmail.com`, all authenticated APIs work.
Call: `curl -s BASE_URL/api/profile -b "cookies"`
**Expected**: Full profile returned with `is_admin: true`. Session fully established post-MFA.
**Log**: HTTP status, admin flag, plan.

### 3.P3 — Enroll new user in MFA
**Steps**:
1. Sign in as `ramanac+b@gmail.com` (send OTP, ask user for code, verify).
2. Call: `curl -X POST BASE_URL/api/auth/mfa/enroll -b "cookies"`
**Expected**: Returns TOTP secret (base32 string) and/or QR provisioning URI (otpauth://...).
**Log**: HTTP status, whether secret and URI are present (do NOT log the actual secret).

### 3.P4 — Confirm MFA enrollment
**Steps**: Ask user to add the TOTP secret from 3.P3 to their authenticator app and provide a current TOTP code. Then: `curl -X POST BASE_URL/api/auth/mfa/confirm -H "Content-Type: application/json" -d '{"code":"USER_TOTP_CODE"}' -b "cookies"`
**Expected**: HTTP 200. Enrollment confirmed.
**Log**: HTTP status, confirmation message.

### 3.P5 — MFA gate on chat page (non-admin)
**Steps**: Sign in as `ramanac+b@gmail.com` with OTP only (do NOT complete TOTP challenge if prompted). Navigate to `BASE_URL/app/chat` in browser.
**Expected**: `MFARequiredGate` component is displayed — user cannot access chat without completing MFA.
**Log**: Whether MFA gate is visible, what message it shows.

### 3.P6 — Admin bypasses MFA gate
**Steps**: Sign in as `ramanac@gmail.com` (admin). Navigate to `BASE_URL/app/chat`.
**Expected**: No MFA gate blocking. Chat page loads normally (admin bypass).
**Log**: Whether chat page loads without MFA gate.

### 3.P7 — Unenroll MFA
**Steps**: Sign in as `ramanac+b@gmail.com` (complete full MFA challenge first). Then: `curl -X POST BASE_URL/api/auth/mfa/unenroll -b "cookies"`
**Expected**: MFA removed. `GET /api/auth/mfa/status` now returns `enrolled: false`.
**Log**: Unenroll HTTP status, subsequent status check result.

---

## Negative Tests

### 3.N1 — Wrong TOTP code
**Steps**: Sign in as `ramanac@gmail.com` (OTP verified). Submit wrong TOTP: `curl -X POST BASE_URL/api/auth/mfa/challenge -H "Content-Type: application/json" -d '{"code":"000000"}' -b "cookies"`
**Expected**: Rejection — invalid code. Non-200.
**Log**: HTTP status, error message.

### 3.N2 — Expired TOTP code
**Steps**: Ask user for a TOTP code, then wait 60+ seconds before submitting it.
**Expected**: Rejection — code expired or out of window.
**Log**: HTTP status, error message. (Note: TOTP typically allows ±1 window, so this may still pass — log actual behavior.)

### 3.N3 — Confirm enrollment with wrong code
**Steps**: If `ramanac+b@gmail.com` is mid-enrollment (after 3.P3 but before confirming), submit wrong code: `curl -X POST BASE_URL/api/auth/mfa/confirm -d '{"code":"999999"}' -b "cookies"`
**Expected**: Enrollment NOT confirmed. Error response.
**Log**: HTTP status, enrollment still pending.

### 3.N4 — Enroll without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/auth/mfa/enroll`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 3.N5 — Double enrollment attempt
**Steps**: Sign in as `ramanac@gmail.com` (already enrolled). Call: `curl -X POST BASE_URL/api/auth/mfa/enroll -b "cookies"`
**Expected**: Error or no-op — already enrolled. Should not create a second TOTP secret.
**Log**: HTTP status, response message.

### 3.N6 — Unenroll without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/auth/mfa/unenroll`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 3.N7 — Challenge without enrollment
**Steps**: Sign in as `ramanac+b@gmail.com` (after unenrolling in 3.P7). Call: `curl -X POST BASE_URL/api/auth/mfa/challenge -d '{"code":"123456"}' -b "cookies"`
**Expected**: Error — user not enrolled in MFA.
**Log**: HTTP status, error message.

---

## End of Chunk 03

**STATUS: COMPLETED** — 2026-03-10
**Results**: 12 passed, 2 failed, 0 blocked out of 14
**Results file**: `results/chunk-03-results.md`

**You must now**: Write `results/chunk-03-results.md` with every test result, then report summary to user and STOP.
