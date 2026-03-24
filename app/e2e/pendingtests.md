# Pending E2E Tests

> Gap analysis from coverage audit (2026-03-23). Tracks untested user flows.
> Tests are ordered by risk: P0 (auth/payment/data) → P1 (core UX) → P2 (nice-to-have).

## Batch 1 (Complete — 20/20)

| # | Test | Risk | Status | Spec File |
|---|------|------|--------|-----------|
| 1 | Email OTP sign-in flow | P0 | done | auth-flows.spec.ts |
| 2 | Sign-out clears auth state | P0 | done | auth-flows.spec.ts |
| 3 | Account delete fires DELETE + signs out | P0 | done | auth-flows.spec.ts |
| 4 | PaywallModal plan selection → correct POST body | P0 | done | payment-flows.spec.ts |
| 5 | AppealGate unauth → sign-up overlay | P0 | done | appeal-gate.spec.ts |
| 6 | AppealGate no credits → unlock overlay | P0 | done | appeal-gate.spec.ts |
| 7 | "Sign up free" chat button → /app/settings | P1 | done | chat-interactions.spec.ts |
| 8 | "Upgrade plan" suggestion chip → paywall | P1 | done | chat-interactions.spec.ts |
| 9 | QuickLog glucose form submission | P1 | done | quicklog.spec.ts |
| 10 | QuickLog activity/meal tab forms | P1 | done | quicklog.spec.ts |
| 11 | Sidebar click → navigate to ?id= | P1 | done | sidebar-interactions.spec.ts |
| 12 | Sidebar group collapse/expand | P1 | done | sidebar-interactions.spec.ts |
| 13 | Health disconnect calls POST | P1 | done | health-interactions.spec.ts |
| 14 | Health report "ready" banner + View link | P1 | done | health-interactions.spec.ts |
| 15 | Health page unauth redirect | P1 | done | health-interactions.spec.ts |
| 16 | PaywallModal "Processing..." loading state | P1 | done | payment-flows.spec.ts |
| 17 | Settings upgrade opens PaywallModal inline | P1 | done | payment-flows.spec.ts |
| 18 | ?payment=cancelled toast + URL cleanup | P2 | done | chat-interactions.spec.ts |
| 19 | Health OAuth error banner ?error=denied | P2 | done | health-interactions.spec.ts |
| 20 | Consent banner "Enable in Settings" navigates | P2 | done | chat-interactions.spec.ts |

## Batch 2 (Complete — 20/20)

| # | Test | Risk | Status | Spec File |
|---|------|------|--------|-----------|
| 21 | Health hub accordion expand shows card content | P0 | done | health-hub-interactions.spec.ts |
| 22 | Health hub "Needs Attention" conditional card | P0 | done | health-hub-interactions.spec.ts |
| 23 | Health hub diabetes card conditional on conditions | P0 | done | health-hub-interactions.spec.ts |
| 24 | Health hub obesity card conditional on conditions | P0 | done | health-hub-interactions.spec.ts |
| 25 | Health report "generating" spinner banner | P0 | done | health-report-interactions.spec.ts |
| 26 | Appeal card renders in chat from SSE appealLetter | P0 | done | appeal-letter.spec.ts |
| 27 | Trial expired → 403 lock message in chat | P0 | done | trial-enforcement.spec.ts |
| 28 | Weekly rate limit → 429 WEEKLY_LIMIT message | P0 | done | trial-enforcement.spec.ts |
| 29 | Chat ?id= loads existing conversation messages | P1 | done | chat-edge-cases.spec.ts |
| 30 | New Chat button resets to empty state | P1 | done | chat-edge-cases.spec.ts |
| 31 | Chat URL syncs ?id= when new conversation created | P1 | done | chat-edge-cases.spec.ts |
| 32 | Settings theme toggle (light/dark/system) | P1 | done | settings-interactions.spec.ts |
| 33 | Settings text size selector | P1 | done | settings-interactions.spec.ts |
| 34 | Settings plan display for each tier | P1 | done | settings-interactions.spec.ts |
| 35 | Landing page hero CTA navigates to /app/chat | P1 | done | landing.spec.ts |
| 36 | Landing pricing section shows 4 tiers | P1 | done | landing.spec.ts |
| 37 | Blog listing page renders posts | P1 | done | blog.spec.ts |
| 38 | Blog post page renders article | P1 | done | blog.spec.ts |
| 39 | BottomTabs mobile navigation (4 tabs) | P1 | done | mobile-nav.spec.ts |
| 40 | Dashboard home page renders cards for auth user | P1 | done | dashboard.spec.ts |

