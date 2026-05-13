# Phase 3 — BILLING chain + prod-safe SP migrations

Phase 3 ran 2026-05-11 through 2026-05-13. Original Phase 3 prep section, extracted verbatim from CLAUDE.md during the 2026-05-13 doc refactor.

---

## Phase 3 prep (in progress)

The Phase 3 BILLING chain cherry-pick (8 commits, develop→main) requires
careful SQL migration handling because the develop versions contain
staging-email backfills that would forcibly downgrade prod paying users
if any happen to share those emails.

**3a. Prod-safe SQL migrations** (complete as of 2026-05-11):
- scripts/migrate-fulfill-checkout-trial-converted-prod.sql
- scripts/migrate-handle-subscription-change-revert-plan-prod.sql

Both contain SP body changes only. Staging-specific UPDATE statements
and pre/post-check SELECTs targeting hardcoded emails
(ramanac@gmail.com, ceeveear@yahoo.com) and user UUIDs have been
stripped. SP body bytes are identical to develop. PROD-SAFE header
block documents the deviation.

**3b. Audit prod paying users' emails** — complete as of 2026-05-11
(task `4fd33edc02cd4c968717b4b63700e904`). Result: 2 collisions found —
both `ramanac@gmail.com` and `ceeveear@yahoo.com` exist on prod as Plus
subscribers. Both confirmed to be operator-owned test accounts (see
"Known test accounts on prod" section above). Develop's staging
migrations MUST NOT be applied to prod — they would downgrade these
accounts. The prod-safe variants from 3a are the only safe option.
Audit 3 hit a separate schema-drift error
(`subscriptions.cancel_at_period_end` exists on develop but not prod);
audits 4–5 did not run. The gate question (collision check) was
answered cleanly by audit 2 before the abort.

**3c. Stripe prod config verification** (complete as of 2026-05-11):

Verified directly from Stripe Dashboard (Live mode):
- **API keys** ✓ `sk_live_` ("Denali Health Prod") + `pk_live_` present
  (originally added to AWS Secrets Manager on 2026-05-02 during BB 2.0 prod cutover)
- **Webhook endpoint** ✓ `https://denali.health/api/webhooks/stripe`, Active
  - API version: `2025-04-30.basil`
  - Subscribed events (5): `checkout.session.completed`, `customer.subscription.created`,
    `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.payment_failed`
  - `customer.subscription.created` was added May 11; the other 4 predate today.
- **Stripe products** ✓ 3 active in Live mode:
  - Pay-per-Claim — $10.00 USD, one-time (not recurring)
  - Monthly Subscription $20 Plan — $20/mo recurring
  - Unlimited Monthly Access — $60/mo recurring
  - Note: `users.plan` enum includes `'starter'` but no $10/mo recurring product exists on prod.
    The `'starter'` enum value is unused as of this audit.

AWS-side audit results (May 11):
- Stripe credentials live inside the composite secret `denali/prod/app` in AWS
  Secrets Manager, last rotated 2026-05-02 during BB 2.0 cutover. No separate
  `denali/prod/stripe-*` secrets exist — Stripe creds share the app-env composite.
