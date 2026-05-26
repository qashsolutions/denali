# Chunk 07: Pricing, Stripe & Plan Gating

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 16 (8 positive + 8 negative)**
**Prerequisites**: Chunks 02-03 passed. Stripe must be in test mode.
**Accounts**: `ramanac+d@gmail.com` (fresh trial), `ramanac@gmail.com` (admin), `ramanac+g@gmail.com` (rate limit tests)
**Clean state**: Fresh sign-in for each account

---

## Positive Tests

### 7.P1 — Trial plan active (14 days)
**Steps**: Sign in as `ramanac+d@gmail.com` (new user). GET `/api/profile`.
**Expected**: `plan: "trial"`, trial window = 14 days from signup.
**Log**: Plan value, trial expiry date.

### 7.P2 — Trial daily rate limit (10 messages)
**Steps**: As trial user, send 10 chat messages sequentially (simple questions like "What is Medicare Part A?", "What is Part B?", etc.). Wait for each response before sending next.
**Expected**: All 10 messages succeed (HTTP 200, SSE stream received).
**Log**: Count of successful messages (should be 10).

### 7.P3 — Trial upload limit (2MB)
**Steps**: As trial user, attach a ~1.5MB image file to a chat message and send.
**Expected**: Accepted — message sent with attachment.
**Log**: HTTP status, whether attachment was processed.

### 7.P4 — Checkout session creation
**Steps**: `curl -X POST BASE_URL/api/checkout -H "Content-Type: application/json" -d '{"plan":"starter"}' -b "cookies"`
**Expected**: HTTP 200. Response includes a Stripe checkout session URL.
**Log**: HTTP status, whether URL is present (do NOT log full URL).

### 7.P5 — PaywallModal triggers on upgrade
**Steps**: In browser as trial user, find and click any "Upgrade" button or trigger an action that requires a paid plan (like trying to use appeal credits).
**Expected**: PaywallModal opens showing plan options (Starter, Plus, Unlimited).
**Log**: Modal appeared yes/no, plans shown.

### 7.P6 — Admin bypasses all rate limits
**Steps**: Sign in as `ramanac@gmail.com` (admin). Send 15+ chat messages rapidly.
**Expected**: All succeed — no 429 errors. Admin bypasses daily and weekly limits.
**Log**: Count of messages sent, all succeeded yes/no.

### 7.P7 — Admin bypasses appeal paywall
**Steps**: As admin, in chat trigger an appeal: "I need to appeal a denied claim for CPT 99213 with diagnosis E11.65, denied with reason CO-4."
**Expected**: Appeal letter generation proceeds — no PaywallModal, no credit check.
**Log**: Appeal generation started yes/no, no paywall triggered.

### 7.P8 — Profile returns correct plan data
**Steps**: `curl -s BASE_URL/api/profile -b "cookies"` (as any signed-in user).
**Expected**: JSON with: plan, role, is_admin, appeal credits (or equivalent fields).
**Log**: All fields present, their values.

---

## Negative Tests

### 7.N1 — Trial exceeded — 11th message blocked
**Steps**: After sending 10 messages in 7.P2 (same day), send an 11th message.
**Expected**: HTTP 429 with error code `RATE_LIMITED`.
**Log**: HTTP status, error code.

### 7.N2 — Trial upload too large (>2MB)
**Steps**: As trial user, attach a ~3MB file and send.
**Expected**: HTTP 413 — exceeds plan upload limit (2MB for trial).
**Log**: HTTP status, error message.

### 7.N3 — Expired trial blocks all chat
**Steps**: If possible, manually expire `ramanac+d@gmail.com`'s trial (via AWS CLI / direct DB update), or use a pre-expired account. Then send a chat message.
**Expected**: HTTP 403 with `TRIAL_EXPIRED`. Zero messages allowed.
**Log**: HTTP status, error code.

### 7.N4 — Checkout without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/checkout -H "Content-Type: application/json" -d '{"plan":"starter"}'`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 7.N5 — Checkout with invalid plan name
**Steps**: `curl -X POST BASE_URL/api/checkout -H "Content-Type: application/json" -d '{"plan":"fake_plan_xyz"}' -b "cookies"`
**Expected**: HTTP 400 or validation error.
**Log**: HTTP status, error message.

### 7.N6 — Stripe webhook without valid signature
**Steps**: `curl -X POST BASE_URL/api/webhooks/stripe -H "Content-Type: application/json" -d '{"type":"checkout.session.completed"}'`
**Expected**: Rejected — no valid Stripe signature header. Non-200.
**Log**: HTTP status, error.

### 7.N7 — Stripe webhook with wrong secret
**Steps**: `curl -X POST BASE_URL/api/webhooks/stripe -H "Content-Type: application/json" -H "stripe-signature: t=123,v1=fakesig" -d '{"type":"checkout.session.completed"}'`
**Expected**: Rejected — signature verification fails.
**Log**: HTTP status, error.

### 7.N8 — Weekly frequency limit (Trial = 1 day/week)
**Steps**: As `ramanac+g@gmail.com` (trial), send a message today (should succeed). Then check if the weekly limit blocks a second day of usage. (If testing on same day, this may not trigger — try manipulating `chat_daily_usage` via DB if possible.)
**Expected**: If on different day within same week and already used 1 day: HTTP 429 `WEEKLY_LIMIT`.
**Log**: HTTP status, error code. Mark BLOCKED if cannot test across days.

---

## End of Chunk 07

**You must now**: Write `results/chunk-07-results.md` with every test result, then report summary to user and STOP.