---

## Test Details

### 21. Health Hub Accordion Expand Shows Content (P0)
**What**: Click "Coverage Status" card header → expands to show CoverageCards content inside
**Where**: Health page (connected state)
**Mocks**: `mockFHIRData(true)`, `mockHealthReport()`
**Assert**: Card body appears with coverage details (Part A, Part B)

### 22. Health Hub "Needs Attention" Conditional Card (P0)
**What**: Card only appears when denied claims exist; shows denied claim count
**Where**: Health page
**Mocks**: FHIR connected with denied claims in mock data
**Assert**: "Needs Attention" card visible with correct summary text, auto-expanded

### 23. Health Hub Diabetes Card Conditional (P0)
**What**: "Diabetes Care" card only visible when diabetes conditions present in claims
**Where**: Health page
**Mocks**: FHIR connected with E11.65 condition
**Assert**: Card visible with "Diabetes Care" title; hidden when no diabetes conditions

### 24. Health Hub Obesity Card Conditional (P0)
**What**: "Weight Management" card only visible when obesity conditions or meds present
**Where**: Health page
**Mocks**: FHIR connected with E66 condition or isObesityMed=true
**Assert**: Card visible with "Weight Management" title

### 25. Health Report "Generating" Spinner Banner (P0)
**What**: When report status is "generating", spinner banner appears (not "ready" banner)
**Where**: Health page
**Mocks**: `mockHealthReport()` with `status: "generating"`
**Assert**: Spinner visible, "Generating your health summary report..." text shown

### 26. Appeal Card Renders in Chat (P0)
**What**: Chat SSE response with `appealLetter` field renders appeal card in chat
**Where**: Chat page (authenticated user with credits)
**Mocks**: Chat SSE with `appealLetter` content, auth with appeal_credits > 0
**Assert**: Appeal card or letter content visible in chat, "View Appeal Letter" button shown

### 27. Trial Expired → 403 Lock Message (P0)
**What**: Expired trial user trying to chat gets 403 TRIAL_EXPIRED with lock message
**Where**: Chat page
**Mocks**: Auth with `plan:"trial"`, `trialStatus:"expired"`, chat returns 403
**Assert**: Error message about trial ended visible, upgrade CTA

### 28. Weekly Rate Limit → 429 Message (P0)
**What**: User hitting weekly frequency limit gets 429 WEEKLY_LIMIT
**Where**: Chat page
**Mocks**: Auth with plan:"trial", chat returns 429 with code WEEKLY_LIMIT
**Assert**: Rate limit message visible

### 29. Chat ?id= Loads Existing Conversation (P1)
**What**: Navigating to /app/chat?id=conv-123 loads that conversation's messages
**Where**: Chat page
**Mocks**: `/api/conversations/conv-123` returns messages array
**Assert**: Previous messages rendered in chat

### 30. New Chat Button Resets to Empty State (P1)
**What**: Clicking "New Chat" in sidebar clears messages, shows suggestion cards
**Where**: Chat page with existing conversation loaded
**Mocks**: Conversation history + conversation messages
**Assert**: URL has no ?id=, suggestion cards visible, messages cleared

### 31. Chat URL Syncs ?id= on New Conversation (P1)
**What**: Sending first message creates conversation, URL updates to include ?id=
**Where**: Chat page (fresh, no ?id=)
**Mocks**: Chat SSE returns conversationId
**Assert**: URL updates to /app/chat?id=<conversationId>

### 32. Settings Theme Toggle (P1)
**What**: Theme selector changes CSS variables (light/dark/system)
**Where**: Settings page Appearance section
**Mocks**: Authenticated user
**Assert**: Theme class or data-theme attribute changes on document

### 33. Settings Text Size Selector (P1)
**What**: Text size option changes root font-size scale
**Where**: Settings page Accessibility section
**Mocks**: Authenticated user
**Assert**: Root element style or class reflects size choice

