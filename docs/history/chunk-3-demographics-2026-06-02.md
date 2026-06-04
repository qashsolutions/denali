# Chunk 3 — Demographics capture (sex_at_birth + gender_identity)

Work landed prod 2026-06-02 on task def `denali:198`. Adds two USCDI-aligned demographic fields to the `users` table and a new gating cookie (`sex_at_birth_status`) that extends the post-auth onboarding interstitial from 1 question (Medicare) to 3 questions (sex_at_birth required, Medicare required, gender_identity optional). Picks up the "Gender capture" deferred item from Chunk 2.

---

## What shipped (and where)

| Surface | Prod (`origin/main` @ `606319d`) | Staging (`origin/develop` @ `606319d`) |
|---|---|---|
| Schema: `users.sex_at_birth` + `users.gender_identity` (nullable TEXT) | ✓ applied 2026-06-02 | ✓ applied 2026-06-02 |
| Middleware gate: `sex_at_birth_status` cookie required on `/app/*` | ✓ on `denali:198` | ✓ on `denali-staging:100` |
| 3-question onboarding interstitial | ✓ on `denali:198` | ✓ on `denali-staging:100` |
| `PATCH /api/profile` accepts new fields with `isValid*` narrowing | ✓ on `denali:198` | ✓ on `denali-staging:100` |
| `GET /api/profile` returns new fields | ✓ on `denali:198` | ✓ on `denali-staging:100` |
| Settings page exposes both fields as dropdowns (v1: 3 options for sex_at_birth) | ✓ on `denali:198` | ✓ on `denali-staging:100` |
| Settings "Required" UX: red asterisk + bold-red "Required." | ✓ on `denali:198` | ✓ on `denali-staging:100` |

Main and develop are in sync at `606319d`. Backup branch `backup/main-pre-chunk3-2026-06-02` pinned at `2e5cc9c` (origin/main HEAD pre-merge) for one-command rollback if needed.

---

## Architecture decisions worth remembering

### Cookie-as-routing-signal pattern (Chunk 2 extension)

Chunk 2 introduced the `medicare_status` cookie as the middleware routing signal. Chunk 3 follows the same pattern for sex_at_birth — `sex_at_birth_status` cookie drives middleware redirect, DB is source of truth for business logic.

Middleware gate (`app/src/middleware.ts`):
```ts
if (
  hasAccessToken &&
  pathname.startsWith("/app") &&
  (!request.cookies.has("medicare_status") ||
    !request.cookies.has("sex_at_birth_status"))
) {
  return NextResponse.redirect(new URL("/onboarding/medicare", request.url));
}
```

Both cookies must be present to skip the interstitial. Cookie is **presence-checked only** — never read for business logic. Same attribute profile as `medicare_status`: HttpOnly + Secure (prod) + SameSite=Lax + Max-Age=30d.

Three write sites mirror the Chunk 2 pattern:
1. `verify-otp` — post-auth, sets cookie if `users.sex_at_birth` is non-null
2. `/api/profile` PATCH — set cookie on non-null value, clear with `Max-Age=0` when set to null
3. `/api/profile` GET — heals the cookie for legacy active sessions

The PATCH clear branch is the one asymmetry vs. medicare_status: the Medicare toggle in Settings never accepts null, but sex_at_birth at the API layer does (a user can clear it via PATCH `{"sex_at_birth": null}`). The cookie sync covers that branch.

### USCDI value-set discipline at the app layer

Both new columns are nullable `TEXT` with no DB CHECK constraints. Validation lives in `app/src/types/user-demographics.ts` as TypeScript string-literal unions:

```ts
export type SexAtBirth = "male" | "female" | "intersex" | "unknown";
export type GenderIdentity =
  | "male" | "female" | "non-binary"
  | "transgender-male" | "transgender-female"
  | "other" | "prefer-not-to-say";
```

Plus `isValidSexAtBirth` / `isValidGenderIdentity` type-guard functions that narrow `unknown` to the union. Runtime narrowing happens at all read/write boundaries:
- `PATCH /api/profile` validates body fields before write
- `GET /api/profile` narrows DB strings before returning to client
- `verify-otp` narrows DB value before deciding to set the cookie
- `useAuth.ts` narrows cached profile + API response payloads before storing

