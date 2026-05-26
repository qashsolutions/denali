# Chunk 12: Diabetes & Obesity Dashboard

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 18 (14 positive + 4 negative)**
**Prerequisites**: Chunk 10 passed (FHIR data with diabetes/obesity conditions available)
**Account**: `ramanac@gmail.com` (admin)
**Clean state**: Keep BB connection

---

## Positive Tests

### 12.P1 — Diabetes dashboard loads
**Steps**: Navigate to `BASE_URL/app/diabetes`.
**Expected**: Page renders with dashboard components: A1C chart area, screening reminders, risk alerts, quick log form, insights card.
**Log**: Page loaded yes/no, list each component visible.

### 12.P2 — A1C trend chart renders
**Steps**: Check A1CTrendChart component on diabetes dashboard.
**Expected**: SVG sparkline chart rendered from `diabetes_snapshots` data. Or toggle to list view showing data points.
**Log**: Chart visible yes/no, data points present yes/no. (May show "no data" if sandbox has no A1C values.)

### 12.P3 — Quick log — glucose entry
**Steps**: On QuickLog component, select "Glucose" tab. Enter a glucose value (e.g., 120 mg/dL). Submit.
**Expected**: POST `/api/diabetes/log` succeeds. Entry appears in log.
**Log**: POST status, entry visible in UI.

### 12.P4 — Quick log — activity entry
**Steps**: Select "Activity" tab. Enter an activity (e.g., "30 min walk"). Submit.
**Expected**: Entry saved successfully.
**Log**: POST status, entry visible.

### 12.P5 — Quick log — meal entry
**Steps**: Select "Meal" tab. Enter meal details. Submit.
**Expected**: Entry saved successfully.
**Log**: POST status, entry visible.

### 12.P6 — Quick log — note entry
**Steps**: Select "Note" tab. Enter a note (e.g., "Feeling good today"). Submit.
**Expected**: Entry saved successfully.
**Log**: POST status, entry visible.

### 12.P7 — Retrieve log entries via API
**Steps**: `curl -s BASE_URL/api/diabetes/log -b "cookies"`
**Expected**: HTTP 200. Returns array of log entries including the ones created in 12.P3-P6.
**Log**: HTTP status, entry count.

### 12.P8 — Delete log entry
**Steps**: Take an entry ID from 12.P7. `curl -X DELETE "BASE_URL/api/diabetes/log?id=[ENTRY_ID]" -b "cookies"`
**Expected**: HTTP 200. Entry removed. Subsequent GET no longer includes it.
**Log**: DELETE status, entry removed confirmed.

### 12.P9 — Generate diabetes insights
**Steps**: `curl -X POST BASE_URL/api/diabetes/insights -b "cookies"`
**Expected**: HTTP 200. Claude generates a diabetes analysis. InsightsCard content returned.
**Log**: HTTP status, insights content present yes/no, approximate length.

### 12.P10 — Diabetes snapshots API
**Steps**: `curl -s BASE_URL/api/diabetes/snapshots -b "cookies"`
**Expected**: HTTP 200. Returns longitudinal lab history (A1C values over time).
**Log**: HTTP status, data point count.

### 12.P11 — Screening reminders render
**Steps**: On diabetes dashboard, check ScreeningReminders component.
**Expected**: Shows screening due dates (e.g., A1C, eye exam, kidney function). Badges for overdue/upcoming.
**Log**: Reminders visible yes/no, count and types shown. (May be empty if sandbox data lacks screenings.)

### 12.P12 — Risk alerts render
**Steps**: On diabetes dashboard, check RiskAlerts component.
**Expected**: Proactive alerts displayed based on conditions (e.g., high A1C, missing meds, overdue screenings).
**Log**: Alerts visible yes/no, count and severity levels. (May be empty depending on sandbox data.)

### 12.P13 — Weight Management card on Health Hub
**Steps**: Navigate to `BASE_URL/app/health`. Look for "Weight Management" accordion card.
**Expected**: Card visible if obesity condition or obesity medication present in FHIR data. Shows classification badge, medication info.
**Log**: Card visible yes/no. (Mark as expected-not-visible if no obesity data in sandbox.)

### 12.P14 — "Discuss Weight Management" CTA
**Steps**: If Weight Management card is visible, click the "Discuss Weight Management" CTA button.
**Expected**: Navigates to `/app/chat` (or opens chat with pre-filled weight management topic).
**Log**: Navigation destination. (Mark BLOCKED if card not visible from 12.P13.)

---

## Negative Tests

### 12.N1 — Diabetes log without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/diabetes/log -H "Content-Type: application/json" -d '{"type":"glucose","value":"120"}'`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 12.N2 — Diabetes insights without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/diabetes/insights`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 12.N3 — Diabetes dashboard without FHIR data
**Steps**: Sign in as user without BB connection (e.g., `ramanac+a@gmail.com`). Navigate to `BASE_URL/app/diabetes`.
**Expected**: Graceful empty state — "Connect Medicare to see diabetes data" or similar. No crash.
**Log**: Page behavior, empty state message.

### 12.N4 — Delete nonexistent log entry
**Steps**: `curl -X DELETE "BASE_URL/api/diabetes/log?id=nonexistent-fake-id" -b "cookies"`
**Expected**: HTTP 404 or graceful error.
**Log**: HTTP status, error message.

---

## End of Chunk 12

**You must now**: Write `results/chunk-12-results.md` with every test result, then report summary to user and STOP.
