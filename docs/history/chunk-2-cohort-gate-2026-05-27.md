# Chunk 2 — Medicare cohort gate + non-Medicare trial + free-tier model routing

Work landed 2026-05-27 / 2026-05-28. Adds the first cohort-aware behavior to the app: Medicare vs non-Medicare branching at middleware, appeals, paywall, chat-tool, and trial-rate-limit layers. Also routes free-tier users to Haiku 4.5 (staging-only as of 2026-05-28).

---

## What shipped (and where)

| Surface | Prod (`origin/main` @ `7c8fc09`) | Staging (`origin/develop` @ `1bca8b6`) |
|---|---|---|
| Schema: `users.is_on_medicare` nullable + data fixes | ✓ applied 2026-05-28 | ✓ applied 2026-05-27 |
| Chunk 2 core (gate + appeals + paywall + trial rate limit) | ✓ on `denali:195` | ✓ on `denali-staging:97` |
| Chunk 2.7 banner suppression | ✓ on `denali:195` | ✓ |
| Chunk 2.8 flaky-test fix | ✓ on `denali:195` | ✓ |
| **Chunk 2.5a Haiku trial routing** | **— not deployed —** | **✓ on `denali-staging:97`** |

Develop is one commit ahead of main pending Chunk 2.5a's prod env-var setup + V1 verification.

---

## Architecture decisions worth remembering

### Cookie-as-routing-signal pattern

Middleware needs to gate `/app/*` for users who haven't answered the Medicare question — but middleware can't call the DB on every request without crushing latency. Solution: a `medicare_status` cookie (`"yes"` / `"no"` / absent), set at three write sites:

