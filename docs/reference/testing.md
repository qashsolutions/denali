# Testing Reference

Full testing inventory, framework conventions, and lessons
learned. Extracted from CLAUDE.md to keep the main file
focused.

For the active subset (commands + coverage targets), see
CLAUDE.md "Testing (summary)".

---


### Commands

```bash
cd app
npx vitest run          # 575 unit tests
npm run test:coverage   # Unit tests + coverage thresholds
npx playwright test     # 212 E2E tests (requires dev server or auto-starts)
npx tsc --noEmit        # Type check
```

### Unit Tests (Vitest)

**Coverage**: `@vitest/coverage-v8` with per-file thresholds on critical files. Global floor: 33% stmts / 32% branch / 33% lines / 29% functions (ratchet up as tests are added). Run `npm run test:coverage` to enforce.

| File                      | Stmts | Branch | Lines | Why                                    |
| ------------------------- | ----- | ------ | ----- | -------------------------------------- |
| `claude.ts`               | 65%   | 50%    | 65%   | Extraction pipeline, tool loop         |
| `middleware.ts`           | 100%  | 90%    | 100%  | Guards every request                   |
| `auth/refresh/route.ts`   | 100%  | 100%   | 100%  | Session resilience                     |
| `chat/route.ts`           | 85%   | 75%    | 85%   | Core endpoint, orchestrates everything |
| `health/route.ts`         | 100%  | 100%   | 100%  | ALB health check                       |
| `auth-server.ts`          | 95%   | 95%    | 100%  | JWT + all Cognito functions            |
| `stripe-fulfillment.ts`   | 95%   | 90%    | 95%   | Financial risk                         |
| `eob-clinical.ts`         | 60%   | 50%    | 70%   | Patient safety                         |
| `fhir/crypto.ts`          | 100%  | 100%   | 100%  | Token encryption at rest               |
| `learning.ts`             | 95%   | 80%    | 95%   | Entity extraction, mapping upserts     |
| `rate-limiter.ts`         | 80%   | 60%    | 80%   | Token bucket, circuit breaker, retry   |
| `fhir/context.ts`         | 80%   | 60%    | 80%   | Consent gate — health data → AI        |
| `fhir/transforms.ts`      | 45%   | 40%    | 50%   | PII boundary — age+gender only         |
| `account/delete/route.ts` | 100%  | 70%    | 100%  | GDPR/CCPA cascade                      |

**Config**: `app/vitest.config.ts` — `@/` alias, includes `src/**/*.test.ts`, excludes `e2e/**`.

