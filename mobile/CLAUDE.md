# Phase 1 Mobile — Rules & Contracts (auto-loaded under `mobile/`)

This file is loaded automatically whenever Claude Code operates under `mobile/`, concatenated with the root `CLAUDE.md`. Keep edits to it minimal — these rules are load-bearing.

Spec: @docs/design/phase-1-45plus.md (read it before implementing).

---

## Non-negotiable invariants

1. **Local-first.** No health data persisted server-side in Phase 1 — chat included.
2. **Encrypted at rest.** SQLCipher DB; uploaded files stored as encrypted on-device blobs.
3. **Login ≠ encryption key.** The SQLCipher key is generated on-device, stored in Keychain/Keystore, never transmitted, never derived from any Cognito/server secret.
4. **Append-only time-series.** `UNIQUE(user_id, code, effective_at)` + `ON CONFLICT DO NOTHING`; corrections add a superseding row, never UPDATE/DELETE values.
5. **Transient analysis only.** Decrypt → send over TLS → infer → return → store on-device. Nothing persisted server-side. Bedrock invocation logging must be OFF (manual AWS check).
6. **No longitudinal model and no cloud backup in Phase 1.**

---

## Contract rule

Import `LocalDataDAL`, `Theme`, `ApiClient` (and their auxiliary types) from `mobile/src/contracts`. **Never redefine these shapes locally** in any consumer module. The frozen contracts are the seam between the foundation agents (Wave 1) and the consumer agents (Wave 2 + Pass 2). After Wave 0, changes to `mobile/src/contracts/**` should be additive only — never breaking.

---

## Wave & ownership map

| Wave | Who | What | Depends on |
|---|---|---|---|
| 0 | main thread + `mobile-app-shell` Pass 1 | contracts at `mobile/src/contracts/`; Expo scaffold + navigation + placeholder screens | — |
| 1 (parallel) | `mobile-theme-bridge` | `Theme` implementation at `mobile/src/theme/tokens.ts` | Wave 0 contracts |
| 1 (parallel) | `mobile-local-data-modeler` | `LocalDataDAL` impl at `mobile/src/db/dal/` + migrations | Wave 0 contracts |
| 1 (parallel) | `mobile-auth-wirer` | `ApiClient` impl at `mobile/src/auth/` + additive `X-Client-Type: mobile` branch in `app/src/app/api/auth/{verify-otp,refresh}/route.ts` | Wave 0 contracts |
| 2 (parallel) | `mobile-onboarding-builder` | cohort interstitials + intake + validated instruments + 988 surface | Wave 1 complete |
| 2 (parallel) | `mobile-upload-parse-builder` | upload pipeline + net-new `/api/parse-report` route | Wave 1 complete |
| 3 | `mobile-app-shell` Pass 2 | timeline view + navigation wiring + e2e smoke | Waves 1+2 complete |
| after each wave | `mobile-privacy-invariant-guard` | read-only audit against 6 invariants + conformance checklist | the wave's diffs |

**Wave N+1 must NOT begin before Wave N's contracts are implemented.** File-disjointness prevents merge conflicts; it does not prevent dependency conflicts.

---

## Step discipline

**Before implementing in any agent:**
- Re-read `@docs/design/phase-1-45plus.md`.
- Re-read this file (`mobile/CLAUDE.md`).
- Re-read your contract at `mobile/src/contracts/<your-contract>.ts`.
- Re-read your agent definition at `.claude/agents/<your-agent>.md`.

**Before declaring done:**
- Self-check against the Conformance checklist below and report each item as PASS / FAIL / N/A.

---

## Conformance checklist (every wave must pass)

- [ ] All 6 invariants hold (top of this file).
- [ ] **No contract redefinition.** `LocalDataDAL` / `Theme` / `ApiClient` exist only in `mobile/src/contracts/`. Consumers import; nobody copies the shapes.
- [ ] **UI uses `Theme` tokens via `useTheme()`** (or NativeWind seeded from the same values). No hardcoded colors / spacing / radii in components.
- [ ] **Wave order respected.** Wave N+1 work did not begin before Wave N's contracts were implemented.
- [ ] **Acting agent stayed within its defined scope** (no scope creep into another agent's surface).
- [ ] **No-server-persistence assertions pass:** the `query()` spy on `POST /api/parse-report` shows zero RDS inserts; the chat path writes nothing to `conversations`/`messages` under `X-Client-Type: mobile`; the byte-identical-web-path regression test for `verify-otp` / `refresh` is green.

The `mobile-privacy-invariant-guard` runs this checklist after every wave. The two AWS manual checks (**Bedrock invocation logging OFF**, **Cognito `RefreshTokenValidity` ≥ 30 days**) are reported on every audit output even on clean reviews.

---

## Hooks (drift enforcement, not just guidance)

Two of the load-bearing invariants are hard-gated by hooks. They run regardless of what the agent decides.

- **Contract protection (wired now).** `.claude/hooks/guard-contracts.sh` is a `PreToolUse` hook on `Write` / `Edit` that blocks any modification to `mobile/src/contracts/**` **after Wave 0 is marked complete**. Wave 0 completion is signaled by the operator creating `mobile/.wave-0-complete` (e.g., `touch mobile/.wave-0-complete`). To intentionally change a contract afterwards: `rm` the marker, make the additive-only edit, `touch` the marker again, and update `docs/history/phase-1-mobile-decisions.md`. Breaking-change edits should not happen — surface a deviation instead.
- **No-server-persistence (deferred to Wave 1).** `mobile-auth-wirer` ships `.claude/hooks/guard-persistence.sh` as part of Wave 1, alongside the first regression test (`verify-otp` byte-identical-web-path). The hook runs the full persistence test suite fail-closed on every Edit/Write and auto-covers later tests as they land (`mobile-upload-parse-builder`'s `query()`-spy in Wave 2; Pass 2's chat no-persist assertion in Wave 3). Until then, the privacy-guard's conformance checklist is the gate.

## What lives where

- Spec: `docs/design/phase-1-45plus.md`
- Contracts: `mobile/src/contracts/{LocalDataDAL,Theme,ApiClient,index}.ts`
- Decision record: `docs/history/phase-1-mobile-decisions.md`
- Agents: `.claude/agents/mobile-*.md`
- Hooks: `.claude/hooks/guard-contracts.sh` (wired), `.claude/hooks/guard-persistence.sh` (Wave-1 deliverable, deferred)
