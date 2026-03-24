# Denali Health — E2E Test Plan

> Comprehensive test inventory for browser-based E2E testing (Playwright + Chromium).
> Each test is tagged **[+]** (positive/happy path) or **[-]** (negative/failure/rejection).
> Reference: `memory/e2e-testing.md` for mock patterns and selectors.

---

## 1. Public Pages

### 1.1 Landing Page (`/`)

| # | Type | Test | Assert |
|---|------|------|--------|
| 1.1.1 | [+] | Hero section renders with heading and CTA | Heading "Tailored guidance" visible, "Try It Free" button visible |
| 1.1.2 | [+] | Features section shows 3 health cards | Pre-Diabetes, Diabetes, Obesity cards visible |
| 1.1.3 | [+] | Conditions section renders 3 rows | Pre-Diabetes, Diabetes, Obesity text + images |
| 1.1.4 | [+] | How-it-works shows 3 steps | Steps 01/02/03 visible with labels |
| 1.1.5 | [+] | Pricing shows 4 tiers with correct prices | Free Trial, Starter ($10), Plus ($20), Unlimited ($60) |
| 1.1.6 | [+] | Pricing features are truthful | "10 messages per day" visible, "Priority coverage guidance" NOT visible |
| 1.1.7 | [+] | Plus plan has "Most Popular" badge | Badge visible on Plus card |
| 1.1.8 | [+] | Testimonials section renders | Quotes visible with star ratings |
| 1.1.9 | [+] | Footer has legal links | FAQ, Privacy, Terms, HIPAA links present |
| 1.1.10 | [+] | Footer has HIPAA/CMS disclaimer | "not endorsed or certified by CMS" text visible |
| 1.1.11 | [+] | CTA buttons link correctly | "Try It Free" navigates to `/app/chat` |
| 1.1.12 | [-] | No hardcoded user data | No "Good morning, Venkata" or fake data visible |

### 1.2 Legal Pages

| # | Type | Test | Assert |
|---|------|------|--------|
| 1.2.1 | [+] | FAQ renders with search bar and sections | "Frequently Asked Questions" heading, search input, 9 section headings |
| 1.2.2 | [+] | FAQ search filters questions | Type "trial" → relevant Q&A visible, irrelevant hidden |
| 1.2.3 | [+] | FAQ accordion opens/closes | Click question → answer expands, click again → collapses |
| 1.2.4 | [+] | Terms page renders with TOC | "Terms of Service" heading, "Contents" nav, 15 sections |
| 1.2.5 | [+] | Privacy page renders | "Privacy Policy" heading visible |
| 1.2.6 | [+] | HIPAA page renders | HIPAA notice heading visible |
| 1.2.7 | [+] | Legal pages have cross-nav links | Each page links to the 3 other legal pages |
| 1.2.8 | [-] | Legal pages render without auth | No redirect, no error for anonymous visitors |

### 1.3 Blog

| # | Type | Test | Assert |
|---|------|------|--------|
| 1.3.1 | [+] | Blog listing page renders | Posts visible (or "no posts" state if DB empty) |
| 1.3.2 | [+] | Blog category tabs work | Click tab → filtered posts shown |
| 1.3.3 | [-] | Blog handles missing posts gracefully | `/blog/nonexistent-slug` → 404 or not-found page |

### 1.4 Health Report Share

| # | Type | Test | Assert |
|---|------|------|--------|
| 1.4.1 | [+] | Valid share token renders report (mock) | Mock `/api/health-report/share/[token]` → 12-section report visible |
| 1.4.2 | [-] | Invalid share token shows error | Mock 404 → error message, not crash |
| 1.4.3 | [-] | Expired share token shows expiry message | Mock 410 → "expired" message |
| 1.4.4 | [+] | Report share page has no auth requirement | Page renders without any profile mock |

### 1.5 Offline Page

| # | Type | Test | Assert |
|---|------|------|--------|
| 1.5.1 | [+] | Offline page renders | `/offline` shows offline message with links |

---

## 2. Authentication

### 2.1 Auth UI

