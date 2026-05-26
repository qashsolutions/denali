# Chunk 05: Settings & Preferences

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 20 (13 positive + 7 negative)**
**Prerequisites**: Chunks 02-03 passed (auth working)
**Accounts**: `ramanac@gmail.com` (admin), `ramanac+c@gmail.com` (trial user)
**Clean state**: Sign in fresh at start

---

## Positive Tests

### 5.P1 — Settings page loads with 10 sections
**Steps**: Sign in as `ramanac@gmail.com`. Navigate to `BASE_URL/app/settings`.
**Expected**: All 10 sections visible: Account, Subscription, Appearance, Accessibility, Content Preferences, Email Alerts, Privacy & Data, Data Access History, Danger Zone, Reset to Defaults.
**Log**: List each section found by name.

### 5.P2 — Theme toggle — dark mode
**Steps**: In Appearance section, select dark mode.
**Expected**: UI switches to dark theme immediately. Reload page — theme persists.
**Log**: Theme changed yes/no, persisted after reload yes/no.

### 5.P3 — Theme toggle — light mode
**Steps**: In Appearance section, select light mode.
**Expected**: UI switches to light theme.
**Log**: Theme changed yes/no.

### 5.P4 — Theme toggle — system
**Steps**: In Appearance section, select system.
**Expected**: Theme follows OS/browser preference.
**Log**: Theme option selected, visual result.

### 5.P5 — Text size — small
**Steps**: In Accessibility section, set text size to small.
**Expected**: Text renders noticeably smaller across the page.
**Log**: Visual change observed yes/no.

### 5.P6 — Text size — medium
**Steps**: Set text size to medium.
**Expected**: Default/medium text size applied.
**Log**: Visual change observed.

### 5.P7 — Text size — large
**Steps**: Set text size to large.
**Expected**: Text renders noticeably larger.
**Log**: Visual change observed yes/no.

### 5.P8 — Topic preferences — select 2 topics
**Steps**: In Content Preferences section, toggle ON `diabetes` and `obesity`.
**Expected**: Both saved. Verify: `curl -s BASE_URL/api/preferences/topics -b "cookies"` returns both topics.
**Log**: API response with topic list.

### 5.P9 — Topic preferences — max 2 enforced
**Steps**: With `diabetes` and `obesity` already selected, try to also select `medicare-general`.
**Expected**: 3rd topic is blocked (toggle doesn't activate) OR it deselects one of the previous two. Max 2 enforced.
**Log**: What happened when 3rd topic was attempted.

### 5.P10 — Subscription section shows admin status
**Steps**: Check Subscription section as `ramanac@gmail.com` (admin).
**Expected**: Shows "Admin / Unlimited access" or equivalent admin badge.
**Log**: Subscription text displayed.

### 5.P11 — Subscription shows trial for new user
**Steps**: Sign in as `ramanac+c@gmail.com` (trial user). Navigate to Settings → Subscription.
**Expected**: Shows Trial plan with days remaining (out of 14).
**Log**: Plan name, days remaining shown.

### 5.P12 — Reset to defaults
**Steps**: Set theme to dark, text size to large, then click "Reset to Defaults".
**Expected**: Theme → system, text size → medium. Consent toggles → all OFF.
**Log**: Each value after reset.

### 5.P13 — Admin badge in AppHeader
**Steps**: As `ramanac@gmail.com`, check the AppHeader (top navigation bar). Click profile/avatar if needed to see popover.
**Expected**: "Admin" badge visible in header popover.
**Log**: Badge text found.

---

## Negative Tests

### 5.N1 — Topic preferences API without auth
**Steps**: Clear cookies. `curl -X PUT BASE_URL/api/preferences/topics -H "Content-Type: application/json" -d '{"topics":["diabetes"]}'`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 5.N2 — Content Preferences section hidden when unauthenticated
**Steps**: Navigate to `BASE_URL/app/settings` without signing in (or check if redirected).
**Expected**: Content Preferences section is hidden, disabled, or user is redirected to login.
**Log**: Section visibility or redirect behavior.

### 5.N3 — Invalid topic value via API
**Steps**: `curl -X PUT BASE_URL/api/preferences/topics -H "Content-Type: application/json" -d '{"topics":["invalid_topic_xyz"]}' -b "cookies"`
**Expected**: HTTP 400 or validation error.
**Log**: HTTP status, error message.

### 5.N4 — More than 2 topics via API
**Steps**: `curl -X PUT BASE_URL/api/preferences/topics -H "Content-Type: application/json" -d '{"topics":["diabetes","obesity","medicare-general"]}' -b "cookies"`
**Expected**: Rejected (400) or truncated to 2 topics.
**Log**: HTTP status, response body.

### 5.N5 — Audit log API without auth
**Steps**: Clear cookies. `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/audit-log`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 5.N6 — Data Access History hidden when unauthenticated
**Steps**: Access Settings without auth. Check for Data Access History section.
**Expected**: Section hidden or page redirects.
**Log**: Section visibility.

### 5.N7 — Danger Zone hidden when unauthenticated
**Steps**: Access Settings without auth. Check for Danger Zone section.
**Expected**: Section hidden or page redirects.
**Log**: Section visibility.

---

## End of Chunk 05

**You must now**: Write `results/chunk-05-results.md` with every test result, then report summary to user and STOP.
