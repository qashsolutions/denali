# Chunk 17: PWA & Offline Support

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 14 (9 positive + 5 negative)**
**Prerequisites**: Chunks 02, 08 passed (auth + chat working)
**Account**: `ramanac@gmail.com`
**Tools**: Chrome DevTools → Network tab for offline simulation
**Clean state**: Sign in fresh, load some data online first

---

## Positive Tests

### 17.P1 — Service worker registered
**Steps**: In Chrome DevTools → Application → Service Workers. Check registration.
**Expected**: Service worker active for the domain. Cache version = `v3`.
**Log**: SW registered yes/no, scope, cache version if visible.

### 17.P2 — Precached assets available offline
**Steps**: Load the app online first. Then in DevTools → Network → check "Offline". Navigate to `BASE_URL/offline`.
**Expected**: Offline page loads from cache. Content includes links to cached health records and conversations.
**Log**: Page loaded offline yes/no, content visible.

### 17.P3 — Static assets served from cache
**Steps**: While offline, check if `/_next/static/*` assets, icons (`/icon-192.png`, `/icon-512.png`) load.
**Expected**: Served from `denali-static-v3` cache (cache-first strategy).
**Log**: Static assets loaded offline yes/no.

### 17.P4 — API data cached (network-first fallback)
**Steps**: While online, load `/api/conversations`. Then go offline. Reload the conversations page.
**Expected**: Conversations served from `denali-api-v3` cache (network-first with cache fallback).
**Log**: Data available offline yes/no.

### 17.P5 — Offline banner appears
**Steps**: Go offline (DevTools → Network → Offline).
**Expected**: Amber `OfflineBanner` appears below the AppHeader.
**Log**: Banner visible yes/no, color, text.

### 17.P6 — Banner auto-dismisses on reconnect
**Steps**: Uncheck "Offline" in DevTools (go back online).
**Expected**: OfflineBanner disappears automatically.
**Log**: Banner dismissed yes/no, delay.

### 17.P7 — ChatInput disabled when offline
**Steps**: Go offline. Navigate to `/app/chat`.
**Expected**: ChatInput is disabled with a placeholder text indicating offline status.
**Log**: Input disabled yes/no, placeholder text.

### 17.P8 — Offline write queue for diabetes log
**Steps**: 
1. Go offline.
2. Submit a diabetes log entry via QuickLog.
3. Go back online.
**Expected**: Entry queued while offline. Replayed via `SYNC_QUEUE` service worker message on reconnect. Entry appears in log after sync.
**Log**: Queue behavior observed yes/no, entry synced after reconnect yes/no.

### 17.P9 — IndexedDB caching working
**Steps**: While online, load health data. Open DevTools → Application → IndexedDB → `denali-offline-cache`.
**Expected**: Stores present: `conversations` (24h TTL), `health-data` (24h), `profile` (4h), `diabetes-log` (24h), `diabetes-insights` (24h), `offline-queue`.
**Log**: Stores found, count, data present in each.

---

## Negative Tests

### 17.N1 — Chat API fails offline (network-only)
**Steps**: Go offline. Try to send a chat message.
**Expected**: Fails — `/api/chat` is network-only. Message not sent. Error shown to user.
**Log**: Failure observed yes/no, error message.

### 17.N2 — FHIR authorize fails offline
**Steps**: Go offline. Click "Connect Medicare" (if visible).
**Expected**: Fails — `/api/fhir/authorize` is network-only.
**Log**: Failure behavior.

### 17.N3 — Checkout fails offline
**Steps**: Go offline. Try to trigger checkout.
**Expected**: Fails — `/api/checkout` is network-only.
**Log**: Failure behavior.

### 17.N4 — Offline queue retry limit (3 retries)
**Steps**: Go offline. Queue a diabetes log entry. Simulate persistent network failure (stay offline or mock failure). Check if entry is dropped after 3 retries.
**Expected**: Entry dropped after 3 failed retry attempts.
**Log**: Retry behavior observed. (Mark BLOCKED if retry mechanism not directly observable.)

### 17.N5 — Stale cache TTL expired
**Steps**: In DevTools → IndexedDB, manually modify the timestamp of a `conversations` entry to be >24h old. Then go offline and try to load conversations.
**Expected**: Stale data not served (TTL expired). Empty or fresh fetch required.
**Log**: Stale data behavior. (Mark BLOCKED if IndexedDB manipulation not feasible.)

---

## End of Chunk 17

**You must now**: Write `results/chunk-17-results.md` with every test result, then report summary to user and STOP.
