# Offline & PWA Strategy

Denali is a Progressive Web App (PWA) installable on mobile and desktop. This document covers the current offline capabilities and future considerations.

---

## Current State

### PWA Setup

Denali uses a **manual service worker** (`sw.js`) and `manifest.json` for PWA functionality. The `next-pwa` package was removed from dependencies -- all service worker logic is hand-written.

| Component | File | Purpose |
|-----------|------|---------|
| Service Worker | `public/sw.js` | Cache management, offline fallback |
| Manifest | `public/manifest.json` | App metadata, icons, theme, shortcuts |
| Registration | In app layout | Registers service worker on load |

### App Shell Caching

The service worker caches the app shell on install for instant load:

- HTML shell (layout, navigation)
- CSS bundles
- JavaScript bundles
- Static assets (icons, fonts)

This means the app opens instantly even on slow connections, showing the UI frame before any API calls complete.

### What Works Offline

| Feature | Offline Status | Notes |
|---------|---------------|-------|
| App shell (layout, navigation) | Available | Cached on install |
| Static pages (landing, about) | Available | Cached on install |
| Chat with Claude | Not available | Requires Claude API connection |
| Health data (Blue Button) | Not available | Requires FHIR API connection |
| Coverage guidance tools | Not available | Requires Claude API + outbound calls to government APIs (ICD-10, CMS Coverage, NPI Registry) |
| Settings page (UI) | Available | Static UI renders; API calls fail gracefully |

### Manifest Shortcuts

The manifest defines shortcuts for quick access from the home screen:

| Shortcut | URL | Description |
|----------|-----|-------------|
| Ask Denali | `/app/chat` | Opens chat (with optional topic param) |
| My Health | `/app/health` | Opens health data page |
| Diabetes Care | `/app/diabetes` | Opens diabetes reference page |

---

## API Dependency

Denali's core value requires live API connections:

- **Claude API**: All chat intelligence, coverage guidance, and appeal generation
- **Government APIs** (called from local tool executors): ICD-10 codes (NLM), CMS coverage policies, NPI registry lookups (NPPES)
- **AWS Cognito**: Authentication. **AWS RDS**: Data persistence, denial code lookups.
- **CMS Blue Button**: FHIR data for health records

Without an active internet connection, the app can display its shell but cannot provide substantive functionality.

---

## Future Considerations

### Offline Message Queue

- Queue user messages when offline
- Send queued messages when connection restores
- Show "message will send when online" indicator
- Preserve conversation context across offline periods

### Cached Health Data Summary

- Store a lightweight summary of last-fetched health data locally
- Show read-only view of coverage, recent claims, and lab values
- Display "last updated" timestamp
- Auto-refresh when back online

### Read-Only Mode

- Cache last successful coverage guidance checklist
- Allow users to review previously generated appeal letters
- Show previously fetched denial code explanations
- Mark all cached content with "offline" indicator

### Background Sync

- Use Background Sync API for deferred operations
- Sync appeal outcome reports when connection restores
- Sync consent preference changes
- Sync feedback (thumbs up/down) when reconnected

---

## Technical Notes

- Service worker updates follow a "skip waiting" strategy for fast updates
- Cache versioning ensures stale assets are purged on update
- The app detects online/offline status and adjusts UI accordingly
- API calls include timeout handling for degraded connections