| # | Type | Test | Assert |
|---|------|------|--------|
| 2.1.1 | [+] | Landing page shows "Sign In" button when unauthenticated | Header has Sign In link |
| 2.1.2 | [+] | Authenticated user sees gear icon in header | Mock auth → gear icon visible, no "Sign In" |
| 2.1.3 | [+] | Account popover shows plan label | Mock starter user → popover shows "Starter" |
| 2.1.4 | [+] | Admin user sees "Admin" badge | Mock admin → "Admin" badge in popover |

### 2.2 Auth API Access Control

| # | Type | Test | Assert |
|---|------|------|--------|
| 2.2.1 | [-] | GET /api/trial without auth → 401 | Status 401, error "Not authenticated" |
| 2.2.2 | [-] | POST /api/trial without auth → 401 | Status 401 |
| 2.2.3 | [-] | GET /api/consent without auth → 401 | Status 401, error "Not authenticated" |
| 2.2.4 | [-] | PUT /api/consent without auth → 401 | Status 401 |
| 2.2.5 | [-] | GET /api/diabetes/log without auth → 401 | Status 401 |
| 2.2.6 | [-] | POST /api/diabetes/log without auth → 401 | Status 401 |
| 2.2.7 | [-] | DELETE /api/diabetes/log without auth → 401 | Status 401 |
| 2.2.8 | [-] | GET /api/audit-log without auth → 401 | Status 401 |
| 2.2.9 | [-] | GET /api/fhir/data without auth → 401 | Status 401 |
| 2.2.10 | [-] | POST /api/fhir/disconnect without auth → 401 | Status 401 |
| 2.2.11 | [-] | GET /api/health-report without auth → 401 | Status 401 |
| 2.2.12 | [-] | POST /api/health-report/generate without auth → 401 | Status 401 |
| 2.2.13 | [-] | POST /api/health-report/email without auth → 401 | Status 401 |
| 2.2.14 | [-] | GET /api/diabetes/snapshots without auth → 401 | Status 401 |
| 2.2.15 | [-] | GET /api/diabetes/insights without auth → 401 | Status 401 |
| 2.2.16 | [-] | POST /api/appeal-outcome without auth → 401 | Status 401 |
| 2.2.17 | [-] | DELETE /api/account/delete without auth → 401 | Status 401 |
| 2.2.18 | [-] | GET /api/preferences/topics without auth → 401 | Status 401 |
| 2.2.19 | [-] | PUT /api/preferences/topics without auth → 401 | Status 401 |

### 2.3 Auth Redirects (Middleware)

| # | Type | Test | Assert |
|---|------|------|--------|
| 2.3.1 | [+] | Anonymous on `/app` redirects to `/` | Navigate to `/app`, end up on `/` |
| 2.3.2 | [+] | Anonymous on `/app/chat` redirects to `/` | Navigate, redirected |
| 2.3.3 | [+] | Anonymous on `/app/health` redirects to `/` | Navigate, redirected |
| 2.3.4 | [+] | Anonymous on `/app/settings` stays (settings is "Optional" auth) | Page renders |
| 2.3.5 | [-] | Anonymous cannot access `/app/admin/content` | Redirect or 403 |

### 2.4 Profile Endpoint Data Leakage

| # | Type | Test | Assert |
|---|------|------|--------|
| 2.4.1 | [-] | GET /api/profile without auth → no plan/role/admin leaked | Response has `authenticated: false`, no `plan`, `role`, `is_admin`, `appeal_credits` |
| 2.4.2 | [-] | GET /api/conversations without auth → empty list | `authenticated: false`, `conversations: []` |

---

## 3. Chat

### 3.1 Chat UI — Authenticated