### 34. Settings Plan Display Per Tier (P1)
**What**: Each plan tier shows correct label and subtitle in Subscription section
**Where**: Settings page
**Mocks**: Auth with each plan type (trial/starter/plus/unlimited)
**Assert**: Correct plan name, price, limits shown

### 35. Landing Page Hero CTA → /app/chat (P1)
**What**: Primary CTA button on landing hero navigates to /app/chat
**Where**: Landing page (/)
**Mocks**: None (public page)
**Assert**: URL changes to /app/chat

### 36. Landing Pricing Section Shows 4 Tiers (P1)
**What**: Pricing section renders Free Trial, Starter, Plus, Unlimited with correct prices
**Where**: Landing page (/)
**Mocks**: None (hardcoded in LandingPricing)
**Assert**: All 4 plan names visible, prices $0/$10/$20/$60

### 37. Blog Listing Page Renders Posts (P1)
**What**: /blog page shows blog post cards with titles
**Where**: Blog page
**Mocks**: None (SSR from DB, may need API mock)
**Assert**: Page loads, at least one blog post card visible

### 38. Blog Post Page Renders Article (P1)
**What**: /blog/[slug] page renders full article with title and body
**Where**: Blog post page
**Mocks**: None (SSR, may need mock or real data)
**Assert**: Article title visible, body content present

