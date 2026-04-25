# PWA Offline & Low-Bandwidth Reference

Full service worker strategy table, IndexedDB store schemas,
offline write queue flow, and hook integration patterns.
Extracted from CLAUDE.md.

For the active subset (key strategies + load-bearing rules),
see CLAUDE.md "PWA Offline & Low-Bandwidth (summary)".

---


Designed for rural Medicare patients on spotty connections. Caches API responses in IndexedDB for offline viewing, queues writes for replay on reconnect, and provides network-aware UI.

**Dependencies**: `idb` (~1KB gzipped) — typed IndexedDB wrapper. No Workbox/next-pwa (bundle overhead).

### Service Worker Strategies

`public/sw.js` — plain JS, no build step. Routes requests by URL pattern:

| URL Pattern                                                                                                       | Strategy                                 | Cache Name         |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------ |
| `/_next/static/`, `/icon-*`, `/favicon*`, `/logo*`                                                                | Cache-first                              | `denali-static-v2` |
| `/api/chat`                                                                                                       | Network-only                             | —                  |
| `/api/fhir/authorize`, `/api/fhir/callback`, `/api/checkout`, `/api/webhooks/*`                                   | Network-only                             | —                  |
| `/api/conversations`, `/api/fhir/data`, `/api/profile`, `/api/diabetes/log` (GET), `/api/diabetes/insights` (GET) | Network-first, cache fallback            | `denali-api-v2`    |
| Navigation (`mode=navigate`)                                                                                      | Network-first → cached page → `/offline` | `denali-static-v2` |
| Everything else                                                                                                   | Stale-while-revalidate                   | `denali-static-v2` |

**Precached**: `/offline`, `/manifest.json`, `/icon-192.png`, `/icon-512.png`. **Cache versioning**: `CACHE_VERSION = "v3"` — bump on deploy. Old caches deleted on activate. **Update detection**: SW registration checks for updates every 60 min; auto-activates waiting worker.

**CRITICAL: Clone responses synchronously in SW caching strategies.** In `staleWhileRevalidate`, `response.clone()` must happen BEFORE any async `caches.open().then()` — the original response may be consumed by the client before the nested `.then()` runs, causing "Response body is already used" TypeError. Pattern: `const cloned = response.clone(); caches.open(name).then(c => c.put(req, cloned));`

**Middleware**: `sw.js` excluded from middleware matcher (`sw\\.js` in regex).

### IndexedDB Cache

`src/lib/offline-cache.ts` — database `denali-offline-cache` v1 with 6 object stores:

| Store               | Key               | TTL | What's Cached                                                                                                            |
| ------------------- | ----------------- | --- | ------------------------------------------------------------------------------------------------------------------------ |
| `conversations`     | `"list"`          | 24h | `ConversationHistoryItem[]`                                                                                              |
| `health-data`       | `"snapshot"`      | 24h | Full health snapshot (patient, coverage, claims, labs, conditions, medications, screenings, providers, hospitalizations) |
| `diabetes-log`      | `"entries"`       | 24h | `LogEntry[]`                                                                                                             |
| `diabetes-insights` | `"current"`       | 24h | `StoredInsight`                                                                                                          |
| `profile`           | `"profile"`       | 4h  | Non-sensitive profile data (plan, role, appealCount, appealCredits, isAdmin, trialStatus)                                |
| `offline-queue`     | Auto-generated ID | —   | Failed POST requests awaiting replay                                                                                     |

All operations are try/catch guarded — gracefully degrades if IndexedDB is unavailable (private browsing, Safari restrictions).

### Offline Write Queue

Only diabetes log POSTs are queued (not deletes — ordering risk; not chat — requires real-time API).

**Queue flow**: `useDiabetesLog.addEntry()` catch → `queueOfflineRequest()` → optimistic local state update → on reconnect: `window.addEventListener('online')` → `sw.postMessage({ type: 'SYNC_QUEUE' })` → SW reads queue from IndexedDB → replays POSTs → removes on success, drops after 3 retries.

**Dual consumer**: SW processes queue via raw IndexedDB (can't import `idb`). Client-side `offline-sync.ts` provides `processQueue()` / `getQueueCount()` as alternative.

### Hook Integration Pattern

All 5 data hooks follow the same pattern:

```
fetch success → setState() → cacheSet() (fire-and-forget)
fetch failure → cacheGetIfFresh() → setState() from cache (if within TTL)
```

**CRITICAL: Never `await` IndexedDB writes before `setState()`.** Fire-and-forget pattern — blocking on cache writes causes UI hangs.

| Hook                          | Store               | TTL | Offline Behavior                              |
| ----------------------------- | ------------------- | --- | --------------------------------------------- |
| `useConversationHistory`      | `conversations`     | 24h | Shows cached conversation list                |
| `useHealthData`               | `health-data`       | 24h | Shows cached health snapshot                  |
| `useDiabetesLog`              | `diabetes-log`      | 24h | Shows cached entries + optimistic adds queued |
| `useDiabetesInsights`         | `diabetes-insights` | 24h | Shows cached insight                          |
| `useAuth` (`loadProfileData`) | `profile`           | 4h  | Restores plan/role/admin from cache           |

### Network-Aware UI

- **`OfflineBanner`** — fixed below AppHeader (`top-14 sm:top-16 z-30`), amber-left-border accent, auto-dismisses on reconnect. Rendered in root `layout.tsx`.
- **`InactivityWarning`** — fixed below AppHeader (same position as OfflineBanner), amber-left-border accent, shows countdown timer + "Stay signed in" button. Auth-gated: renders nothing for anonymous users. Rendered in root `layout.tsx` below OfflineBanner.
- **Chat page** — `ChatInput` disabled when offline with placeholder "Chat requires an internet connection". Uses `useOnlineStatus()` hook.
- **Offline page** (`/offline`) — shown when navigation fails. Links to cached health records and past conversations.

### Session Inactivity Timeout (HIPAA)

`SESSION_TIMEOUT` constants in `config/ui.ts`. `useIdleTimeout` hook in `hooks/useIdleTimeout.ts`. `InactivityWarning` component in `components/ui/InactivityWarning.tsx`.

- **Warning at 27 min**, **sign out at 30 min** of inactivity (mouse/key/touch/scroll)
- Activity tracking throttled to 1s updates to avoid thrashing
- Check interval: 30s normally, 1s during warning countdown
- Auth-gated via `onAuthStateChange` — no timers for anonymous users
- Sign out calls `getClient().auth.signOut()` — redirect handled by auth state listeners
- "Stay signed in" resets `lastActivity` timestamp and clears warning

### What's NOT Offline

- **Chat**: Requires Claude API + MCP tools — fundamentally online-only
- **Individual conversation messages**: Loaded via API, not cached (v2 candidate)
- **Blue Button OAuth**: Network-only (redirect flow)
- **Stripe checkout/webhooks**: Network-only
- **Push notifications**: Not implemented (permission complexity for elderly audience)