| # | Type | Test | Assert |
|---|------|------|--------|
| 3.1.1 | [+] | Empty state shows 6 suggestion cards | Check Coverage, Appeal a Denial, Understand My Bill, Preventive Care, Diabetes Care, Weight Management |
| 3.1.2 | [+] | Empty state shows personalized greeting | Mock email "alice@example.com" → greeting contains "Alice" |
| 3.1.3 | [+] | Chat input is visible and enabled | Placeholder "Ask about Medicare, coverage, or health..." visible |
| 3.1.4 | [+] | CMS pledge badge visible above input | CmsPledge component rendered |
| 3.1.5 | [+] | Send message → response renders | Mock SSE → user bubble + assistant bubble visible |
| 3.1.6 | [+] | Response includes suggestion buttons | Mock SSE with suggestions → pills visible below input |
| 3.1.7 | [+] | Click suggestion card sends message | Click "Check Coverage" → message sent (mock SSE fires) |
| 3.1.8 | [+] | Click suggestion pill populates input | Click pill → input gets suggestion text |
| 3.1.9 | [+] | Loading state shows pulsing indicator | Send message → loading dots visible before SSE completes |
| 3.1.10 | [+] | Feedback buttons appear on assistant messages | Thumbs up/down visible on assistant bubble |
| 3.1.11 | [+] | ?message= auto-sends on load | Navigate with `?message=test` → message sent automatically |
| 3.1.12 | [+] | ?topic=diabetes auto-sends diabetes question | Navigate with `?topic=diabetes` → diabetes message sent |
| 3.1.13 | [+] | Payment success toast appears | Navigate with `?payment=success` → green toast visible |
| 3.1.14 | [+] | "Upgrade" message opens paywall modal | Type "upgrade" → PaywallModal appears |
| 3.1.15 | [+] | "Sign up" message redirects to settings | Type "sign up" → navigates to `/app/settings` |
| 3.1.16 | [+] | Mobile sidebar toggle visible on mobile viewport | Set viewport 375px → hamburger button visible |

### 3.2 Chat UI — Unauthenticated

