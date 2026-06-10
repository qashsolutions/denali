# Maestro Phase-3 E2E flows

End-to-end Maestro flows that drive the Denali mobile app
(`appId: health.denali.mobile`) on a running emulator/simulator. These
are the Phase-3 deliverable referenced by `../README.md` and the
"Verification layering" rule in `../../CLAUDE.md` (Maestro is the screen
gate — the proof a UI path is end-to-end live, on every PR).

Selectors are drawn ONLY from the testID / accessibilityLabel inventory
in [`../README.md`](../README.md). No coordinate-based taps anywhere.

## ⚠️ Gate — these flows need an E2E test-OTP backend (NODE_ENV ≠ production)

Every flow signs in through the E2E test-OTP bypass
(`app/src/lib/e2e-test-otp.ts`, invoked from
`app/src/app/api/auth/verify-otp/route.ts`):

| Field | Value |
|---|---|
| Email | `e2e@denali.health` |
| OTP code | `999999` |

That bypass is protected by a five-guard stack (see the module docstring
+ `../../CLAUDE.md` "Test-only auth paths") and is **structurally
unreachable in production**. Critically, that protection means **the
bypass only works when the backend runs `NODE_ENV !== "production"`**:
guard G2 denies on `NODE_ENV==="production"`, and a module-load assertion
*crashes `verify-otp`* if the flag is set while `NODE_ENV==="production"`.

**`next start` forces `NODE_ENV=production` on every deployed service —
staging included.** So these flows do **NOT** run against the deployed
staging URL with the flag set there (that would 500 sign-in). They run
against a **local `next dev` or CI backend** (NODE_ENV ≠ production),
which may still point at the staging Cognito pool / RDS / sandbox CMS.

**Before any flow can pass**, stand up that backend per
`../../../STAGING-LOCKDOWN.md` → "E2E test-OTP bypass — operating
instructions" (process env + Cognito user + DB row), then **point the
mobile build under test at it** (`API_BASE_URL` → the local/CI host),
not at deployed staging or prod. Note the two known caveats there (the
`STAGING_EMAIL_ALLOWLIST` gate and `send-otp` rotating the Cognito
password) — the current code has an unresolved tension the run must work
around. Until the backend is in place, the sign-in step fails and every
flow is red by design: the bypass fails closed.

## Flows

| File | What it proves |
|---|---|
| `signin_onboarding.yaml` | Sign-in (test-OTP) → PrivacyNotice → Cohort (birth year / sex at birth / Medicare / gender identity) → Intake → lands on MainTabs Timeline tab ("Your health"). The onboarding happy path. |
| `instrument_checkin.yaml` | Dashboard → Anxiety domain card → DomainDetail → "Start a check-in" → complete GAD-7 (7 items) → return to the Anxiety detail. Reuses `signin_onboarding.yaml`. |
| `crisis_988.yaml` | **LOAD-BEARING.** Drives the mood path into PHQ-9, answers item 9 positively, asserts the `Crisis988Modal` appears with call/text/acknowledge affordances, taps acknowledge, asserts the flow continues. Self-contained (does not reuse flow 1 — it needs to drive the mood path positively). |
| `trend_chart.yaml` | Generates a 2nd mood session, then Dashboard → mood DomainDetail → asserts `trend_chart_PHQ-2` + `trend_delta` render and exercises the range control (3M/6M/Y/All). Reuses `signin_onboarding.yaml`. |

### The 988 flow is a release blocker, not a flaky test

`crisis_988.yaml` is the single most important assertion in the suite.
The product rule (InstrumentsScreen + `Crisis988Modal`) is: *never
silently record a positive PHQ-9 item 9 without surfacing 988.* If the
`crisis988_modal` assertion fails after a positive item-9 response, the
safety surface has regressed — treat it as a blocker. The flow asserts
the call/text affordances are **present** but never taps them (`tel:988`
/ `sms:988` would hand off to the dialer/SMS app — out of scope and
unsafe to trigger in automation).

## How to run

Maestro CLI lives at `~/.maestro/bin/maestro` (see `../README.md`
"Toolchain"). With the emulator/simulator running, the app installed and
pointed at an E2E backend (NODE_ENV ≠ production, test-OTP env set):

