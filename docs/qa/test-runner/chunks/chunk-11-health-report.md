# Chunk 11: Health Report

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 16 (10 positive + 6 negative)**
**Prerequisites**: Chunk 10 passed (FHIR data available, BB connected)
**Account**: `ramanac@gmail.com` (admin)
**Clean state**: Keep BB connection from Chunk 10

---

## Positive Tests

### 11.P1 — Generate health report
**Steps**: `curl -X POST BASE_URL/api/health-report/generate -b "cookies"`
**Expected**: HTTP 200. Report generation starts (or returns existing if hash matches).
**Log**: HTTP status, response (report ID or generation status).

### 11.P2 — Poll for report status
**Steps**: If 11.P1 returned a "generating" status, poll: `curl -s BASE_URL/api/health-report -b "cookies"` every 3 seconds until complete or 60s timeout.
**Expected**: Eventually returns completed report with status = complete.
**Log**: Number of polls, final status, time to complete.

### 11.P3 — Report viewer page renders
**Steps**: Navigate to `BASE_URL/app/health/report` in browser.
**Expected**: Health Summary Report renders with multiple sections.
**Log**: Page loaded yes/no, sections visible.

### 11.P4 — Report sections present
**Steps**: Inspect report content for key sections.
**Expected**: At minimum: Patient Summary (age, gender, coverage type), Conditions Overview, Medication Review, Screening Status, Care Team.
**Log**: List each section found by name.

### 11.P5 — Retrieve specific report by ID
**Steps**: Get report ID from 11.P1. `curl -s BASE_URL/api/health-report/[ID] -b "cookies"`
**Expected**: HTTP 200. Returns specific report with full content.
**Log**: HTTP status, report ID matches.

### 11.P6 — Share report — generate share token
**Steps**: Use the share feature in the report UI (button/link). Or call the API to create a share token.
**Expected**: Share token generated. Returns a URL like `/report/[token]`.
**Log**: Token generated yes/no.

### 11.P7 — Public share link works without auth
**Steps**: Clear all cookies. Navigate to `BASE_URL/report/[token]` from 11.P6.
**Expected**: Report renders publicly. No authentication required. 30-day expiry window.
**Log**: Page loaded yes/no, report visible without auth.

### 11.P8 — Email report
**Steps**: `curl -X POST BASE_URL/api/health-report/email -H "Content-Type: application/json" -d '{"reportId":"[ID]"}' -b "cookies"`
**Expected**: HTTP 200. Ask user: "Did you receive the health report email?"
**Log**: HTTP status, email received confirmation.

### 11.P9 — Download report as text
**Steps**: `curl -s BASE_URL/api/health-report/pdf/[ID] -b "cookies" -o report_download.txt`
**Expected**: File downloaded successfully. Contains report text content.
**Log**: File downloaded yes/no, file size.

### 11.P10 — Hash prevents duplicate generation
**Steps**: Call generate again without changing any data: `curl -X POST BASE_URL/api/health-report/generate -b "cookies"`
**Expected**: Returns existing report (hash match) instead of regenerating. Faster response than initial generation.
**Log**: Response indicates existing report vs new generation, response time.

---

## Negative Tests

### 11.N1 — Generate report without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/health-report/generate`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 11.N2 — Generate report without FHIR data
**Steps**: As a user without BB connection (e.g., `ramanac+a@gmail.com`), try: `curl -X POST BASE_URL/api/health-report/generate -b "cookies"`
**Expected**: Error or empty report — cannot generate without health data.
**Log**: HTTP status, error message.

### 11.N3 — Expired share link (30-day test)
**Steps**: If a share token older than 30 days exists, test it. Otherwise, note this as BLOCKED since we can't wait 30 days.
**Expected**: Token expired, access denied.
**Log**: Mark BLOCKED if no expired token available. Document expected behavior.

### 11.N4 — Invalid share token
**Steps**: Navigate to `BASE_URL/report/invalid-token-xyz-12345` (no auth).
**Expected**: 404 or "report not found" page.
**Log**: HTTP status or page content.

### 11.N5 — Email report without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/health-report/email -H "Content-Type: application/json" -d '{"reportId":"test"}'`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 11.N6 — Get report by invalid ID
**Steps**: `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/health-report/nonexistent-id-xyz -b "cookies"`
**Expected**: HTTP 404.
**Log**: HTTP status.

---

## End of Chunk 11

**You must now**: Write `results/chunk-11-results.md` with every test result, then report summary to user and STOP.