| # | Type | Test | Assert |
|---|------|------|--------|
| 3.2.1 | [-] | Unauthenticated user sees sign-up prompt | "Sign up for a free trial" text + "Sign up free" button visible |
| 3.2.2 | [-] | Chat input NOT visible for unauth user | Placeholder input not in DOM |
| 3.2.3 | [-] | Sign up button navigates to settings | Click "Sign up free" → navigates to `/app/settings` |
| 3.2.4 | [-] | Empty state cards still visible for unauth | 6 cards visible (browsable but can't send) |

### 3.3 Chat — Health Context Bridge

| # | Type | Test | Assert |
|---|------|------|--------|
| 3.3.1 | [+] | BB connected + consent ON → no consent banner | Mock FHIR data + consent ON → no banner |
| 3.3.2 | [-] | BB connected + consent OFF → consent banner visible | Mock connected + consent OFF → "Medicare data is connected but not shared" banner |
| 3.3.3 | [+] | Consent banner links to Settings | Click "Enable in Settings" → navigates to `/app/settings` |
| 3.3.4 | [+] | ?message= waits for health data before sending | Mock healthLoading → message NOT sent until loading finishes |

### 3.4 Chat — Offline

| # | Type | Test | Assert |
|---|------|------|--------|
| 3.4.1 | [-] | Chat input disabled when offline | Simulate offline → input disabled, placeholder changes to "Chat requires an internet connection" |

### 3.5 Chat — Rate Limiting & Errors

| # | Type | Test | Assert |
|---|------|------|--------|
| 3.5.1 | [-] | Chat API returns 429 → error shown | Mock 429 response → rate limit message in chat |
| 3.5.2 | [-] | Chat API returns 403 TRIAL_EXPIRED → error shown | Mock 403 → trial expired message |
| 3.5.3 | [-] | Chat API returns 401 → auth required | Mock 401 → auth error message |
| 3.5.4 | [-] | Chat API returns 500 → generic error | Mock 500 → error message, not crash |

### 3.6 Chat — XSS Prevention

| # | Type | Test | Assert |
|---|------|------|--------|
| 3.6.1 | [-] | Script tag in ?message= does not execute | `?message=<script>xss=true</script>` → `window.xssTriggered` stays false |
| 3.6.2 | [-] | Img onerror in SSE response does not execute | Mock SSE with `<img onerror>` → no XSS triggered |
| 3.6.3 | [-] | Script in SSE table cell does not execute | Mock SSE with `| <script> |` table → no XSS |

---

## 4. Settings

### 4.1 Consent Toggles

| # | Type | Test | Assert |
|---|------|------|--------|
| 4.1.1 | [+] | Three consent switches render | `getByRole("switch")` count = 3 |
| 4.1.2 | [+] | Toggles reflect GET /api/consent state | Mock some ON → aria-checked="true" on those |
| 4.1.3 | [+] | Click toggle sends PUT with correct payload | Click health_data_ai → PUT `{ consentType: "health_data_ai", granted: true }` |
| 4.1.4 | [+] | Analytics toggle sends correct payload | Click analytics → PUT `{ consentType: "analytics", granted: true }` |
| 4.1.5 | [+] | Toggle OFF sends granted=false | Start ON, click → PUT `{ granted: false }` |
| 4.1.6 | [+] | Optimistic update: toggle reflects immediately | Click → aria-checked flips before API responds |
| 4.1.7 | [-] | Toggle reverts on API 500 | Mock PUT 500 → toggle reverts to original state |
| 4.1.8 | [-] | PUT /api/consent rejects invalid type | PUT `{ consentType: "invalid" }` → 401 (auth first) or 400 |

### 4.2 Appearance

| # | Type | Test | Assert |
|---|------|------|--------|
| 4.2.1 | [+] | Theme selector renders (Light/Dark/Auto) | 3 theme options visible |
| 4.2.2 | [+] | Selecting Dark theme applies dark class | Click Dark → body/html gets dark attributes |

### 4.3 Accessibility

| # | Type | Test | Assert |
|---|------|------|--------|
| 4.3.1 | [+] | Text scale slider renders | Slider or buttons for text size visible |
| 4.3.2 | [+] | Changing text scale updates CSS variable | Change scale → `--text-scale` CSS var updates |

### 4.4 Topic Preferences

| # | Type | Test | Assert |
|---|------|------|--------|
| 4.4.1 | [+] | Topic selection renders | Diabetes, Obesity, Medicare-general options visible |
| 4.4.2 | [+] | Select topic sends PUT | Click topic → PUT /api/preferences/topics with correct payload |
| 4.4.3 | [-] | Max 2 topics enforced | Select 2 → third option disabled or rejected |

### 4.5 Account Management

| # | Type | Test | Assert |
|---|------|------|--------|
| 4.5.1 | [+] | Subscription section shows current plan | Mock "starter" → "Starter" label visible |
| 4.5.2 | [+] | Upgrade button visible for non-unlimited plans | Mock trial → "Upgrade" button present |
| 4.5.3 | [+] | Admin sees "Admin / Unlimited access" | Mock admin → no upgrade button, admin label |
| 4.5.4 | [+] | Delete account 2-step confirmation works | Click delete → confirm prompt → final confirm |
| 4.5.5 | [-] | Delete blocked for admin user | Mock admin → delete returns 403 or UI prevents it |
| 4.5.6 | [+] | Activity log / Data access history section renders | "Data Access History" heading visible |

---

## 5. Health Hub (`/app/health`)

### 5.1 Connected State

| # | Type | Test | Assert |
|---|------|------|--------|
| 5.1.1 | [+] | 7 accordion cards render when connected | Mock FHIR data → all card titles visible |
| 5.1.2 | [+] | Needs Attention card auto-expanded if issues exist | Mock denied claims → card expanded with red dot |
| 5.1.3 | [+] | Click card header toggles expansion | Click Coverage → content toggles |
| 5.1.4 | [+] | Multiple cards can be open simultaneously | Open 2 cards → both expanded |
| 5.1.5 | [+] | Status dots reflect computed severity | Mock overdue screening → amber dot on relevant card |
| 5.1.6 | [+] | Conditions list shows severity colors | Mock diabetes condition → red border/dot |
| 5.1.7 | [+] | "Ask Denali →" links visible on red/amber conditions | Mock diabetes → "Ask Denali" link present |
| 5.1.8 | [+] | "Ask Denali →" link navigates to chat with message | Click link → `/app/chat?message=...` |
| 5.1.9 | [+] | Coverage cards show Part A/B/C status | Mock active coverage → correct labels |
| 5.1.10 | [+] | Blue Button attribution visible | "not endorsed or certified by CMS" text present |
| 5.1.11 | [+] | Health report banner shown when report ready | Mock report ready → banner/link visible |

### 5.2 Disconnected State

| # | Type | Test | Assert |
|---|------|------|--------|
| 5.2.1 | [+] | Connect Medicare prompt visible | "Connect" button/card visible |
| 5.2.2 | [-] | No health data cards when disconnected | Accordion cards not shown or show empty state |

### 5.3 Conditions Severity

| # | Type | Test | Assert |
|---|------|------|--------|
| 5.3.1 | [+] | "Type 2 diabetes" → red severity | Red border-l and red dot |
| 5.3.2 | [+] | "Hypertension" → amber severity | Amber border-l and amber dot |
| 5.3.3 | [+] | "Routine checkup" → gray severity | Gray/default styling |
| 5.3.4 | [+] | Gray conditions do NOT show "Ask Denali" link | Only red/amber get the CTA |
| 5.3.5 | [-] | Garbage entries filtered out | Numeric-only or <3 char conditions not shown |
| 5.3.6 | [+] | U+25CC dotted circle cleaned from names | Mock name with \u25CC → displayed without artifact |

---

## 6. Diabetes Dashboard (`/app/diabetes`)

### 6.1 With Data

| # | Type | Test | Assert |
|---|------|------|--------|
| 6.1.1 | [+] | Risk alerts render when conditions met | Mock high A1C → red alert visible |
| 6.1.2 | [+] | A1C trend chart renders | SVG sparkline or list of A1C dates |
| 6.1.3 | [+] | Screening reminders show due dates | Mock overdue screening → overdue badge visible |
| 6.1.4 | [+] | Quick log has 4 tabs | Glucose, Activity, Meal, Note tabs visible |
| 6.1.5 | [+] | Quick log: add glucose entry | Fill form → submit → entry appears in list |
| 6.1.6 | [+] | Insights card renders Claude analysis | Mock insights data → summary visible |
| 6.1.7 | [+] | "Discuss with Denali" CTA navigates to chat | Click → `/app/chat?topic=diabetes` |

### 6.2 Without Data / Errors

| # | Type | Test | Assert |
|---|------|------|--------|
| 6.2.1 | [-] | No data state shows appropriate message | No FHIR data → empty/connect prompt |
| 6.2.2 | [-] | Quick log delete entry works | Click delete → entry removed from list |
| 6.2.3 | [-] | Quick log rejects invalid glucose value | Submit empty or out-of-range → validation error |
| 6.2.4 | [-] | Insights refresh handles API error | Mock 500 → error message, no crash |

---

## 7. Dashboard Home (`/app`)

### 7.1 Authenticated

| # | Type | Test | Assert |
|---|------|------|--------|
| 7.1.1 | [+] | Time-aware greeting renders | Morning/Afternoon/Evening greeting |
| 7.1.2 | [+] | 5 feature cards render | Coverage Check, Medicare Dashboard, Diabetes Care, Weight Management, Appeals |
| 7.1.3 | [+] | Cards link to correct routes | Coverage → `/app/chat`, Health → `/app/health`, etc. |
| 7.1.4 | [+] | Walkthrough bar on first visit | WalkthroughBar visible (no sessionStorage flag set) |
| 7.1.5 | [+] | Nudge strip shows priority message | Mock nudge condition → nudge visible with CTA |
| 7.1.6 | [+] | Status badges on cards | Mock conditions → badge visible on relevant card |
| 7.1.7 | [-] | Diabetes card hidden when no diabetes context | No conditions → card not shown |
| 7.1.8 | [-] | Weight card hidden when no obesity | Mock no obesity → card not shown |

---

## 8. Payments

### 8.1 Paywall Modal

| # | Type | Test | Assert |
|---|------|------|--------|
| 8.1.1 | [+] | Paywall shows 3 plans | Starter, Plus, Unlimited cards visible |
| 8.1.2 | [+] | Plus has "Most Popular" badge | Badge visible on Plus |
| 8.1.3 | [+] | Click plan → checkout API called | Mock checkout → Stripe redirect URL returned |
| 8.1.4 | [-] | Checkout 503 → error message | Mock 503 → "Payment system not configured" |

### 8.2 Checkout API

| # | Type | Test | Assert |
|---|------|------|--------|
| 8.2.1 | [-] | POST /api/checkout without auth → 400+ | Status >= 400 |
| 8.2.2 | [-] | POST /api/checkout with plan="invalid" → 400 | Error "Invalid plan type" |
| 8.2.3 | [-] | POST /api/checkout with plan="" → 400 | Error "Invalid plan type" |
| 8.2.4 | [-] | POST /api/checkout with plan="trial" → 400 | Trial not purchasable |
| 8.2.5 | [-] | POST /api/checkout with missing plan → 400 | Error "Invalid plan type" |

### 8.3 Stripe Webhooks

| # | Type | Test | Assert |
|---|------|------|--------|
| 8.3.1 | [-] | POST /api/webhooks/stripe without secret → 400/500 | "Webhook not configured" or "Missing signature" |
| 8.3.2 | [-] | POST /api/webhooks/stripe without signature → 400+ | Error defined |

---

## 9. Navigation & Middleware

| # | Type | Test | Assert |
|---|------|------|--------|
| 9.1 | [+] | Desktop nav shows MyHealth, Ask Denali, Blog, FAQ | All 4 nav items visible at 1024px+ |
| 9.2 | [+] | Mobile nav shows hamburger menu | At 375px, hamburger visible, nav items hidden |
| 9.3 | [+] | Mobile bottom tabs show 4 items on /app/* | Home, Health, Ask Denali, Settings tabs at 375px |
| 9.4 | [+] | Bottom tabs highlight active route | On `/app/chat` → "Ask Denali" tab highlighted |
| 9.5 | [+] | Logo navigates to home | Click logo → `/` |
| 9.6 | [-] | Session expired page renders | `/app/session-expired` shows expiry message |

---

## 10. Appeals

### 10.1 Appeal Flow

| # | Type | Test | Assert |
|---|------|------|--------|
| 10.1.1 | [+] | Appeal card renders in chat | Mock SSE with appealData → appeal card visible |
| 10.1.2 | [+] | Click "View Letter" opens modal | AppealLetterModal visible with letter content |
| 10.1.3 | [+] | Appeal modal has copy/print/download buttons | Buttons visible in modal header |
| 10.1.4 | [+] | Deadline banner shows correct color | Mock <14 days → red banner |
| 10.1.5 | [+] | Outcome prompt has 3 options | Approved, Denied, Partial radio buttons |

### 10.2 Appeal Access Control

| # | Type | Test | Assert |
|---|------|------|--------|
| 10.2.1 | [-] | Trial user (0 credits) → paywall on appeal | Mock trial + 0 credits → PaywallModal shown |
| 10.2.2 | [+] | Starter user (1 credit) → appeal allowed | Mock starter + 1 credit → no paywall |
| 10.2.3 | [+] | Unlimited user → always allowed | Mock unlimited → no credit check |
| 10.2.4 | [-] | POST /api/appeal-outcome without auth → 401 | Status 401 |

---

## 11. Health Report

| # | Type | Test | Assert |
|---|------|------|--------|
| 11.1 | [+] | In-app report renders 12 sections | Mock report data → all section headings visible |
| 11.2 | [+] | Share link generation works | Mock share endpoint → URL displayed |
| 11.3 | [+] | Public share page renders without auth | `/report/[token]` with mock → report visible |
| 11.4 | [-] | GET /api/health-report without auth → 401 | Status 401 |
| 11.5 | [-] | POST /api/health-report/generate without auth → 401 | Status 401 |
| 11.6 | [-] | Invalid share token → error | Mock 404 → error page |
| 11.7 | [+] | Report email button works | Mock email endpoint → success toast |
| 11.8 | [-] | POST /api/health-report/email without auth → 401 | Status 401 |

---

## 12. PWA & Offline

| # | Type | Test | Assert |
|---|------|------|--------|
| 12.1 | [-] | Offline banner appears when offline | Simulate offline → amber banner visible |
| 12.2 | [+] | Offline banner auto-dismisses on reconnect | Go offline → banner → go online → banner gone |
| 12.3 | [-] | Chat input disabled when offline | Offline → input disabled, placeholder changes |
| 12.4 | [+] | Offline page has cached content links | `/offline` → links to health records and conversations |

---

## 13. Inactivity Timeout (HIPAA)

| # | Type | Test | Assert |
|---|------|------|--------|
| 13.1 | [+] | Warning appears at 27 min (simulate with fast clock) | Fake timers → warning banner with countdown |
| 13.2 | [+] | "Stay signed in" resets timer | Click "Stay signed in" → warning dismissed |
| 13.3 | [-] | No warning for anonymous users | Mock unauth → no timeout behavior |
| 13.4 | [-] | Expiry at 30 min triggers sign out | Fake timers → sign out called |

---

## 14. Admin

| # | Type | Test | Assert |
|---|------|------|--------|
| 14.1 | [-] | Non-admin cannot access admin routes | GET /api/admin/cms without admin → 403 |
| 14.2 | [-] | Admin cannot self-delete | Mock admin → DELETE /api/account/delete → 403 |
| 14.3 | [+] | Admin bypasses rate limits | Mock admin → chat succeeds regardless of limits |

---

## 15. Conversation History (Sidebar)

| # | Type | Test | Assert |
|---|------|------|--------|
| 15.1 | [+] | Sidebar groups conversations by date | Mock conversations → Today/Yesterday/Past Week groups |
| 15.2 | [+] | Past Month/Older groups start collapsed | Chevrons point right, content hidden |
| 15.3 | [+] | Click group header toggles expand/collapse | Click → content toggles, chevron rotates |
| 15.4 | [+] | Count badge always visible even when collapsed | Badge shows "3" on collapsed group |
| 15.5 | [+] | Click conversation loads it | Click item → navigates to `/app/chat?id=...` |
| 15.6 | [+] | New Chat button starts fresh | Click "New Chat" → empty state, new URL |
| 15.7 | [-] | Empty sidebar shows "No conversations yet" | No conversations → placeholder text |

---

## 16. API Input Validation

### 16.1 Consent Validation

| # | Type | Test | Assert |
|---|------|------|--------|
| 16.1.1 | [-] | PUT /api/consent with invalid consentType → 400 | Error about invalid type |
| 16.1.2 | [-] | PUT /api/consent with non-boolean granted → 400 | Error about invalid value |
| 16.1.3 | [-] | PUT /api/consent with missing fields → 400 | Error |

### 16.2 Checkout Validation

| # | Type | Test | Assert |
|---|------|------|--------|
| 16.2.1 | [-] | POST /api/checkout with SQL injection in plan → 400 | "Invalid plan type", no SQL error |
| 16.2.2 | [-] | POST /api/checkout with XSS in plan → 400 | Rejected safely |

### 16.3 Diabetes Log Validation

| # | Type | Test | Assert |
|---|------|------|--------|
| 16.3.1 | [-] | POST /api/diabetes/log with invalid entry_type → 400 | Validation error |
| 16.3.2 | [-] | POST /api/diabetes/log with missing fields → 400 | Required field error |

### 16.4 Events Validation

| # | Type | Test | Assert |
|---|------|------|--------|
| 16.4.1 | [-] | POST /api/events with invalid event type → 400 | Not in VALID_EVENT_TYPES allowlist |
| 16.4.2 | [+] | POST /api/events with valid event type → 200 | Event accepted |

### 16.5 Feedback Validation

| # | Type | Test | Assert |
|---|------|------|--------|
| 16.5.1 | [-] | POST /api/feedback with missing message_id → 400 | Validation error |
| 16.5.2 | [+] | POST /api/feedback with valid data → 200 | Feedback accepted |

---

## 17. Utility / Misc API

| # | Type | Test | Assert |
|---|------|------|--------|
| 17.1 | [+] | GET /api/health returns 200 | ALB health check passes |
| 17.2 | [+] | GET /api/cms-metadata returns metadata | JSON with app info |
| 17.3 | [-] | GET /api/cms-metadata is public | No auth required, returns 200 |

---

## Summary

| Category | Positive | Negative | Total |
|----------|----------|----------|-------|
| 1. Public Pages | 18 | 5 | 23 |
| 2. Authentication | 7 | 22 | 29 |
| 3. Chat | 16 | 11 | 27 |
| 4. Settings | 11 | 4 | 15 |
| 5. Health Hub | 13 | 4 | 17 |
| 6. Diabetes | 7 | 4 | 11 |
| 7. Dashboard | 6 | 2 | 8 |
| 8. Payments | 2 | 7 | 9 |
| 9. Navigation | 5 | 1 | 6 |
| 10. Appeals | 4 | 2 | 6 |
| 11. Health Report | 4 | 4 | 8 |
| 12. PWA/Offline | 2 | 2 | 4 |
| 13. Inactivity | 2 | 2 | 4 |
| 14. Admin | 1 | 2 | 3 |
| 15. Sidebar | 6 | 1 | 7 |
| 16. API Validation | 2 | 9 | 11 |
| 17. Utility | 2 | 1 | 3 |
| **TOTAL** | **108** | **83** | **191** |