- 6 Stripe-related JSON keys present in `denali/prod/app`:
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_PAY_PER_CLAIM`, `STRIPE_PRICE_UNLIMITED`.
- The current prod ECS task definition wires all 6 of those keys as container `secrets[]`
  references (no mismatches, no orphan envs, no orphan secret keys). Audit grepped both
  sides programmatically; zero drift.

App-side SDK audit results (May 11):
- Installed: `stripe@^20.2.0` (Stripe Node SDK v20.x).
- `apiVersion` is NOT set anywhere in `app/src/` — all 4 production `new Stripe(...)` calls
  (`checkout/route.ts:57`, `webhooks/stripe/route.ts:30`, `webhooks/stripe/route.ts:65`,
  `lib/stripe-fulfillment.ts:8`) rely on the SDK default.
- Compatibility vs the webhook's `2025-04-30.basil` API version: mostly aligned. The one
  known field-location delta (`subscription.items.data[0].current_period_end` vs the
  legacy top-level `current_period_end`) is already worked around in code per the existing
  "Stripe SDK v20" note in the Stripe section of this doc. Not a blocker for the Phase 3
  BILLING chain. Future hardening option (not required now): pin `apiVersion:
  "2025-04-30.basil"` explicitly in each `new Stripe()` call so outbound and inbound use
  the same API version.

**Cross-check verification (completed 2026-05-11):**
- Customer Portal config: "Customers can switch plans" toggle is OFF (B.3 plan-change webhook handling not built; portal restricted to update payment / cancel / view invoices). Redirect link set to https://denali.health/app/settings.
- Stripe Public Business Details: Terms of service URL set to https://denali.health/terms, Privacy policy URL set to https://denali.health/privacy.
- Signing-secret cross-check: SHA-256 hash of the AWS-stored STRIPE_WEBHOOK_SECRET matches the SHA-256 hash of the value revealed in Stripe Dashboard. Verified via automated Python script (no values written to disk, no values printed) plus manual shasum -a 256 confirmation on the Dashboard-revealed value.
- Price ID cross-check: all 3 AWS-stored price IDs (STRIPE_PRICE_MONTHLY, STRIPE_PRICE_UNLIMITED, STRIPE_PRICE_PAY_PER_CLAIM) match the live Stripe price objects when filtered by amount + recurring interval. Verified via Stripe API + automated comparison (no values printed).

No mismatches found. 3c verification complete; ready to proceed to 3d (apply prod-safe SP migrations to prod RDS).

**3d. Apply prod-safe SP migrations to prod RDS** (complete as of 2026-05-11):

Both prod-safe migrations from af7a4c8 successfully applied via the
`denali-prod-pgdump:1` task override pattern (assignPublicIp=ENABLED,
ON_ERROR_STOP=1). Each ran inside its own ECS task; pre-flight + apply +
post-flight gates evaluated separately. Function count baseline of 191
(raw `pg_proc` count in `public` schema, includes pgcrypto + pg_trgm
extension functions) remained stable across both migrations.

- `fulfill_checkout` (B.1 fix forward): body length 905 → 933 bytes
  (+28). New: sets `subscriptions.trial_converted = true` on payment
  fulfillment via UPSERT. Signature unchanged.
- `handle_subscription_change` (B.9 fix forward): body length 387 → 851
  bytes (+464). New: when subscription status flips to 'cancelled',
  `users.plan` is reverted from any paid tier to 'trial', keeping
  users.plan in sync with Stripe-side cancellation. Signature unchanged.

Verification: CloudWatch logs for all 6 ECS tasks (3 per migration:
pre-flight, apply, post-flight) showed clean BEGIN / CREATE FUNCTION /
COMMIT output with no NOTICE/WARN/ERROR. Cross-check at end of migration
#2 confirmed fulfill_checkout body still at 933 bytes (3d-1's migration
not reverted by 3d-2).

Behavioral impact starting 2026-05-11:
- New `checkout.session.completed` webhook events fulfill with
  `trial_converted=true` (Bug #1 closed forward; existing 4 paying
  user rows still have `trial_converted=false` — not auto-backfilled,
  deliberately skipped since all 4 are operator accounts and the flag
  has no functional impact for them).
- New `customer.subscription.*` webhook events with status='cancelled'
  auto-revert `users.plan` to 'trial' (B.9 closed forward; existing
  ramanac drift not auto-corrected — deliberately skipped since
  ramanac is admin with `is_admin=true` bypassing all plan-tier gates).

Unblocks 3e (cherry-pick the BILLING chain to main).

**3e. Cherry-pick BILLING chain to main** — pending. Blocked on 3b/3c/3d.

**3f. Push + monitor + verify** — pending.

---