| Test File                                             | Tests | What It Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/fhir/__tests__/eob-clinical.test.ts`         | 35    | All 5 EOB extraction functions: conditions, medications (PDE enrichment), screenings (CPT mapping), providers (careTeam aggregation), hospitalizations (LOS, follow-up)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/config/__tests__/pricing.test.ts`                | 12    | `getUploadLimitForPlan` (6 plan types), `formatPrice` (2), `formatFileSize` (4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/app/api/consent/__tests__/route.test.ts`         | 13    | Consent route handler: auth checks (GET/PUT 401), type validation (400), boolean validation (400), upsert with correct `granted_at`/`revoked_at` timestamps, 500 on DB error                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/app/api/webhooks/stripe/__tests__/route.test.ts` | 17    | Stripe webhook: signature verification, checkout.session.completed dispatch, subscription.updated/deleted, invoice.payment_failed (subscription retrieval), unhandled events, error resilience                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/__tests__/stripe-fulfillment.test.ts`        | 28    | fulfillCheckoutSession (plan mapping, credit reset, idempotency), handleSubscriptionEvent (status sync, credit reset, cancellation), period date extraction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/lib/__tests__/normalize-email.test.ts`           | 7     | Gmail/Googlemail plus stripping, domain case normalization, non-Gmail passthrough, edge cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/lib/__tests__/auth-server.test.ts`               | 16    | `getAuthUser` JWT extraction: Bearer header, cookie fallback, header priority, email/username claims, DB fallback for UUID usernames, DB failure graceful degradation, expired token handling. Negative: malformed Bearer headers (lowercase, no-space, empty, whitespace). `getAuthUserOptional` null-on-error                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/__tests__/auth-server-cognito.test.ts`       | 25    | All 7 Cognito admin functions via mocked SDK `send()`: deleteCognitoUser (command params, error propagation), getCognitoUsernameByEmail (success, UserNotFound, other error), createOrGetCognitoUser (existing user, create on not-found, non-UserNotFound error, missing sub), setCognitoPassword (Permanent=true, error), initiateCognitoAuth (tokens, defaults, missing tokens, auth flow params), cognitoGlobalSignOut (command, error swallowed), refreshCognitoTokens (success, defaults, missing token, null result, flow params, error propagation)                                                                                                                                                                                                                                             |
| `src/app/api/auth/refresh/__tests__/route.test.ts`    | 13    | Token refresh: missing cookie 401, success 200 + cookie set, invalid token 401 + cookie clear (NotAuthorizedException/invalid_grant/Invalid Refresh Token), transient failure 503 + cookies preserved (ETIMEDOUT/DNS/ServiceUnavailable/non-Error). Negative: ambiguous error classification (client config NotAuthorizedException, case mismatch, JSON-wrapped errors)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/__tests__/middleware.test.ts`                    | 23    | API route passthrough, 7-day session lifetime (expired redirect, valid passthrough, session-expired no-loop), silent refresh (success + cookie forwarding, skip when both/neither tokens present), transient resilience (503 → next, network error → next, 401 → anonymous redirect), auth redirects (/ ↔ /app). Negative: malformed session_issued_at (NaN/0/negative), session boundary + refresh interaction, refresh 200 with missing Set-Cookie                                                                                                                                                                                                                                                                                                                                                    |
| `src/app/api/chat/__tests__/route.test.ts`            | 37    | Pre-stream: validation, auth 401, plan detection (5 plans + admin), rate limiting (weekly/daily 429 + graceful degradation), profile fallback, attachment validation (3 cases), SSE stream success/error, auto-create trial. Post-stream: role detection (counselor/provider), trigger detection (diabetes from conditions/keywords, obesity from conditions/meds/keywords, health data + denials), conversation persistence (create/reuse/fallback UUID), appeal persistence (save + failure resilience), suggestions persistence, unreported outcome check, GET health endpoint                                                                                                                                                                                                                       |
| `src/app/api/health/__tests__/route.test.ts`          | 4     | Health check: 200 when RDS reachable, 503 on timeout/connection refused/auth failure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/lib/fhir/__tests__/crypto.test.ts`               | 18    | AES-256-GCM: round-trip (plain, JSON, empty, long, unicode), IV uniqueness (same plaintext → different ciphertext), output format (valid base64, IV+ciphertext+tag sizing), tamper detection (flipped ciphertext/tag/IV, truncated, garbage), wrong key rejection, key validation (missing, short, long, empty)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/fhir/__tests__/context.test.ts`              | 28    | Consent gate (null on false/null/undefined consentHealthDataAi, context only on `true`), hospice safety gate, all data injection sections (coverage, MA plan, conditions, meds with refill gaps, obesity meds, overdue screenings, diabetes/obesity classification, denied claims, EOB claims, hospitalizations, care team, DME, A1C trends), 4KB truncation                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/fhir/__tests__/transforms.test.ts`           | 13    | PII boundary: transformPatient extracts ONLY age+gender (10 tests proving name/DOB/Medicare ID/address are never in output). transformCoverage (3 tests). transformEOB basics (3 tests)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/app/api/account/delete/__tests__/route.test.ts`  | 11    | Auth 401, admin block 403, 11-step cascade deletion (FK order verified), Cognito cleanup last, Stripe cancellation + failure resilience, delete_user_cascade RPC fallback, DB failure 500, POST alias                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/lib/__tests__/rate-limiter.test.ts`              | 29    | Token bucket (acquire/exhaust/refill/cap/per-API config), getTimeUntilNextToken, circuit breaker state machine (closed→open→half-open→closed, re-open on half-open failure, success decrements failures, reset), error types (RetryableError/NonRetryableError/CircuitOpenError/RateLimitError), withRetry (success/retry+recover/NonRetryable immediate/circuit blocks/onRetry callback/records success+failure), getAllStats, resetAll                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/__tests__/learning.test.ts`                  | 70    | Entity extraction: symptoms (8 patterns + dedup + severity + duration), procedures (imaging/surgery/therapy + bodyPart), medications, providers, timeframes, edge cases. Prompt injection: buildLearningPromptInjection (empty/caps/NCD-LCD fallback), buildFlywheelPromptInjection (empty/format/null avg_days/cap 20). DB: updateSymptomMapping (RPC + fallback + confidence clamp at 1.0), updateProcedureMapping, recordCoveragePath (upsert + docs + error), processFeedback (positive/negative/correction), getSymptomMappings/getProcedureMappings (row mapping + error), getSuccessfulCoveragePaths, getLearningContext (orchestration + denials), queueLearningJob, pruneLowConfidenceMappings, getFlywheelContext, checkOutcomeIncentive/applyOutcomeIncentive, recordAppealOutcome (5 paths) |
| `src/lib/__tests__/claude.test.ts`                    | 40    | extractUserInfo (name/ZIP/duration/provider/Medicare type/appeal detection/denial codes/date/requirement skip), formatMessages (text + PDF + image multimodal), extraction pipeline via mock API (MEDICARE_TYPE/REQUIREMENTS/VERIFIED/PRIOR_AUTH_LCD/SUGGESTIONS/policy refs), tool calling loop (execute+unknown+error), max iterations graceful fallback (partial content + absolute fallback)                                                                                                                                                                                                                                                                                                                                                                                                        |

**Fixtures**: `src/lib/fhir/__tests__/fixtures/synthetic-claims.ts` — 7 synthetic `ClaimSummary` objects exercising all extractors (carrier, outpatient, Part D with PDE, inpatient).

**Route Handler Testing Pattern**: `consent/__tests__/route.test.ts` demonstrates how to unit-test Next.js App Router handlers with Vitest by mocking `getAuthUser` and `query()` via `vi.mock()`. Route functions are imported and called directly with `new Request()` objects.

### E2E Tests (Playwright)

**Config**: `app/playwright.config.ts` — Chromium only, `baseURL: localhost:3000`, auto-starts dev server. **212 tests across 44 spec files** (updated 2026-03-23).

#### Foundation Tests (pre-existing — 19 files, 147 tests)

| Test File                       | Tests | What It Covers                                                                                                                                                                |
| ------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/chat-flow.spec.ts`         | 20    | Chat SSE flow, suggestions, empty state cards, greeting, consent banner, ?message= auto-send, ?topic= routing, PaywallModal via "upgrade", XSS in SSE, error states (429/500) |
| `e2e/health-hub.spec.ts`        | 11    | Health page connected (accordion cards, coverage, diabetes, conditions, claims, expansion, attribution, needs-attention) + disconnected + unauth                              |
| `e2e/dashboard.spec.ts`         | 8     | Feature cards (Coverage/Medicare/Appeals/Diabetes), greeting with name, walkthrough bar, nudge strip                                                                          |
| `e2e/diabetes.spec.ts`          | 10    | Coverage table 6 items, quick actions, A1C guide, connected states (with/without diabetes), QuickLog visibility, PreDiabetes Risk Card, CMS pledge                            |
| `e2e/settings.spec.ts`          | 14    | Account email/plan/trial, appearance/accessibility sections, 3 consent toggles + default OFF, topic preferences, audit log, danger zone 2-step delete, unauth sign-in option  |
| `e2e/sidebar.spec.ts`           | 3     | New Chat button, conversation history grouped by date (Today/Yesterday), empty state                                                                                          |
| `e2e/navigation.spec.ts`        | 6     | Desktop nav links, Health nav click, gear icon, landing/blog/FAQ public access                                                                                                |
| `e2e/health-report.spec.ts`     | 5     | Report API auth (401s), share token 404, PDF invalid-id error                                                                                                                 |
| `e2e/offline-pwa.spec.ts`       | 3     | Chat input disabled offline, offline banner, SW registration                                                                                                                  |
| `e2e/inactivity.spec.ts`        | 2     | No warning for active auth user, no warning for anon                                                                                                                          |
| `e2e/auth-api.spec.ts`          | 15    | 401 guards on 12 protected routes, profile/conversations data leakage checks                                                                                                  |
| `e2e/api-validation.spec.ts`    | 20    | Input validation across consent, checkout, diabetes log, events, feedback, appeal-outcome, topics, health-report email, admin CMS (403)                                       |
| `e2e/consent-toggles.spec.ts`   | 8     | Consent API 401, toggle rendering, initial state, PUT payloads, optimistic revert, toggle OFF                                                                                 |
| `e2e/payment-trial.spec.ts`     | 11    | Trial/checkout/webhook auth guards, invalid plan, Stripe signature                                                                                                            |
| `e2e/xss-security.spec.ts`      | 1     | XSS in URL param                                                                                                                                                              |
| `e2e/spoofing-security.spec.ts` | 7     | API access control on 5 routes                                                                                                                                                |
| `e2e/rate-limiting.spec.ts`     | 2     | Unauth sign-up prompt, checkout 503 error                                                                                                                                     |
| `e2e/coverage-check.spec.ts`    | 1     | Full chat flow: send → stream → render → suggestions                                                                                                                          |
| `e2e/pages.spec.ts`             | 7     | Landing hero/pricing, FAQ, Terms, Privacy                                                                                                                                     |
| `e2e/utility-api.spec.ts`       | 3     | Health check 200, CMS metadata shape + public access                                                                                                                          |

#### Batch 1 — User Interaction Tests (pendingtests.md #1–#20 — 9 files, 25 tests)

| Test File                          | Tests | What It Covers                                                                                                                        |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/auth-flows.spec.ts`           | 5     | #1 Email OTP sign-in flow, #2 Sign-out clears auth state, #3 Account delete fires DELETE + signs out                                  |
| `e2e/payment-flows.spec.ts`        | 5     | #4 PaywallModal plan selection → POST body, #16 Processing loading state, #17 Settings upgrade opens PaywallModal                     |
| `e2e/appeal-gate.spec.ts`          | 2     | #5 AppealGate unauth → sign-up overlay, #6 AppealGate no credits → unlock overlay                                                     |
| `e2e/chat-interactions.spec.ts`    | 4     | #7 "Sign up free" → /app/settings, #8 "Upgrade plan" → paywall, #18 ?payment=cancelled toast, #20 Consent banner "Enable in Settings" |
| `e2e/quicklog.spec.ts`             | 4     | #9 Glucose form submission POST, #10 Activity/Meal/Note tab forms                                                                     |
| `e2e/sidebar-interactions.spec.ts` | 2     | #11 Click → navigate to ?id=, #12 Group collapse/expand                                                                               |
| `e2e/health-interactions.spec.ts`  | 4     | #13 Disconnect calls POST, #14 Report "ready" banner + View link, #15 Unauth redirect, #19 OAuth error banner                         |

#### Batch 2 — Data-Driven Tests (pendingtests.md #21–#40 — 10 files, 24 tests)

| Test File                                | Tests | What It Covers                                                                                                                          |
| ---------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/health-hub-interactions.spec.ts`    | 5     | #21 Accordion expand shows content, #22 "Needs Attention" conditional card, #23 Diabetes card conditional, #24 Obesity card conditional |
| `e2e/health-report-interactions.spec.ts` | 1     | #25 "Generating" spinner banner                                                                                                         |
| `e2e/appeal-letter.spec.ts`              | 1     | #26 Appeal card renders from SSE appealLetter                                                                                           |
| `e2e/trial-enforcement.spec.ts`          | 2     | #27 Trial expired → 403 lock message, #28 Weekly rate limit → 429 message                                                               |
| `e2e/chat-edge-cases.spec.ts`            | 3     | #29 ?id= loads existing conversation, #30 New Chat resets state, #31 URL syncs ?id= on new conversation                                 |
| `e2e/settings-interactions.spec.ts`      | 6     | #32 Theme toggle (dark mode), #33 Text size selector, #34 Plan display for 4 tiers (serviceWorkers: "block")                            |
| `e2e/landing.spec.ts`                    | 2     | #35 Hero CTA → /app/chat, #36 Pricing 4 tiers with prices                                                                               |
| `e2e/blog.spec.ts`                       | 2     | #37 Blog listing renders posts, #38 Blog post renders article                                                                           |
| `e2e/mobile-nav.spec.ts`                 | 1     | #39 BottomTabs 4 tabs + navigation                                                                                                      |
| `e2e/dashboard.spec.ts`                  | 1     | #40 Dashboard renders feature cards for auth user (shared with foundation)                                                              |

#### Batch 3 — Integration Tests (pendingtests.md #41–#60 — 9 files, 20 tests)

| Test File                            | Tests | What It Covers                                                                                                         |
| ------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| `e2e/health-report-view.spec.ts`     | 3     | #41 Report view renders sections, #42 Share link controls visible, #43 Email sends via POST                            |
| `e2e/consent-enforcement.spec.ts`    | 2     | #44 health_data_ai OFF strips health from sessionState, #45 Grey banner visible                                        |
| `e2e/appeal-outcome.spec.ts`         | 2     | #46 Appeal card renders + outcome form, #47 Credit incentive on approved                                               |
| `e2e/chat-feedback.spec.ts`          | 2     | #48 Thumbs up/down sends POST, #49 Thumbs down shows confirmation                                                      |
| `e2e/diabetes-interactions.spec.ts`  | 5     | #50 RiskAlerts + CTA, #51 A1C chart toggle, #52 ScreeningReminders overdue, #53 InsightsCard + refresh, #54 Log delete |
| `e2e/blog-interactions.spec.ts`      | 2     | #55 Category tab filtering, #56 Personalized grouping                                                                  |
| `e2e/settings-topic-prefs.spec.ts`   | 1     | #57 Topic preferences max 2 + PUT on selection                                                                         |
| `e2e/dashboard-interactions.spec.ts` | 1     | #58 Time-aware greeting + nudge strip CTA                                                                              |
| `e2e/offline-interactions.spec.ts`   | 2     | #59 Offline banner shows/hides, #60 Chat input disabled offline                                                        |

**Shared Test Infrastructure** (`e2e/helpers.ts`): `mockAuthenticatedUser` (profile+conversations+trial+mfa, supports `authOverrides` for plan/credits), `mockUnauthenticatedUser`, `mockAdminUser`, `buildSSEResponse` (correct `event: delta\ndata: {text}` + `event: done\ndata: {content,suggestions}` format with optional `conversationId`/`appealLetter`), `mockChatSSE`, `mockChatError`, `mockFHIRData` (connected/disconnected with `MOCK_FHIR_CONNECTED`/`MOCK_FHIR_DISCONNECTED`), `mockConsent`, `mockConversationHistory` (unroutes previous handler, returns `{authenticated, conversations}` shape), `mockHealthReport`, `mockDiabetesSnapshots`, `mockDiabetesLog`, `mockDiabetesInsights`, `mockAuditLog`, `mockTopicPreferences`.

**SSE Mock Pattern**: Chat E2E tests mock `/api/chat` via `page.route()` returning `text/event-stream`. Format: `event: delta\ndata: {"text":"..."}\n\n` + `event: done\ndata: {"content":"...","suggestions":[],...}\n\n`. Trailing `\n\n` required to flush last SSE event from browser parser.

**Key E2E Testing Lessons** (2026-03-23):

- `page.context().addCookies([{name:"access_token",value:"fake",domain:"localhost",path:"/"}])` required before navigating to `/app` (middleware redirect)
- Profile mock MUST include `userId` field — dashboard page returns null without it
- Mock `/api/auth/mfa/status` — `loadProfileData()` calls it and hangs otherwise
- `page.unroute()` before `page.route()` when overriding a previously-mocked route (e.g., conversation history after mockAuthenticatedUser)
- Conversation history API expects `{authenticated:true, conversations:[{id,title,isAppeal,createdAt,firstUserMessage,lastAssistantMessage}]}` — NOT a flat array
- Use `.first()` liberally — text often appears in multiple elements (card title + tooltip, group header + timestamp, nav link + logo)
- Use `getByRole("navigation", {name:"Main navigation"}).getByRole("link",...)` to scope nav link searches (avoids matching "DenaliHealth" logo)
- Currency values in FHIR mock must be strings (`"$150.00"`) not numbers — `parseCurrency()` calls `.replace()` on the value
- `loadConversation()` reads `data.conversation.messages` — messages must be nested inside `conversation` object, not top-level
- Mock `/api/appeals*` when loading conversations — `useChat` calls `loadAppealsForConversation()` on mount
- Use `.last()` for mobile bottom nav — both header and BottomTabs share `aria-label="Main navigation"`
- `{ exact: true }` on `getByRole`/`getByText` to avoid substring matches (e.g., "Default" vs "Reset to Defaults")
- `test.use({ serviceWorkers: "block" })` prevents SW from caching `/api/profile` between plan display tests
- `page.waitForFunction()` is more reliable than `waitForResponse` for async state like plan loading (3 sequential fetches)
- Mock `/api/alerts/preferences` in settings tests — unmocked causes 401 errors

### E2E Coverage Assessment (2026-03-23)

**Strong coverage (80%+):** API auth guards (401s), input validation (400s), XSS prevention, chat SSE flow, consent toggles, payment/checkout validation, page rendering, settings UI, sidebar interactions, health hub accordion cards, rate limiting/trial enforcement.

**Moderate coverage (40-80%):** Chat edge cases (load/reset/URL sync), landing page, blog pages, mobile navigation, QuickLog forms, health disconnect/report banner, appeal gate/letter rendering, plan display per tier, theme/text-size settings.

**Weak coverage (<30%):** Health report full UI (12 sections, PDF, email, share), diabetes dashboard interactions (A1C chart, risk alerts expand, insights refresh), Blue Button OAuth connect flow, ID.me verification, appeal outcome reporting, message feedback (thumbs up/down), offline queue replay, consent enforcement mid-chat, Stripe webhook success path, admin CMS routes, file attachments.

**Pending tests documented in `e2e/pendingtests.md`** — Batch 1 (20/20 done) + Batch 2 (20/20 done). See Batch 3 below for remaining gaps.

### Security Tests

**XSS Prevention** (`xss-security.spec.ts`):

- Detection: Sets `window.xssTriggered = false` before test, asserts still `false` after render
- Paragraph tests: `<script>`, `<img onerror>`, `<div onmouseover>`, `javascript:` URI — all escaped by `parseMarkdown()` (lines 51-54)
- Table tests: `<script>` in cell, `<img onerror>` in header — escaped by `parseTable()` HTML entity escaping
- URL param: `?message=<script>...` rendered as plain text in user bubble (React text nodes)

**Spoofing Prevention** (`spoofing-security.spec.ts`):

- `/api/conversations` without auth → `{ authenticated: false, conversations: [] }`
- `/api/profile` without auth → `{ authenticated: false }`, no plan/role/admin/credits leaked
- `/api/consent` without auth → 401
- `/api/diabetes/log` without auth → 401

**Payment & Trial Access Control** (`payment-trial.spec.ts`):

- `/api/trial` GET/POST without auth → 401
- `/api/checkout` POST without auth or Stripe key → 400/401/503
- `/api/checkout` POST with invalid plan → 400 `"Invalid plan type"`
- `/api/webhooks/stripe` POST without secret → 500; without signature → 400

**Consent Toggle Behavior** (`consent-toggles.spec.ts`):

- PUT `/api/consent` without auth → 401
- All 3 toggles render as `role="switch"` with correct `aria-checked` from GET response
- Clicking toggle sends PUT with correct `{ consentType, granted }` payload
- Toggle reverts to previous state when API returns 500 (optimistic revert)
- Toggling OFF sends `granted: false`

**XSS Fix Applied**: `MarkdownContent.tsx` `parseTable()` now escapes `&`, `<`, `>` in both header and body cells before bold processing — same defense as paragraph path. Without this fix, table cells were a live XSS vector via `dangerouslySetInnerHTML`.