### 39. BottomTabs Mobile Navigation (P1)
**What**: Mobile bottom tabs navigate to correct routes
**Where**: Any /app/* page on mobile viewport
**Mocks**: Authenticated user
**Assert**: 4 tabs visible (Home, Health, Ask Denali, Settings), click navigates

### 40. Dashboard Home Page Renders Cards (P1)
**What**: Authenticated user sees dashboard with feature cards
**Where**: /app (dashboard home)
**Mocks**: Auth user, FHIR disconnected
**Assert**: Feature cards visible (Coverage Check, Medicare Dashboard, etc.)

---

## Batch 3 (Complete — 20/20)

> Full codebase audit (2026-03-23). Covers remaining gaps across health reports, appeal outcome, consent enforcement, feedback, diabetes interactions, and more.

| # | Test | Risk | Status | Spec File |
|---|------|------|--------|-----------|
| 41 | Health report view renders 12 sections when ready | P0 | done | health-report-view.spec.ts |
| 42 | Health report share link works without auth | P0 | done | health-report-view.spec.ts |
| 43 | Health report email sends via POST | P0 | done | health-report-view.spec.ts |
| 44 | Consent health_data_ai OFF strips health from sessionState | P0 | done | consent-enforcement.spec.ts |
| 45 | Consent health_data_ai OFF shows grey banner in chat | P0 | done | consent-enforcement.spec.ts |
| 46 | Appeal outcome form submits approved/denied/partial | P0 | done | appeal-outcome.spec.ts |
| 47 | Appeal outcome credits incentive on approved | P0 | done | appeal-outcome.spec.ts |
| 48 | Message feedback thumbs up/down buttons send POST | P1 | done | chat-feedback.spec.ts |
| 49 | Message feedback correction text capture | P1 | done | chat-feedback.spec.ts |
| 50 | Diabetes RiskAlerts expand individual alert + CTA | P1 | done | diabetes-interactions.spec.ts |
| 51 | Diabetes A1C chart toggle list/chart view | P1 | done | diabetes-interactions.spec.ts |
| 52 | Diabetes ScreeningReminders shows overdue indicator | P1 | done | diabetes-interactions.spec.ts |
| 53 | Diabetes InsightsCard renders Claude content + refresh | P1 | done | diabetes-interactions.spec.ts |
| 54 | Diabetes daily log delete entry via DELETE API | P1 | done | diabetes-interactions.spec.ts |
| 55 | Blog category tab filtering | P1 | done | blog-interactions.spec.ts |
| 56 | Blog personalized grouping for user with topic prefs | P1 | done | blog-interactions.spec.ts |
| 57 | Settings topic preferences max 2 selection | P1 | done | settings-topic-prefs.spec.ts |
| 58 | Dashboard time-aware greeting + nudge strip CTA | P1 | done | dashboard-interactions.spec.ts |
| 59 | Offline banner shows when offline, hides on reconnect | P2 | done | offline-interactions.spec.ts |
| 60 | Chat input disabled with offline placeholder message | P2 | done | offline-interactions.spec.ts |

---

## Batch 3 — Test Details

### 41. Health Report View Renders 12 Sections (P0)
**What**: When report status is "ready", navigate to report view and see all 12 sections rendered
**Where**: /app/health/report
**Mocks**: Auth user, `mockHealthReport()` with status "ready" + full report_data (red flags, diabetes, obesity, conditions, meds, screenings, providers, care team, denials, DME, hospice, disclaimer)
**Assert**: Each section heading visible, severity badges rendered, disclaimer present

### 42. Health Report Share Link Works Without Auth (P0)
**What**: Public share link (/report/[token]) renders report without authentication
**Where**: /report/[valid-token]
**Mocks**: Mock GET /api/health-report/share/[token] → 200 with report data
**Assert**: Report renders with sections, no sign-in prompt, 30-day expiry note visible

### 43. Health Report Email Sends via POST (P0)
**What**: Click "Email Report" button sends POST to /api/health-report/email
**Where**: /app/health/report (authenticated, report ready)
**Mocks**: Auth user, report ready, mock POST /api/health-report/email → 200
**Assert**: POST fired with correct body (reportId), success confirmation shown

### 44. Consent health_data_ai OFF Strips Health from SessionState (P0)
**What**: When health_data_ai consent is OFF, chat API call has healthDataAvailable=false and no health fields
**Where**: /app/chat (authenticated, FHIR connected, consent OFF)
**Mocks**: Auth user, FHIR connected, consent {health_data_ai: false}, mock /api/chat intercept body
**Assert**: Request body sessionState has healthDataAvailable=false, no conditions/medications/labs fields

### 45. Consent health_data_ai OFF Shows Grey Banner (P0)
**What**: When Blue Button connected but consent OFF, grey banner appears with Settings link
**Where**: /app/chat
**Mocks**: Auth user, FHIR connected (isConnected=true), consent {health_data_ai: false}
**Assert**: Banner text "Your Medicare data is connected but not shared with AI" visible, "Enable in Settings" link present

### 46. Appeal Outcome Form Submits (P0)
**What**: User can report appeal outcome (approved/denied/partial) via form
**Where**: /app/chat (with existing appeal)
**Mocks**: Auth user, chat SSE with appealLetter, mock POST /api/appeal-outcome → 200
**Assert**: Outcome dropdown visible, submit fires POST with {appealId, outcome}, confirmation message shown

### 47. Appeal Outcome Credits Incentive (P0)
**What**: Reporting "approved" outcome triggers credit incentive
**Where**: /app/chat (with existing appeal)
**Mocks**: Auth user, appeal loaded, mock POST /api/appeal-outcome → 200 with creditAdded=true
**Assert**: Confirmation mentions credit awarded

### 48. Message Feedback Thumbs Up/Down (P1)
**What**: Assistant messages show feedback buttons, clicking sends POST
**Where**: /app/chat (after receiving response)
**Mocks**: Auth user, mock chat SSE, mock POST /api/feedback → 200
**Assert**: Thumbs up/down buttons visible on assistant message, click fires POST with {messageId, rating}

### 49. Message Feedback Correction Text (P1)
**What**: Thumbs down prompts for correction text
**Where**: /app/chat
**Mocks**: Auth user, chat SSE, mock POST /api/feedback → 200
**Assert**: After thumbs down, correction input appears, submit includes correction text

### 50. Diabetes RiskAlerts Expand + CTA (P1)
**What**: Risk alerts card shows expandable alerts with "Find a specialist" CTA
**Where**: /app/diabetes (connected with diabetes conditions)
**Mocks**: Auth user, FHIR connected with diabetes conditions + high A1C flag
**Assert**: RiskAlerts card visible, individual alerts expandable, "Find a specialist" link present

### 51. Diabetes A1C Chart Toggle (P1)
**What**: A1C trend chart toggles between sparkline and list view
**Where**: /app/diabetes (connected with diabetes conditions)
**Mocks**: Auth user, FHIR connected, diabetes snapshots with multiple A1C entries
**Assert**: Chart visible, toggle button switches view, list shows dates + values

### 52. Diabetes ScreeningReminders Overdue (P1)
**What**: Screening reminders show overdue indicator for missed screenings
**Where**: /app/diabetes (connected)
**Mocks**: Auth user, FHIR connected with screenings where isOverdue=true
**Assert**: Overdue badge/indicator visible, months since last shown

### 53. Diabetes InsightsCard Renders + Refresh (P1)
**What**: InsightsCard shows Claude-generated analysis with refresh button
**Where**: /app/diabetes (connected)
**Mocks**: Auth user, FHIR connected, mock diabetes insights API
**Assert**: Insight text visible, refresh button present, click triggers POST /api/diabetes/insights

### 54. Diabetes Daily Log Delete (P1)
**What**: Delete button on log entry fires DELETE API call
**Where**: /app/diabetes (with existing log entries)
**Mocks**: Auth user, diabetes log with entries, mock DELETE /api/diabetes/log → 200
**Assert**: Delete button visible on entry, click fires DELETE, entry removed from list

### 55. Blog Category Tab Filtering (P1)
**What**: Blog listing page filters posts by category tabs
**Where**: /blog?category=coverage (or other categories)
**Mocks**: None (SSR)
**Assert**: Category tabs visible, clicking tab filters displayed posts

### 56. Blog Personalized Grouping (P1)
**What**: Authenticated user with topic preferences sees personalized blog grouping
**Where**: /blog (authenticated with topic prefs)
**Mocks**: Auth user cookie, topic preferences (diabetes, obesity)
**Assert**: "Based on your interests" badge visible, posts grouped by topic

### 57. Settings Topic Preferences Max 2 (P1)
**What**: Topic preferences allow max 2 selections, third is blocked
**Where**: /app/settings
**Mocks**: Auth user, mock PUT /api/preferences/topics
**Assert**: Topic options visible (diabetes, obesity), selecting 2 works, attempting 3rd shows limit message

### 58. Dashboard Greeting + Nudge Strip CTA (P1)
**What**: Dashboard shows time-aware greeting and nudge strip with actionable CTA
**Where**: /app (authenticated)
**Mocks**: Auth user with FHIR disconnected (triggers "Connect Medicare" nudge)
**Assert**: Greeting includes time of day, nudge strip visible with CTA button, click navigates

### 59. Offline Banner Shows/Hides (P2)
**What**: Offline banner appears when network drops, auto-dismisses on reconnect
**Where**: Any /app/* page
**Mocks**: Auth user, simulate offline via page.context().setOffline(true/false)
**Assert**: Banner appears with "You're offline" text, disappears after setOffline(false)

### 60. Chat Input Disabled Offline (P2)
**What**: Chat input shows disabled state with offline placeholder when offline
**Where**: /app/chat
**Mocks**: Auth user, simulate offline
**Assert**: Input disabled, placeholder reads "Chat requires an internet connection"

---

## Future Batches (Identified Gaps — Not Yet Scoped)

> These are known gaps from the full codebase audit. Will be scoped into Batch 4+ as needed.

### P0 — Data & Compliance
- Blue Button OAuth connect flow (authorize → BB redirect → callback → data load)
- Account deletion cascade verification (11 tables + Cognito + Stripe)
- Token refresh on expired access_token (middleware integration)
- Stripe webhook success path (checkout.session.completed → plan upgrade)
- HIPAA inactivity timeout accuracy (27 min warning, 30 min sign-out)

### P1 — Core Features
- Health report PDF download (/api/health-report/pdf/[id])
- Claims timeline expand + denial reason display
- DiagnosisSummaryCard severity color coding verification
- Provider summary display
- Admin CMS routes (GET/PATCH /api/admin/cms — admin only)
- Policy change email (POST /api/admin/email/policy-change)

### P2 — Edge Cases & Polish
- ID.me verification flow (OIDC redirect + callback)
- Offline queue replay (diabetes log POST → reconnect → replayed)
- Service worker cache strategies (network-first, cache-first)
- /offline fallback page rendering
- Chat file attachment upload
- Legal page cross-navigation links