1. `verify-otp` route — on successful auth, queries `users.is_on_medicare` and sets the cookie if non-null.
2. `/api/profile` PATCH — on toggle, syncs the cookie to the new value.
3. `/api/profile` GET — heals the cookie for legacy active sessions (the cookie write isn't in their session yet because verify-otp predated the gate).

Cookie attributes on all three: `HttpOnly`, `Secure` (prod only), `SameSite=Lax`, `Path=/`, `Max-Age=30d`. Middleware checks **presence**, not value — but the value distinction is preserved for future use.

**Critical**: the DB is the source of truth for actual feature gates (`/api/appeals` 403, `/api/checkout` 403, chat-tool filter, paywall filter all re-fetch from DB). Cookie is for **routing** only. Do not read `medicare_status` in business-logic code paths.

### Strict `=== true` for Medicare-only features

Throughout the cohort-aware code, `is_on_medicare === true` (strict) gates Medicare features. `null` and `false` both fall to the non-Medicare path. This treats the "unknown" cohort the same as the "explicitly non-Medicare" cohort — a deliberate safety choice: when in doubt, suppress the Medicare-specific surface rather than risk a misleading display.

Examples in code:
- `chat/page.tsx` EmptyState filter — appeal card hidden when `authState.isOnMedicare !== true`
- `chat/page.tsx` consent banner — `shouldShowMedicareConsentBanner` returns false for null
- `chat/route.ts` `generate_appeal_letter` filter — tool absent when `sessionState.isOnMedicare !== true`
- `/api/appeals`, `/api/appeal-outcome`, `/api/checkout` (starter only) — 403 unless DB row shows `=== true`

### Plan-based vs cohort-based routing (Chunk 2.5a)

Model routing is **plan-based**, not Medicare-based. Any user whose `users.plan = 'trial'` (Medicare or non-Medicare) routes to Haiku 4.5 for chat. Paid users (`plus`, `unlimited`, `starter`) get Sonnet 4.6. Appeals always use Opus 4.6 regardless of plan — appeals are a conversion driver and warrant full quality.

Precedence: **appeal > trial > paid default**.

### Strict-isTrial check protects paid users on RDS timeout

`chat/route.ts:596` has `const isTrial = userProfile != null && (userProfile.plan ?? "trial") === "trial"`. The `userProfile != null` guard is intentional — without it, an RDS timeout (where `userProfile` becomes null via `withFallback`) would silently downgrade paid users to Haiku for that request. The strict check resolves to `false` on null, so paid users stay on Sonnet. Defense-in-depth: the chat route's trial-expired check at line 230-238 already fires 403 before model selection in this state anyway, but the strict isTrial guard is the second layer.

### Non-Medicare trial window: `users.created_at + 3 days`

For non-Medicare users on `plan='trial'`, the trial window is **3 calendar days from `users.created_at`** (NOT from `subscriptions.trial_end`, which the Medicare path uses for its 14-day trial). Daily message limit is 3 messages per UTC day; no weekly frequency cap. Past 3-day window returns 403 `TRIAL_EXPIRED` with `upsell: true` (paywall). Within window + over 3 msgs returns 429 `NON_MEDICARE_DAILY_LIMIT` with copy *"You've used your 3 messages for today. Come back tomorrow."* — note **no upgrade CTA**, no `upsell` field.

The boundary check is strict `> 3 days` (3 days alive, 3 days + 1ms expired). T9-5 originally tested this with a 1ms margin which was flaky on CI runners — see Chunk 2.8 below.

---

## Migration sequence (staging → prod)

### Staging: 2026-05-27

`scripts/migrate-medicare-gate-2026-05-27.sql` applied via the documented ECS-exec pattern (`docs/reference/merge-patterns.md` § 2) targeting cluster `denali-staging` / service `denali-staging-web`. Column flipped `NOT NULL → NULL`, default flipped `false → NULL`. Data fixes (scoped by email in the SQL): two existing admin/test rows adjusted — one flipped to `is_on_medicare=true` so the operator can exercise the Medicare-bypass path, one cleared to NULL so the operator can exercise the interstitial path. Identifying emails are in the migration source file, not duplicated here.

**Migration safety note worth knowing for future migrations**: the doc's safety grep (`DROP\s|TRUNCATE|DELETE\s+FROM`) flagged `ALTER COLUMN ... DROP NOT NULL` as a destructive op. It isn't — `DROP NOT NULL` is constraint relaxation, not data destruction. The migration was rewritten with `DO $$ ... IF EXISTS ... END $$` idempotence guards and a SAFETY NOTE comment block before being applied. Pattern documented in the migration file itself.

### Prod: 2026-05-28 (PRE-MERGE, P8)

Applied **before** the develop→main merge so the new code never sees a non-nullable column. Migration is forward-compatible (nullable is a superset of NOT NULL) — pre-Chunk-2 code reading the column gets the same boolean values it always did; only the one operator-owned admin row that was deliberately cleared by the migration shows NULL, which the pre-Chunk-2 code coerces to `false` via `is_on_medicare ?? false` in `chat/route.ts:345`.

### Surprise during prod migration: undocumented account on prod

PRE1 inspection of prod RDS found **three** users, not the two CLAUDE.md documented at the time. The third was a trial account created 2026-05-26 that wasn't in the docs. STOP condition triggered. Operator confirmed the account is operator-known (identifying details intentionally omitted from this public doc). Migration applied — the third account's row was untouched (data fixes are scoped by email to two specific operator-owned accounts in the migration source). Its pre-existing `is_on_medicare=false` value stays unchanged. Post-Chunk-2 behavior path: middleware redirects to `/onboarding/medicare`; the page sees `is_on_medicare=false` (not null), so the form's "already answered" effect bounces the user to `/app/chat` with the non-Medicare cohort UX. Trial window from `created_at=2026-05-26` runs through ~2026-05-29.

CLAUDE.md's "Known test accounts on prod" updated to reflect the three-account count without naming the third account.

---

## Deploy sequence + recovery

### Initial develop→main merge: CI gate blocked

First attempt to FF-merge develop → main and push triggered `deploy.yml` which **gates on `tsc` + `vitest`** before docker build/push. The pre-deploy vitest run hit a single flaky boundary test (T9-5, non-Medicare trial alive boundary with 1ms margin). CI runners' >1ms latency between test-setup `Date.now()` and route-handler `Date.now()` flipped the boundary check from alive to expired — route returned 403 JSON instead of an SSE stream, assertion failed.

**Result: prod NOT deployed.** The CI gate caught it before ECR push. Prod stayed on the pre-Chunk-2 image (`denali:194`) while the schema migration was already applied — a half-applied state but functionally safe (pre-Chunk-2 code reads `is_on_medicare ?? false`).

### Chunk 2.8 — flaky test fix

T9-5's margin widened from `3 days minus 1ms` to `3 days minus 1 second`. The boundary semantics being tested (strict `> 3 days`) is preserved — just less timing-sensitive. T9-6 (the `+1ms expired` test) was left alone because CI latency reinforces expiry there.

After the fix re-merged to main, prod deploy at `7c8fc09` completed cleanly to `denali:195`.

### Backup branch

`backup/main-pre-chunk2-2026-05-27` at the pre-merge main HEAD pushed to origin as rollback insurance. Standard pattern from `merge-patterns.md` § 4. Keep for ~30 days post-deploy, then `git push origin --delete` when no longer needed.

---

## Tests

**Suite went from 721 (start of Chunk 2A) → 819 (after Chunk 2.5a):** +98 tests across 12 new/extended files. T1–T12 in Chunk 2's P5 phase + 7 modelOverride routing cases in Chunk 2.5a.

Notable test pattern decisions:

- **No new vitest config / no jsdom / no RTL added.** vitest is `node` env, `*.test.ts` only. React components are tested by extracting pure helpers and asserting their logic — see `filterPlansForCohort` in PaywallModal, `submitMedicareAnswer`/`healMedicareCookie` in MedicareOnboardingForm, `shouldShowMedicareConsentBanner` in lib/banner-visibility.
- **Route handlers use `vi.mock("@/lib/auth-server")` + `vi.mock("@/lib/db")`** with explicit per-test mock return values, then call `POST(new Request(...))` directly. Existing pattern from `chat/__tests__/route.test.ts`.
- **Cohort tests parameterize is_on_medicare**: every cohort-gated surface has at least 3 cases (true / false / null) so the strict `=== true` semantics are explicitly covered.

---

## Operator-side lesson worth keeping: `get-metric-data` requires dimensions

During Chunk 2 deploy verification, an automated CloudWatch check returned `Values: []` over a 30-day window for both `Denali/App` and `Denali/Staging` namespaces. The pattern from `merge-patterns.md` § 8 (added 2026-05-26) said this signals a dead publish path. ~3 hours of investigation followed:

- All env vars correct (NODE_ENV=production confirmed via ECS exec)
- IAM has `cloudwatch:PutMetricData` for both namespaces
- Direct `aws cloudwatch put-metric-data` from local CLI succeeded
- Diagnostic console.logs added to `instrumentation.ts` + `cloudwatch.ts` proved register() fires, startAutoFlush() runs, the flush timer ticks every 60s, buffer length stays consistent (proving flush clears it)

**Root cause:** the publish path was working all along. The example `get-metric-data` query in `merge-patterns.md` § 8 omits the `Route` dimension. `withMetrics` publishes `RequestLatency` with `Dimensions: [{Name: "Route", Value: route}]`. CloudWatch indexes dimensioned data separately from no-dimension queries, so an aggregate query that doesn't name the dimension returns empty — even when metrics are flowing.

Correct query shape (paste into operator notes):
```bash
aws cloudwatch get-metric-data --region us-east-1 \
  --metric-data-queries '[{"Id":"m1","MetricStat":{"Metric":{"Namespace":"Denali/App","MetricName":"RequestLatency","Dimensions":[{"Name":"Route","Value":"/api/health"}]},"Period":60,"Stat":"Average"}}]' \
  --start-time $(date -u -v-15M +%Y-%m-%dT%H:%M:%SZ) --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

Result with the dimension included: 15 datapoints across 15 minutes, values 1–136ms latency. Healthy.

**Action item**: update `merge-patterns.md` § 8 with the dimension caveat — tracked as deferred (operator follow-up).

The diagnostic commit (`bfe04d8`) was reverted (`80980d9`) once the cause was understood — code at HEAD is identical to `549acf9` for those two files. The two-commit pair is intentionally preserved in history so the investigation trail is visible.

---

## Files changed across Chunk 2 / 2.7 / 2.8 / 2.5a

Production code:
- `app/src/middleware.ts` — cohort gate redirect
- `app/src/app/onboarding/medicare/page.tsx` + `MedicareOnboardingForm.tsx` (new)
- `app/src/app/api/auth/verify-otp/route.ts` — cookie set
- `app/src/app/api/profile/route.ts` — cookie sync (PATCH) + heal (GET)
- `app/src/app/api/chat/route.ts` — non-Medicare trial branch, tool filter, modelOverride routing, profile SELECT adds `created_at`
- `app/src/app/api/appeals/route.ts` — 403 gate
- `app/src/app/api/appeal-outcome/route.ts` — 403 gate
- `app/src/app/api/checkout/route.ts` — Starter 403 gate
- `app/src/components/payment/PaywallModal.tsx` — extracted `filterPlansForCohort`
- `app/src/components/appeal/AppealGate.tsx` — wire `isOnMedicare` prop
- `app/src/app/app/chat/page.tsx` — EmptyState appeal-card filter, consent banner predicate
- `app/src/app/app/settings/page.tsx` — wire `isOnMedicare` prop to PaywallModal
- `app/src/lib/banner-visibility.ts` (new) — `shouldShowMedicareConsentBanner`
- `app/src/config/messages.ts` — `RATE_LIMITS.NON_MEDICARE_DAILY_LIMIT` constant
- `app/src/config/api.ts` — `trialModel` field (Chunk 2.5a)

Infrastructure:
- `scripts/migrate-medicare-gate-2026-05-27.sql` — schema + admin-account data fixes (idempotent)
- `ANTHROPIC_TRIAL_MODEL` env var on `denali-staging:96` (manual addition, prod pending)

Tests: 12 new/extended test files, 98 new tests total. See per-file detail in commit `549acf9` / `568dac1` / `7c8fc09` / `1bca8b6`.

---

## Deferred work (tracked, intentionally not in Chunk 2)

| Item | Why deferred | Where it'll be picked up |
|---|---|---|
| `ANTHROPIC_TRIAL_MODEL` on prod task def + Chunk 2.5a prod deploy | Staging V1 verification (Haiku actually invoked) pending | Chunk 2.5b (prod env var + merge + verify) |
| Token-based throttling | Different scope than message-count limits | Chunk 2.6 |
| Gender capture | Independent from Medicare gate | Chunk 3 |
| Gating of other Medicare-only surfaces (Health hub, Dashboard, Diabetes, Claims, Email Alerts, FHIR routes) | Out of scope for Chunk 2 (chat + paywall + appeals only) | Chunk 4 |
| Counselor/provider role × is_on_medicare interaction | Product design question — current F filter is is_on_medicare-only, counselors with non-Medicare own coverage get the tool removed even though they help Medicare beneficiaries | Product design pass |
| PaywallModal header text "Unlock appeal letters and more daily messages" | Misleading copy for non-Medicare; out of P4-G3 scope | UX polish pass |
| BASE_CORE_PROMPT identity leak (`Users: Medicare patients & caregivers`) | Identity scoped to Medicare; NON_MEDICARE_ACKNOWLEDGMENT_SKILL overrides downstream | Skill-prompt cleanup pass |
| `merge-patterns.md` § 8 example query missing `Dimensions` field | Operator follow-up | Doc fix |
| RDS-outage path now fails closed (was undefined / 500-ish) | Intentional behavior change; safer than pre-Chunk-2 | Documented here |
| `staging-prod-sync-may11.md` doc refresh | The 2026-05-27 prod migration changes the canonical state of `is_on_medicare` | Doc fix |

---

## Verification checklist (what was confirmed)

- Prod RDS column metadata: `is_nullable=YES, column_default=null` ✓
- Prod RDS data fixes: both targeted operator-owned admin rows updated to their intended values; third operator-known row untouched ✓
- Prod ECS: `denali:195`, rollout COMPLETED, 1/1 running ✓
- Prod HTTPS: `HTTP/2 200` from `/api/health` ✓
- Prod logs: zero errors in last 2 min post-deploy ✓
- Staging ECS: `denali-staging:97`, all three Anthropic models in env ✓
- Manual V1–V4 staging: held for operator (separate confirmation pending)
- Chunk 2.5a Haiku V1 verification: held for operator-driven trial chat turn

---

## See also

- Discovery report (pre-work state of all touched surfaces): `docs/discovery-2026-05-27-plan-gating-gender.md`
- Migration source: `scripts/migrate-medicare-gate-2026-05-27.sql`
- Operational pattern (ECS exec migrations + dimension caveat above): `docs/reference/merge-patterns.md`
- Cookie security + middleware behavior: see CLAUDE.md "Critical Rules" → Stage 2 cohort gate