```bash
# A single flow:
~/.maestro/bin/maestro test mobile/maestro/flows/signin_onboarding.yaml
~/.maestro/bin/maestro test mobile/maestro/flows/instrument_checkin.yaml
~/.maestro/bin/maestro test mobile/maestro/flows/crisis_988.yaml
~/.maestro/bin/maestro test mobile/maestro/flows/trend_chart.yaml

# The whole flows directory:
~/.maestro/bin/maestro test mobile/maestro/flows/
```

`instrument_checkin.yaml` and `trend_chart.yaml` use `runFlow:
signin_onboarding.yaml` to reach the dashboard, so they are runnable on
their own. Each flow launches with `clearState: true` (via
`signin_onboarding.yaml` or its own `launchApp`) so runs are independent.

## Data preconditions baked into the flows

- **Cohort answers.** The flows pick `sex at birth = Male`,
  `Medicare = Yes`, `gender = Male`, birth year `1965`. Male keeps the
  unisex domains (Mood / Anxiety / Sleep / Alcohol) plus the male-gated
  ones available; the flows only touch unisex domains.
- **Trend needs n ≥ 2.** A `trend_chart_*` only renders once a domain has
  ≥ 2 completed sessions in range (`TrendChart` shows `trend_empty_state`
  at n < 2). `trend_chart.yaml` therefore records a *second* mood session
  itself rather than assuming pre-seeded history — keeping it
  self-contained against a freshly-cleared app.
- **PHQ-2 → PHQ-9 expansion.** `crisis_988.yaml` answers PHQ-2 items 1 & 2
  with value `2` each (sum 4 ≥ the threshold of 3) to expand into the full
  PHQ-9 and reach item 9. `signin_onboarding.yaml` and `trend_chart.yaml`
  answer PHQ-2 with value `0` to stay short of expansion and never touch
  the 988 surface.

## testID inventory gaps (for the operator / next session)

The flows reference testIDs that **exist in the app source** (verified
read-only in `src/screens/HealthDashboardScreen.tsx`,
`src/screens/timeline/DomainCard.tsx`, `src/screens/DomainDetailScreen.tsx`)
but are **NOT yet listed in the selector inventory at `../README.md`**.
They were added in the Phase-3 increment-1 dashboard work, after the
Phase-1 inventory was written. No app change is needed — only a
documentation backfill into `../README.md`:

| testID (in app, missing from `../README.md`) | Element | Used by |
|---|---|---|
| `dashboard_card_${domainId}` (e.g. `dashboard_card_mood`, `dashboard_card_anxiety`, `dashboard_card_sleep`) | DomainCard container on the dashboard — all three variants (instrument / single / empty) carry it; tapping navigates to `DomainDetail` | `instrument_checkin.yaml`, `trend_chart.yaml` |
| `dashboard_card_pill` | Range / status pill inside a DomainCard | (none yet — documented for completeness) |
| `dashboard_today_label` | "today's date" line under the "Your health" header | (none yet) |
| `dashboard_all_activity` | "All activity" footer entry (legacy chronological feed) | (none yet) |
| `dashboard_disclaimer` / `dashboard_provisional_footnote` | Standing disclaimer + ‡ legend on the dashboard | (none yet) |
| `domain_detail_back` | Back chevron in the DomainDetail header | (none yet) |
| `domain_detail_provisional_footnote` | ‡ legend on the DomainDetail screen | (none yet) |

Non-testID selectors the flows assert by visible text (part of the UX
contract, allowed per `../README.md` "Selector policy"):

- `"Your health"` — HealthDashboardScreen header (the Timeline-tab landing
  assertion).
- `"Anxiety"` — DomainDetail header title for the anxiety domain
  (return-to-detail assertion in `instrument_checkin.yaml`).
- `"Timeline tab"` — MainTabs accessibility label (already in
  `../README.md`).

No mismatch was found between any selector a flow needs and the actual
app source — every gap above is a *documentation* gap in `../README.md`,
not a missing or wrong testID in the app.
