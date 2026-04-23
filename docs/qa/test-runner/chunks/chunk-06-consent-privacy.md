# Chunk 06: Consent & Privacy Toggles

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 14 (8 positive + 6 negative)**
**Prerequisites**: Chunk 05 passed (Settings works)
**Account**: `ramanac+a@gmail.com`
**Clean state**: Sign in fresh

---

## Positive Tests

### 6.P1 — Default consent values are all OFF
**Steps**: Sign in as `ramanac+a@gmail.com`. `curl -s BASE_URL/api/consent -b "cookies"`
**Expected**: All 3 toggles OFF: `health_data_ai: false`, `health_data_storage: false`, `analytics: false`.
**Log**: Each consent value.

### 6.P2 — Enable health_data_ai
**Steps**: In Settings → Privacy & Data, toggle `health_data_ai` ON. Or via API: `curl -X PUT BASE_URL/api/consent -H "Content-Type: application/json" -d '{"type":"health_data_ai","value":true}' -b "cookies"`
**Expected**: HTTP 200. GET `/api/consent` now shows `health_data_ai: true`.
**Log**: PUT status, GET verification.

### 6.P3 — Enable health_data_storage
**Steps**: Toggle `health_data_storage` ON via UI or API.
**Expected**: Value persisted as `true`.
**Log**: PUT status, GET verification.

### 6.P4 — Enable analytics
**Steps**: Toggle `analytics` ON via UI or API.
**Expected**: Value persisted as `true`.
**Log**: PUT status, GET verification.

### 6.P5 — Disable consent toggle
**Steps**: Toggle `health_data_ai` back to OFF.
**Expected**: Value updated to `false`. GET confirms.
**Log**: PUT status, GET verification.

### 6.P6 — Optimistic toggle behavior in UI
**Steps**: In browser, toggle any consent switch and observe UI behavior. (If possible, throttle network to see optimistic update.)
**Expected**: Toggle flips immediately in UI (optimistic), then persists after API response. If API fails, toggle reverts.
**Log**: Optimistic flip observed yes/no. (Mark BLOCKED if network throttling not feasible.)

### 6.P7 — Consent change creates audit log entry
**Steps**: Toggle a consent value. Then check: `curl -s BASE_URL/api/audit-log -b "cookies"`
**Expected**: `CONSENT_UPDATED` audit entry present with recent timestamp.
**Log**: Audit entry found yes/no, action type, timestamp.

### 6.P8 — Mid-session consent toggle affects chat
**Steps**: 
1. Enable `health_data_ai`.
2. Open chat, send a message (with health context if BB connected).
3. Go to Settings, toggle `health_data_ai` OFF.
4. Go back to chat, send another message.
**Expected**: Second message should NOT include health data in AI context. (Verify by checking if Claude's response references health data — it should not after toggle OFF.)
**Log**: Whether health data appeared in response before and after toggle.

---

## Negative Tests

### 6.N1 — PUT consent without auth
**Steps**: Clear cookies. `curl -X PUT BASE_URL/api/consent -H "Content-Type: application/json" -d '{"type":"analytics","value":true}'`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 6.N2 — Invalid consent type
**Steps**: `curl -X PUT BASE_URL/api/consent -H "Content-Type: application/json" -d '{"type":"fake_consent_type","value":true}' -b "cookies"`
**Expected**: HTTP 400 — invalid type.
**Log**: HTTP status, error message.

### 6.N3 — Non-boolean consent value
**Steps**: `curl -X PUT BASE_URL/api/consent -H "Content-Type: application/json" -d '{"type":"analytics","value":"yes"}' -b "cookies"`
**Expected**: HTTP 400 — must be boolean.
**Log**: HTTP status, error message.

### 6.N4 — GET consent without auth
**Steps**: Clear cookies. `curl -s -o /dev/null -w "%{http_code}" BASE_URL/api/consent`
**Expected**: HTTP 401.
**Log**: HTTP status.

### 6.N5 — Chat consent banner when health_data_ai OFF
**Steps**: Connect Blue Button (if possible) or ensure `health_data_ai` is OFF. Navigate to `/app/chat`.
**Expected**: Grey banner visible: directs user to Settings to enable health data AI consent.
**Log**: Banner visible yes/no, banner text. (Mark BLOCKED if Blue Button not yet connected.)

### 6.N6 — IndexedDB blocked when health_data_storage OFF
**Steps**: Set `health_data_storage` to OFF. Load health data page. Check IndexedDB `denali-offline-cache` for `health-data` store.
**Expected**: No new writes to IndexedDB health-data store.
**Log**: IndexedDB state checked, writes present yes/no. (Mark BLOCKED if hard to inspect IndexedDB.)

---

## End of Chunk 06

**You must now**: Write `results/chunk-06-results.md` with every test result, then report summary to user and STOP.