Rationale: USCDI value sets occasionally evolve. App-layer validation is more flexible to change than `ALTER CONSTRAINT` on a high-row-count table, and the type guards double as defense against schema drift (rows manually edited via SQL that wouldn't pass app validation are rejected at read time).

### Strict 3-option v1 UI for sex_at_birth (4-value enum)

The `SexAtBirth` enum has 4 values but the v1 UI picker (`SEX_AT_BIRTH_UI_OPTIONS`) exposes only 3: **Male / Female / Prefer not to say** (which writes `"unknown"`). The "intersex" value is API-settable for future use but not in the v1 picker. Documented edge case in Settings: when `authState.sexAtBirth === "intersex"`, the dropdown shows blank (conditional empty `<option>` ensures the browser doesn't auto-select the wrong option).

Both the onboarding form and the Settings page consume `SEX_AT_BIRTH_UI_OPTIONS` from the shared `user-demographics.ts` module — single source of truth.

### "Required" affordance differs by surface

The two surfaces signal required-ness differently, deliberately:

- **Onboarding interstitial**: disabled Continue button until both required fields are answered. `canSubmitOnboarding(sexAtBirth, isOnMedicare)` returns false until both are non-null. The disabled-button affordance is the required signal — no asterisk needed.
- **Settings page**: a populated form, so the Continue affordance doesn't exist. Required signal is **red asterisk** on the label + **bold-red "Required." prefix** in the helper text. `aria-required="true"` on the `<select>` for assistive tech; asterisk is `aria-hidden="true"` so screen readers announce "required" via the ARIA attr, not the literal asterisk character.

Color choice: `text-red-600 dark:text-red-400` — matches 9 existing sibling error-text usages in the Settings page rather than the unused `--color-error` CSS variable that exists in globals.css. Mixing conventions in one file was deemed worse than the variable choice.

### Additive-PATCH semantics for optional fields

`PATCH /api/profile` honors **additive semantics**: omitting a key means "don't touch this column." Inclusion semantics:
- `is_on_medicare` / `sex_at_birth`: included when set (both required at submission)
- `gender_identity`: included only when the user picked a value, omitted when null

This lets the onboarding form submit a partial payload (e.g., user skipped the optional gender_identity dropdown) without needing to send `{gender_identity: null}` and triggering an unintended UPDATE. The `buildOnboardingPayload` helper enforces this.

### Pure-helper extraction pattern (testability)

`MedicareOnboardingForm.tsx` exports four pure helpers — `canSubmitOnboarding`, `buildOnboardingPayload`, `submitOnboarding`, `healMedicareCookie` — so vitest (node env, no jsdom/RTL) can cover the form logic without rendering. Render + interaction tests are deferred to Playwright. This is the same convention adopted across the Chunk 2 onboarding work.

---

## Files (production code + tests + scripts)

Schema:
- `scripts/migrate-stage-3-gender-2026-06-02.sql` — idempotent `IF NOT EXISTS ... ALTER TABLE` for both columns

Production code:
- `app/src/types/user-demographics.ts` (new) — value sets, labels, UI options, type guards
- `app/src/types/index.ts` — re-export `SexAtBirth` / `GenderIdentity`, extend `User` interface
- `app/src/lib/session-state.ts` — `SessionState.sexAtBirth?` + `genderIdentity?`
- `app/src/middleware.ts` — both-cookies-required gate
- `app/src/app/api/auth/verify-otp/route.ts` — pulls + narrows new fields, sets `sex_at_birth_status` cookie
- `app/src/app/api/profile/route.ts` — PATCH allowlist + 400 with `field` discriminator; GET returns new fields with narrowing
- `app/src/app/onboarding/medicare/page.tsx` — server SELECT both fields; `alreadyAnswered = is_on_medicare !== null && sex_at_birth !== null`
- `app/src/app/onboarding/medicare/MedicareOnboardingForm.tsx` — rewritten as 3-question form + 4 pure helpers
- `app/src/app/app/settings/page.tsx` — two new dropdowns (sex_at_birth required with red asterisk + bold-red "Required." prefix; gender_identity optional); `aria-required="true"` on the sex_at_birth select
- `app/src/hooks/useAuth.ts` — propagate sex_at_birth + gender_identity through `AuthState`, cached profile, API derivation paths

Tests: +36 net (820 → 856), 1 new file:
- `app/src/types/__tests__/user-demographics.test.ts` (new) — 11 tests for value sets, labels, UI options, type-guard rejections
- `app/src/__tests__/middleware.test.ts` — 9 fixture extensions + 1 new gate test
- `app/src/app/api/auth/verify-otp/__tests__/route.test.ts` — fixture extension + 2 new tests
- `app/src/app/api/profile/__tests__/route.test.ts` — 7 PATCH + 5 GET new tests
- `app/src/app/onboarding/medicare/__tests__/MedicareOnboardingForm.test.ts` — restructured for new helpers
- `app/src/app/onboarding/medicare/__tests__/page.test.ts` — fixture extensions
- `app/src/lib/__tests__/profile-cadence.test.ts` — minimal fixture sync for AuthState shape change

Infrastructure:
- Migration applied to staging RDS 2026-06-02 (denali-staging task def `:99` window)
- Migration applied to prod RDS 2026-06-02 (denali task def `:197` window, pre-deploy)
- Backup branch `backup/main-pre-chunk3-2026-06-02` @ `2e5cc9c` pushed to origin

---

## Deferred work (tracked, intentionally not in Chunk 3)

| Item | Why deferred | Where it'll be picked up |
|---|---|---|
| Playwright E2E coverage of the 3-question interstitial render + submit flow | vitest is node-only; pure helpers cover the logic | Playwright pass (catalog in Step 8 report) |
| Settings page Playwright coverage (asterisk visible, aria-required reflects state, PATCH-on-change) | Same — render/interaction belongs in Playwright | Same Playwright pass |
| "intersex" UI option (4th picker entry) | Out of v1 scope; documented edge in Settings | Future UX pass if/when product wants it |
| Mid-session sync of `sex_at_birth_status` cookie via background refetch | Cookie is set at three write sites covering all normal flows; mid-session edit is rare | Operator follow-up if a regression is observed |
| `gender_identity` use in chat context / pronoun handling | Currently captured but not consumed by Claude prompts | Chunk 4+ (when chat needs it) |
| `sex_at_birth` use in clinical-context skill (lab reference ranges) | Field is justified-by-use in the form copy but not wired into a skill yet | Chunk 4+ |

---

## Verification checklist (what was confirmed)

- Prod RDS column metadata pre-migration: both columns absent ✓
- Prod RDS column metadata post-migration: `gender_identity` + `sex_at_birth` exist, `is_nullable=YES`, `column_default=null` ✓
- Prod RDS data integrity: `total=3, sex_set=0, gender_set=0` (no rows unintentionally modified) ✓
- Prod ECS: `denali:198`, rollout COMPLETED, 1/1 running ✓
- Prod HTTPS: `HTTP 200` from `/api/health`, body `{"status":"ok"}` ✓
- Staging V1: ramanac's row reflected `is_on_medicare=true, sex_at_birth='male', gender_identity=null, plan='trial'` after operator completed the 3-question interstitial ✓
- 856/856 vitest passing locally pre-merge + on GH Actions pre-deploy ✓
- Manual V1 on prod: held for operator (3 existing users — ramanac, ceeveear, third operator-known account — will hit the new interstitial on next sign-in, intentional)

---

## Operator notes — existing prod users post-Chunk-3

All three pre-existing prod users have `sex_at_birth = null` post-migration (newly-added nullable column). They will encounter the 3-question interstitial on their next `/app/*` navigation:

- `ramanac@gmail.com` — admin, `is_on_medicare=null` (cleared in Chunk 2 cleanup). Will hit interstitial; will see all 3 questions fresh.
- `ceeveear@yahoo.com` — `is_on_medicare=true` (set in Chunk 2 cleanup). Will hit interstitial; will need to re-affirm Medicare answer plus pick a sex_at_birth (gender_identity remains optional).
- Third operator-known trial account — `is_on_medicare=false` (pre-Chunk-2 default carried through). Will hit interstitial; non-Medicare cohort UX continues as in Chunk 2.

This is intentional and load-bearing — the interstitial picks up the new gate, not "a bug to test by clicking through."

---

## See also

- `CLAUDE.md` § Stage 3 — Demographics capture (load-bearing rules for future sessions)
- `docs/history/chunk-2-cohort-gate-2026-05-27.md` — Chunk 2 + 2.5a + 2.7 + 2.8 history (Chunk 3 picked up the "Gender capture" deferred item from this doc)
- `docs/reference/merge-patterns.md` § 2 — ECS-exec schema migration pattern (used for both staging and prod Chunk 3 migrations)
- `scripts/migrate-stage-3-gender-2026-06-02.sql` — the applied migration file
