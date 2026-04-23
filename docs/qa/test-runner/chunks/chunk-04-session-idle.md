# Chunk 04: Session Management & HIPAA Idle Timeout

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 10 (6 positive + 4 negative)**
**Prerequisites**: Chunk 02 passed (auth working)
**Account**: `ramanac+a@gmail.com`
**Clean state**: Fresh sign-in at start

---

## Positive Tests

### 4.P1 — Session cookie set with timestamp
**Steps**: Sign in as `ramanac+a@gmail.com`. Inspect cookies in browser.
**Expected**: `session_issued_at` cookie exists with a recent timestamp. Session is valid for 7 days from this timestamp.
**Log**: Cookie name, timestamp value.

### 4.P2 — Idle warning at 27 minutes
**Steps**: Sign in, then do NOT interact with the page. Monitor for idle timeout warning. (Option: use browser console to fast-forward the idle timer if accessible, or manipulate `useIdleTimeout` state. If not possible, set a timer and wait, or check if the warning component exists in DOM.)
**Expected**: Warning dialog appears at 27 minutes with a "Stay signed in" button.
**Log**: Whether warning appeared (or if timer was accelerated, how it was tested). Mark BLOCKED if 27-min real wait is impractical and timer cannot be manipulated.

### 4.P3 — "Stay signed in" resets timer
**Steps**: When warning dialog appears (from 4.P2), click "Stay signed in".
**Expected**: Warning dismissed. Timer resets. User remains on page.
**Log**: Warning dismissed yes/no, page still accessible.

### 4.P4 — Auto sign-out at 30 minutes
**Steps**: Let idle timer reach 30 minutes without interaction (or accelerate timer).
**Expected**: `POST /api/auth/idle-lock` fires automatically. `access_token` cleared. `refresh_token` kept. User redirected or shown session-expired state.
**Log**: Whether idle-lock fired, cookie state after. Mark BLOCKED if timer cannot be tested.

### 4.P5 — Activity events reset timer
**Steps**: During idle countdown, trigger mouse movement or keypress.
**Expected**: Timer resets. No warning or logout.
**Log**: Timer reset observed yes/no.

### 4.P6 — Session expired page exists
**Steps**: Navigate to `BASE_URL/app/session-expired`
**Expected**: Page renders with session expired message and sign-in option.
**Log**: Page content summary.

---

## Negative Tests

### 4.N1 — Expired 7-day session rejected
**Steps**: Sign in, then manually set `session_issued_at` cookie to a date 8 days in the past (via browser console or curl). Make an authenticated request to `/api/profile`.
**Expected**: Session rejected. Must re-authenticate. Non-200 or redirect.
**Log**: HTTP status, behavior observed.

### 4.N2 — Idle-lock without auth
**Steps**: Clear all cookies. `curl -X POST BASE_URL/api/auth/idle-lock`
**Expected**: HTTP 401 or graceful no-op (not 500).
**Log**: HTTP status.

### 4.N3 — Access API after idle-lock
**Steps**: Sign in, then call idle-lock: `curl -X POST BASE_URL/api/auth/idle-lock -b "cookies"`. Then try: `curl -X POST BASE_URL/api/chat -b "same_cookies_minus_access_token" -d '{"message":"test"}'`
**Expected**: HTTP 401 AUTH_REQUIRED (access_token was cleared).
**Log**: HTTP status.

### 4.N4 — Refresh token survives idle-lock
**Steps**: After idle-lock from 4.N3, attempt token refresh: `curl -X POST BASE_URL/api/auth/refresh -b "refresh_token=VALUE"`
**Expected**: New access_token issued. Session recoverable.
**Log**: HTTP status, new access_token present.

---

## End of Chunk 04

**You must now**: Write `results/chunk-04-results.md` with every test result, then report summary to user and STOP.
