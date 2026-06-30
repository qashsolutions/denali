# Denali — Phase 1 mobile

Local-first native app for the 45+ U.S. audience that integrates with Denali's existing Next.js/ECS/Cognito/RDS/Bedrock backend. Spec: [`docs/design/phase-1-45plus.md`](../docs/design/phase-1-45plus.md). Path-scoped rules: [`mobile/CLAUDE.md`](./CLAUDE.md). Frozen contracts that consumer agents depend on: [`mobile/src/contracts/`](./src/contracts).

## Quick start

```bash
nvm use            # Node 20 (matches CI)
npm install
npm run start      # Expo dev server
npm run typecheck  # tsc --noEmit
npm run test:run   # vitest single-pass
```

## Test runner choice — vitest

We use **vitest** (node environment, no jsdom) over `jest-expo` to match the web app's convention documented in `docs/reference/testing.md`. Two practical wins: one mental model for engineers moving between `app/` and `mobile/`, and the same `vitest run` / `vitest --watch` commands. Component-level React Native tests will be added by the surface builders (Wave 1+) using `@testing-library/react-native` on top of vitest if/when they need them; Pass 1 ships the runner only.

## Layout

```
mobile/
├── App.tsx                  Root entry — NavigationContainer + RootNavigator
├── app.config.ts            Expo config (extra.apiBaseUrl, no secrets)
├── src/
│   ├── config/env.ts        API_BASE_URL only
│   ├── contracts/           FROZEN — do not redefine in consumers
│   ├── navigation/          Stack + bottom-tab graph
│   └── screens/             9 placeholder screens, each with TODO + imports
├── tsconfig.json            strict: true, @/* → src/*
└── vitest.config.ts         node env
```

## What lives where (waves)

| Wave | Owner | Lands under |
|------|-------|-------------|
| 0 | main thread + `mobile-app-shell` Pass 1 | `mobile/src/contracts/`, the Expo scaffold, placeholder screens |
| 1 | `mobile-theme-bridge` | `src/theme/` |
| 1 | `mobile-local-data-modeler` | `src/db/dal/`, `src/db/migrations/` |
| 1 | `mobile-auth-wirer` | `src/auth/` (+ a `X-Client-Type: mobile` branch in the web's `verify-otp` / `refresh` routes) |
| 2 | `mobile-onboarding-builder` | `src/onboarding/`, fills `CohortOnboardingScreen` / `IntakeOnboardingScreen` / `InstrumentsScreen` |
| 2 | `mobile-upload-parse-builder` | `src/upload/`, plus net-new `app/src/app/api/parse-report/route.ts` |
| 3 | `mobile-app-shell` Pass 2 | fills `TimelineScreen` / `ChatScreen` / `SettingsScreen`, wires navigation gating, e2e smoke |

Wave N+1 must NOT begin before Wave N's contracts are implemented. The hook at `.claude/hooks/guard-contracts.sh` freezes `mobile/src/contracts/**` once the operator runs `touch mobile/.wave-0-complete`; after that, contract edits require explicit unfreeze. See `mobile/CLAUDE.md` § Hooks.
