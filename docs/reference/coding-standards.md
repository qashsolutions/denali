# Coding Standards

Full topic doc — extracted from CLAUDE.md during the 2026-05-13 doc refactor.

---

## Coding Standards

### Principles

- **Modular**: Small, focused units that do one thing well
- **Props-driven**: No hardcoded values, configuration via props/parameters
- **Separation of concerns**: UI, logic, and data access in separate layers
- **DRY**: Extract shared logic into utilities

### Project Structure

```
src/
  app/api/          # API routes (chat, fhir/*, diabetes/*, consent, trial, cms-metadata, account, checkout, webhooks)
  app/app/          # App shell routes (/app, /app/chat, /app/health, /app/diabetes, /app/settings)
  components/
    ui/             # Primitives (Button, Input, Card, Modal, CmsPledge, OfflineBanner)
    chat/           # Chat-specific (Message, ChatInput, Suggestions)
    appeal/         # Appeal-specific (AppealLetter, StatusBadge)
    auth/           # Auth components (EmailOTPModal, TOTPEnrollModal, TOTPChallengeModal)
    layout/         # Layout (AppHeader, BottomTabs, Container)
    health/         # Health page (ConnectMedicare, CoverageCards, DiagnosisSummaryCard, ClaimsTimeline, ProviderSummary, AlertsSection, HealthAlertsBanner, AccountSection, FinancialSummary, AIDisclaimer, StatusBanner, ConditionsAlertBanner, PreDiabetesRiskCard)
    diabetes/       # Diabetes dashboard (A1CTrendChart, ScreeningReminders, RiskAlerts, QuickLog, InsightsCard)
  hooks/            # Custom hooks (useAuth, useChat, useConsent, useHealthData, useDiabetesSnapshots, useDiabetesLog, useDiabetesInsights, useOnlineStatus, useSettings, etc.)
  lib/              # Core libraries (claude.ts, db.ts, auth-server.ts, audit.ts, tools/, skills-loader.ts, denial-patterns.ts, diabetes-insights.ts, offline-cache.ts, offline-sync.ts)
  lib/fhir/         # Blue Button 2.0 (crypto, tokens, client, transforms, context, sync, snapshots)
  lib/skills/       # AI skills injected via skills-loader (health-records, medicare-notifications, diabetes-prevention)
  config/           # Config (api.ts, brand.ts, pricing.ts, ui.ts)
  types/            # TypeScript types (database.ts — RDS schema types)
  styles/           # Global styles + theme
```

### Background Tasks

Domain skills are implemented via Claude tool calling in `/api/chat`, NOT separate functions. Background/async tasks (email checklists, learning queue) are handled by API routes (e.g., `/api/email/checklist`). Legacy Supabase edge functions have been removed.

---

