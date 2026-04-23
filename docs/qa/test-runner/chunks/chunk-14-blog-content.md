# Chunk 14: Blog & Content System

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 12 (7 positive + 5 negative)**
**Prerequisites**: Chunk 02 passed (for personalized blog)
**Accounts**: Anonymous + `ramanac+a@gmail.com` (with topic prefs from Chunk 05)
**Clean state**: Clear cookies at start for anonymous tests, then sign in

---

## Positive Tests

### 14.P1 — Blog default (rotating weekly picks)
**Steps**: Clear cookies. Navigate to `BASE_URL/blog`.
**Expected**: "This Week's Picks" heading visible. 3 weekly-rotating posts displayed (rotation based on ISO week number).
**Log**: Heading text, post count, post titles.

### 14.P2 — Blog personalized (signed-in with topic prefs)
**Steps**: Sign in as `ramanac+a@gmail.com` (who has topic prefs set from Chunk 05). Navigate to `BASE_URL/blog`.
**Expected**: "Based on your interests" section headers visible. Posts grouped by user's selected topics (diabetes, obesity).
**Log**: Section headers, grouping visible yes/no, post count.

### 14.P3 — Blog category filter
**Steps**: Navigate to `BASE_URL/blog?category=denial-codes`
**Expected**: Category tabs visible at top. Post grid filtered to only denial-codes posts.
**Log**: Tab bar visible, selected category, filtered post count.

### 14.P4 — Blog post detail page
**Steps**: Click the first visible blog post on `/blog`.
**Expected**: Navigates to `/blog/[slug]`. Full post content renders: title, body text, date, category.
**Log**: Slug in URL, title, content present yes/no.

### 14.P5 — Blog ISR header check
**Steps**: `curl -sI BASE_URL/blog`
**Expected**: Response headers indicate ISR with `revalidate = 3600` (1-hour). Look for `x-nextjs-cache`, `cache-control`, or similar headers.
**Log**: Relevant cache headers found, values.

### 14.P6 — Email a coverage checklist
**Steps**: `curl -X POST BASE_URL/api/email/checklist -H "Content-Type: application/json" -d '{"email":"ramanac@gmail.com"}'`
**Expected**: HTTP 200. Email sent. Ask user: "Did you receive a coverage checklist email?"
**Log**: HTTP status, email received confirmation.

### 14.P7 — Blog has 16+ posts
**Steps**: Navigate to `BASE_URL/blog`. Check for category options and count total visible posts across all views/pages.
**Expected**: At least 16 posts available across categories (denial-codes, coverage, appeals, prior-auth).
**Log**: Total post count observed.

---

## Negative Tests

### 14.N1 — Blog without topic prefs falls back to default
**Steps**: Sign in as a user with NO topic preferences set. Navigate to `BASE_URL/blog`.
**Expected**: Falls back to default "This Week's Picks" rotating view (not personalized).
**Log**: View type shown (rotating vs personalized).

### 14.N2 — Invalid blog slug
**Steps**: Navigate to `BASE_URL/blog/this-slug-absolutely-does-not-exist-xyz`
**Expected**: 404 page or "post not found" message. No crash.
**Log**: Page behavior, status.

### 14.N3 — Blog personalized view without auth
**Steps**: Clear cookies. Navigate to `BASE_URL/blog`.
**Expected**: Shows default (non-personalized) rotating view. No "Based on your interests" section.
**Log**: View type shown.

### 14.N4 — Blog category with no matching posts
**Steps**: Navigate to `BASE_URL/blog?category=nonexistent-category-xyz`
**Expected**: Empty grid, "no posts" message, or falls back to default view. No crash.
**Log**: Page behavior.

### 14.N5 — Checklist email with invalid address
**Steps**: `curl -X POST BASE_URL/api/email/checklist -H "Content-Type: application/json" -d '{"email":"not-an-email"}'`
**Expected**: HTTP 400 or validation error.
**Log**: HTTP status, error message.

---

## End of Chunk 14

**You must now**: Write `results/chunk-14-results.md` with every test result, then report summary to user and STOP.
