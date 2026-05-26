# Chunk 01: Public Pages & Landing Page

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 22 (15 positive + 7 negative)**
**Prerequisites**: None — no auth required
**Account**: None needed
**Clean state**: Clear all cookies and storage before starting

---

## Positive Tests

### 1.P1 — Landing page loads
**Steps**: Navigate to `BASE_URL/`
**Expected**: Page renders. Verify ALL 6 sections exist: Hero, Features, Conditions, How It Works, Pricing, Testimonials. Check for mountain silhouette SVG in Hero. Check tagline contains "DenaliHealth helps Medicare patients".
**Log**: List which sections rendered.

### 1.P2 — Hero CTA "Ask About Coverage"
**Steps**: On landing page, find and click the "Ask About Coverage" button/link.
**Expected**: Browser navigates to `/app/chat`.
**Log**: Final URL after click.

### 1.P3 — Hero CTA "Learn How It Works"
**Steps**: On landing page, find and click "Learn How It Works".
**Expected**: Page smooth-scrolls to `#how-it-works` section. The "How It Works" section becomes visible in viewport.
**Log**: Whether scroll happened and section is visible.

### 1.P4 — Pricing section displays 4 tiers
**Steps**: On landing page, scroll to Pricing section.
**Expected**: 4 pricing cards visible: Free Trial ($0), Starter ($10/mo), Plus ($20/mo), Unlimited ($60/mo). Each card shows its specific features and limits.
**Log**: List all 4 card titles and prices found.

### 1.P5 — "Most Popular" badge on Plus plan
**Steps**: Inspect the Pricing cards.
**Expected**: The Plus ($20/mo) card has a "Most Popular" badge/label. No other card has this badge.
**Log**: Which card has the badge.

### 1.P6 — FAQ page renders
**Steps**: Navigate to `BASE_URL/faq`
**Expected**: Page loads with 9 FAQ sections. Footer present with links to Terms, Privacy, HIPAA.
**Log**: Count of FAQ sections found, footer link presence.

### 1.P7 — Terms of Service page
**Steps**: Navigate to `BASE_URL/terms`
**Expected**: Page loads with 15 sections of Terms content. CMS non-endorsement disclaimer present in footer.
**Log**: Count of sections, disclaimer text present yes/no.

### 1.P8 — Privacy Policy page
**Steps**: Navigate to `BASE_URL/privacy`
**Expected**: Page loads with 16 sections. Footer navigation links work.
**Log**: Count of sections, at least 2 footer links verified.

### 1.P9 — HIPAA page renders
**Steps**: Navigate to `BASE_URL/hipaa`
**Expected**: Page loads with HIPAA compliance content. No blank page or error.
**Log**: Page title and whether content is present.

### 1.P10 — Blog listing page (default rotating)
**Steps**: Navigate to `BASE_URL/blog` (not signed in)
**Expected**: "This Week's Picks" heading visible. Exactly 3 posts displayed (ISO week-based rotation).
**Log**: Heading text found, count of posts displayed.

### 1.P11 — Blog category filter
**Steps**: Navigate to `BASE_URL/blog?category=appeals`
**Expected**: Category tabs/filters appear at top. Grid shows only posts tagged with "appeals" category.
**Log**: Category tabs visible, count of filtered posts.

### 1.P12 — Blog post detail page
**Steps**: From `/blog`, click the first visible blog post link.
**Expected**: Navigates to `/blog/[slug]`. Full post content renders (title, body, date).
**Log**: Final URL (slug), post title found.

### 1.P13 — Footer cross-navigation links
**Steps**: On `/faq`, find footer link to "Terms" and click it.
**Expected**: Navigates to `/terms` page successfully.
**Log**: Starting page, link clicked, destination URL.

### 1.P14 — CMS metadata endpoint
**Steps**: `curl -s BASE_URL/api/cms-metadata`
**Expected**: HTTP 200. Response is valid JSON with CMS app directory metadata.
**Log**: HTTP status code, top-level JSON keys.

### 1.P15 — Health check endpoint
**Steps**: `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/health`
**Expected**: HTTP 200.
**Log**: HTTP status code.

---

## Negative Tests

### 1.N1 — Invalid blog slug
**Steps**: Navigate to `BASE_URL/blog/nonexistent-slug-xyz-12345`
**Expected**: 404 page or graceful error message. No unhandled crash or blank page.
**Log**: HTTP status or page content shown.

### 1.N2 — Invalid blog category
**Steps**: Navigate to `BASE_URL/blog?category=fakecategory999`
**Expected**: Empty grid, default view, or "no posts" message. No crash or error page.
**Log**: What the page shows.

### 1.N3 — Block scanner response
**Steps**: `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/block-scanner`
**Expected**: HTTP 404.
**Log**: HTTP status code.

### 1.N4 — WordPress scanner paths blocked
**Steps**: Run both:
- `curl -s -o /dev/null -w "%{http_code}" BASE_URL/wp-admin`
- `curl -s -o /dev/null -w "%{http_code}" BASE_URL/wp-login.php`
**Expected**: Both return 404 (not 200, not 500).
**Log**: HTTP status for each path.

### 1.N5 — Offline fallback page accessible
**Steps**: Navigate to `BASE_URL/offline`
**Expected**: Offline fallback page renders with links to cached health records and conversations.
**Log**: Page content summary.

### 1.N6 — Anonymous user redirected from /app
**Steps**: Clear all cookies. Navigate to `BASE_URL/app`
**Expected**: Redirects to `/` (landing page). User does NOT see the dashboard.
**Log**: Final URL after redirect.

### 1.N7 — Anonymous chat page shows signup prompt
**Steps**: Clear all cookies. Navigate to `BASE_URL/app/chat`
**Expected**: Empty-state suggestion cards visible, but ChatInput area shows "Sign up free" prompt/link pointing to `/app/settings`. No functional chat input.
**Log**: Whether suggestion cards visible, signup prompt text, link destination.

---

## End of Chunk 01

**STATUS: COMPLETED** — 2026-03-10
**Results**: 20 passed, 2 failed, 0 blocked out of 22
**Results file**: `results/chunk-01-results.md`

**You must now**: Write `results/chunk-01-results.md` with every test result, then report summary to user and STOP.
