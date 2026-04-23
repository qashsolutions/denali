# Chunk 10: Medicare Blue Button / FHIR Integration

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 14 (8 positive + 6 negative)**
**Prerequisites**: Chunks 02-03, 06 passed (auth + consent)
**Account**: `ramanac@gmail.com` (admin)
**Note**: Uses CMS sandbox at `sandbox.bluebutton.cms.gov`. User may need to complete CMS sandbox login manually.
**Clean state**: Sign in fresh

---

## Positive Tests

### 10.P1 — Health Hub page loads
**Steps**: Sign in as `ramanac@gmail.com`. Navigate to `BASE_URL/app/health`.
**Expected**: Page renders with accordion cards. At minimum: Coverage Status, Claims & Providers, Medicare Account visible. Other cards (Diabetes Care, Weight Management, etc.) may be conditional.
**Log**: List all visible accordion card titles, count.

### 10.P2 — "Connect Medicare" button visible
**Steps**: On Health Hub, look for Blue Button connect CTA.
**Expected**: Button/link to "Connect Medicare" or "Connect Blue Button" is present (if not already connected).
**Log**: Button visible yes/no, button text.

### 10.P3 — OAuth PKCE flow initiates
**Steps**: Click "Connect Medicare". Observe redirect.
**Expected**: Browser redirects to `sandbox.bluebutton.cms.gov/v2/o/authorize/` with query params including `code_challenge` (PKCE) and scopes: `patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read profile openid`.
**Log**: Redirect URL domain, PKCE params present yes/no, scopes in URL.

### 10.P4 — OAuth callback succeeds
**Steps**: Complete CMS sandbox login (ask user to authorize if needed). After authorization, callback redirects to app.
**Expected**: Callback hits `/api/fhir/callback`. Code exchanged for tokens. `ehr_connections` record created. User redirected back to Health Hub.
**Log**: Callback completed yes/no, final redirect URL. (User may need to interact with CMS sandbox login.)

### 10.P5 — FHIR data cached and returned
**Steps**: After successful connection from 10.P4: `curl -s BASE_URL/api/fhir/data -b "cookies"`
**Expected**: HTTP 200. Returns cached FHIR data with resource types: patient, coverage, eob, conditions, medications, screenings, providers, hospitalizations, dme, hospice_status, sync_meta.
**Log**: HTTP status, top-level keys present, resource counts if visible.

### 10.P6 — Health report auto-generated after connect
**Steps**: Wait 10-15 seconds after BB connect. Then: `curl -s BASE_URL/api/health-report -b "cookies"`
**Expected**: Health report exists (auto-generated fire-and-forget from callback). May still be generating — check status.
**Log**: Report found yes/no, status (complete/generating).

### 10.P7 — Disconnect Medicare
**Steps**: `curl -X DELETE BASE_URL/api/fhir/disconnect -b "cookies"`
**Expected**: HTTP 200. Connection removed. `GET /api/fhir/data` now returns empty/not-connected.
**Log**: DELETE status, subsequent GET /api/fhir/data status.

### 10.P8 — FHIR_CONNECT audit log entry
**Steps**: `curl -s BASE_URL/api/audit-log -b "cookies"`. Look for FHIR-related entries.
**Expected**: `FHIR_CONNECT` audit entry present with timestamp matching the connection time.
**Log**: Audit entry found yes/no, action type, timestamp.

---

## Negative Tests

### 10.N1 — FHIR authorize without auth
**Steps**: Clear cookies. `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/fhir/authorize`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 10.N2 — FHIR callback with invalid code
**Steps**: `curl -s -o /dev/null -w "%{http_code}" "BASE_URL/api/fhir/callback?code=invalid_code_xyz&state=fake"` (with valid cookies)
**Expected**: Error — token exchange fails. Non-200 or error redirect.
**Log**: HTTP status, behavior.

### 10.N3 — FHIR data without Blue Button connection
**Steps**: After disconnect (10.P7), try: `curl -s BASE_URL/api/fhir/data -b "cookies"`
**Expected**: Empty data, "not connected" status, or empty JSON.
**Log**: HTTP status, response content.

### 10.N4 — FHIR disconnect without auth
**Steps**: Clear cookies. `curl -X DELETE BASE_URL/api/fhir/disconnect`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 10.N5 — FHIR data without auth
**Steps**: Clear cookies. `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/fhir/data`
**Expected**: HTTP 401 or empty response.
**Log**: HTTP status.

### 10.N6 — FHIR data access audit deduplication
**Steps**: Reconnect BB (or use existing connection). Call `/api/fhir/data` twice within 2 hours. Check audit log.
**Expected**: Only 1 `FHIR_DATA_ACCESS` audit entry (deduped within 2-hour window), not 2.
**Log**: Count of FHIR_DATA_ACCESS entries with recent timestamps. (Mark BLOCKED if BB reconnection not feasible after 10.P7.)

---

## End of Chunk 10

**You must now**: Write `results/chunk-10-results.md` with every test result, then report summary to user and STOP.
