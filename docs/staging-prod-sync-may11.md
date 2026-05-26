# Staging-prod sync state

**Last reconciled**: 2026-05-11 at commit `8c06ab3` on `main` (`chore: gitignore projectstatus_apr28.md`, 2026-05-05).

This doc captures the state of develop ↔ main alignment as of the May 11 gap-analysis turn, immediately before the BILLING-SAFETY cherry-pick chain lands on main. Update on every subsequent reconciliation pass so future-you can pick up cold without re-running the audit.

Companion: `docs/design/staging-prod-divergence.md` — explains *why* prod and staging diverge (longitudinal 55+ platform stays on staging until tested). This doc is the *what-has-and-has-not-shipped* ledger.

---

## Permanent-skip register

Commits and categories that never ship to main. Future reconciliation passes should treat these as background noise — do not re-evaluate.

### By category

| Category | Rule | Rationale |
|---|---|---|
| `infra/staging/**` | Skip all | Terraform with staging resource ARNs hardcoded (e.g., `denali-staging-web` service, `denali-staging` cluster, staging RDS secret ARN). Cannot ship to main without a parallel `infra/prod/` track, which is out of scope. |
| `STAGING-LOCKDOWN.md` and related access controls | Skip all | Email allowlist, admin gate, CSP enforcement in staging — prod has its own (looser) access posture appropriate to a public CMS-marketplace app. |
| `app/src/lib/auth-server.ts` staging-email-allowlist additions | Skip the staging-specific branch | The function lives in both branches; only the staging allowlist hook is staging-only. Other auth-server changes may still ship. |
| `.github/workflows/deploy-staging.yml` | Skip all | Staging workflow targets staging ECR, staging IAM role, staging cluster. Prod has `deploy.yml` with its own parallel evolution. |
| 55+ Foundation Stage 1 work (NON-MEDICARE cohort) | Skip until cohort migration complete | Per `docs/design/staging-prod-divergence.md`, the longitudinal 55+ platform moves to prod only after thorough testing. Includes: `scripts/migrate-user-prerequisites.sql`, `scripts/migrate-birth-year-modal-cadence.sql`, all `feat(profile): birth-year*` work, `feat(skills): non-Medicare*` chain, cohort-aware test scaffolding. |
| `.claude/agents/*` | Skip all | Agent configuration files for the local Claude Code workspace — not consumed by deployed code. |
| Docs scoped to staging operations | Skip | E.g., `STAGING-LOCKDOWN.md`, sections of `docs/runbook.md` that document staging-only procedures. The runbook content about RDS rotation collision recovery applies to BOTH envs (manual procedure works for prod RDS too) — *that* should ship. Decide hunk-by-hunk. |

### Specific commits already permanently skipped

| SHA | Subject | Why permanent skip |
|---|---|---|
| ad65124 | ci: add staging deploy workflow for develop branch | Creates the staging workflow itself |
| 83b8bd4 | chore(infra): add CloudFormation templates + deploy scripts + monitor Lambda | Staging-side infra scaffolding (now superseded by Terraform in infra/staging/) |
| f05cb34 | ci(staging): push to denali-staging ECR repo instead of denali | Workflow change |
| 65b05bf | ci(staging): use dedicated denali-staging-deploy-role | Workflow change |
| 6072a51 | Skip staging deploy on doc-only pushes | Workflow change |
| f3eae45 | ci(deploy): skip staging deploys for SQL-only commits | Workflow change |
| 2641385 | Staging lockdown: email allowlist + admin gate + CSP enforce | Staging-only access control |
| ceab13a | Fix cms-metadata 404: use Response.json for valid HTTP/2 response | Staging-only fix (host-gate on cms-metadata is staging-side) |
| 0aa55eb | Add STAGING-LOCKDOWN.md | Staging-only doc |
| 8479a7f | docs(staging-lockdown): mark MFA as OFF | Staging-only doc |
| 72786c4 | chore: gitignore staging listener rules backup | `.gitignore` rule for a staging-only artifact |
| 80dd0c0 | Initialize Terraform foundation for staging IaC | infra/staging/* |
| 5080c83 | infra(staging): add data sources (chunk A) | infra/staging/* |
| a2ebdc0 | feat(infra): A2 auto-recover from RDS rotation collisions via EventBridge + Lambda | infra/staging/* with staging ARNs baked in. **Prod could use an equivalent — see "Future work" below.** |
| a6d22ce | feat(db): Foundation Stage 1 migration — user prerequisites schema | 55+ cohort |
| cfc9c77 | feat(profile): extend User type and /api/profile for Stage 1 fields | 55+ cohort |
| 67815ed | feat(profile): add ProfileCompletionModal for birth_year capture | 55+ cohort |
| 3039b05 | feat(db): Stage 1.C migration — birth-year modal cadence | 55+ cohort |
| cb81162 | feat(profile): add birth-year reminder cadence endpoints | 55+ cohort |
| 6344a0c | feat(profile): wire birth-year modal cadence UX | 55+ cohort |
| b612d49 | feat(settings): add Profile section + expose refetchProfile | 55+ cohort |
| ec6c39d | feat(chat): plumb is_on_medicare into SessionState | 55+ cohort routing |
| 9231868 | feat(chat): gate Medicare skills on isOnMedicare | Reverted on develop by 1336f04; both skip |
| 1336f04 | revert: roll back gated Medicare skills (9231868) | Revert of above; both skip |
| ddea052 | refactor(skills): split base.ts into base-core + medicare-overlay | 55+ skills scaffolding |
| 9e26b03 | feat(skills): add routing layer above skill loader | 55+ skills |
| 2fb25fd | feat(skills): add non-Medicare skill loader | 55+ skills |
| 7e71ff5 | feat(skills): add non-Medicare acknowledgment overlay | 55+ skills |
| 162bd6e | feat(skills): activate non-Medicare orchestration | 55+ skills |
| f91a454 | feat(test-infra): cohort-aware test scaffolding | 55+ test infra |
| 40ec05b | test(profile): cover birth-year-reminder dismiss route | 55+ test |
| b64b5a7 | test(profile): cover birth-year-reminder disable route | 55+ test |
| c29cfb6 | test(profile): cover birth-year-reminder enable route | 55+ test |
| 5c8074d | chore(agents): clarify cohort-test-author write surface | Agent config |
| 47af5ba | docs(db): align birth-year cadence comment with TS implementation | 55+ migration comment |
| af294c5 | test(profile): cover profile-cadence helper | 55+ test |
| 889e253 | test(skills): cover skills-loader-router cohort routing | 55+ test |
| 52bb867 | test(skills): cover skills-loader-non-medicare cohort divergence | 55+ test |
| 37c456c | test(e2e): verify mockAuthenticatedUser cohort overrides | 55+ test |
| df4a60e | docs(spec): Foundation engineering spec for Phase 2 | 55+ Phase 2 design |

### Already-applied (empty cherry-pick — main has equivalent SHAs)

These commits exist on both branches with different SHAs. Cherry-picking would no-op. **Treat as done; skip from future passes.**

| Develop SHA | Equivalent main SHA | Subject |
|---|---|---|
| 0130db9 | 201bb81 | docs: BB2.0 production credentials rotated to denali/prod/app |
| a4b0543 | fe59d66 | fix(appeal): nav-layering + body overflow on Levels 4-5 informational modal |
| 6ff42d1 | ef3158b | fix(appeal): center appeal modal below site nav to prevent button clipping |
| 9417ba4 | 2b23503 | fix(chat): pad table placeholder to prevent __TABLE_N__ leak in DOM |
| 5f739b4 | 54af5ed | feat(branding): add 512x512 logo for BB 2.0 marketplace |
| eb92e2e | 543c3fb | docs(runbook): document manual Lambda invoke CLI timeout |
| 94d7e71 | 5f3393c | docs(runbook): document scheduled downtime + alarm suppression |
| 704f5b0 | 9388d03 | docs(incident): expand postmortem with actual remediation timeline |
| e044c85 | 25228dc | docs(runbook): preserve denali-deploy-policy as rollback artifact |
| ea05a6c | 9768e40 | docs(runbook): ECR eviction recovery procedure |
| 05d9655 | be8f409 | build: digest-pin node:20-alpine base image |

---

## Prod-side migrations applied

SQL migrations that have run against prod RDS, with task ID + date. Git can only show that the `.sql` source-of-truth file landed on `main`; only this register tells you whether the migration ran on the database.

Apply mechanism: ECS run-task on cluster `denali` using task definition `denali-prod-pgdump:1` with command override piping base64-encoded SQL to `psql`. See B.8 audit (2026-05-11) for the canonical example.

| Date applied | Migration file | Task ID | Operator | Notes |
|---|---|---|---|---|
| 2026-05-03 | sql/001-schema.sql (initial prod build) | n/a (prod launch) | Venkata | Prod RDS provisioned from this schema at CMS launch |
| 2026-05-11 | `b8-prod-audit.sql` | `f701e5268ccd46dfbfd8c78474fb7c55` | gap-analysis turn | **Read-only audit**, not a migration. Result: prod clean (zero duplicates). |

### Pending application (will land alongside cherry-picks)

| Migration file | Source commit | What it changes | Backfill caveat |
|---|---|---|---|
| `scripts/migrate-fulfill-checkout-trial-converted.sql` | 9007d14 | Updates `fulfill_checkout` SP to set `trial_converted=true` on payment | **CONTAINS BACKFILL UPDATE targeting `ramanac@gmail.com` (staging email).** Strip backfill or make idempotent-conditional before prod apply. Prod has no such user state to fix per B.8 audit. |
| `scripts/migrate-handle-subscription-change-revert-plan.sql` | 8bdf28d | Updates `handle_subscription_change` SP to revert `users.plan='trial'` on cancellation | **CONTAINS BACKFILL UPDATE targeting `ramanac@gmail.com` and `ceeveear@yahoo.com` (staging emails).** Strip backfill — prod has zero cancelled subs per B.8 audit. |

**Both SQL files need their staging-specific backfill UPDATEs removed before prod apply**, OR the apply needs to be a `CREATE OR REPLACE FUNCTION` of just the SP definition without the surrounding `BEGIN/COMMIT` + UPDATE statements. The SP replacement itself is prod-safe.

---

## Pending reconciliation

Commits on develop awaiting decision. Order reflects recommended cherry-pick sequence — chronological matches logical dependency.

### BILLING-SAFETY chain (target: ship together)

| Order | SHA | Subject | Classification | Status | Conflict scope |
|---|---|---|---|---|---|
| 1 | f61dc8d | feat(checkout): add environment metadata to Stripe Checkout Sessions | BILLING-SAFETY | pending | clean — only touches `app/src/app/api/checkout/route.ts` (not modified on main) |
| 2 | ecb5ac5 | feat(checkout): reject same-plan and downgrade resubscription with 409 | BILLING-SAFETY | pending | clean — same file only |
| 3 | 9007d14 | fix(trial): mark trial_converted=true on payment fulfillment | BILLING-SAFETY (Bug #1) | pending | clean for code; **SQL needs backfill stripped before prod apply** |
| 4 | 97f5ee3 | feat(billing): add Stripe Customer Portal endpoint + Manage Subscription button | BILLING-SAFETY/UX (B.1) | pending | clean — new file `app/src/app/api/billing-portal/route.ts` + `settings/page.tsx` |
| 5 | 9acd117 | feat(billing): block plan changes during active subs + reuse Stripe customer ID | BILLING-SAFETY (B.6 + B.7) | pending | clean for code; **CLAUDE.md hunk must be dropped** (main's CLAUDE.md heavily diverged) |
| 6 | f07daef | feat(billing): plan-aware PaywallModal + open Customer Portal in new tab | UX-IMPROVEMENT (B.4) | pending | clean for code; **CLAUDE.md hunk must be dropped** |
| 7 | 8bdf28d | fix(billing): handle_subscription_change SP reverts users.plan to trial on cancel | BILLING-SAFETY (B.9) | pending | clean for code; **CLAUDE.md hunk must be dropped; SQL needs backfill stripped** |

### Independent critical fixes (target: ship alongside billing chain)

| SHA | Subject | Classification | Status | Notes |
|---|---|---|---|---|
| b0ea45b | Fix settings hooks 401: subscribe to auth-state-change events | UX/CRITICAL | pending | Load-bearing for B.4 paywall modal UX; touches 3 hooks; conflict-free |
| 99f2c05 | Fix sw.js clone-after-async TypeError and bump cache to v4 | BUG-FIX | pending | Service-worker bug breaking responses; impacts all users; conflict-free |
| e82a36c | chore(api/trial): remove TRIAL_DEBUG_2026_05_07 temporary log | UX-IMPROVEMENT | pending | Single-line debug-log removal; ship anywhere; conflict-free |
| f61dc8d | (also covered above in BILLING-SAFETY) | — | — | — |

### Needs investigation before any cherry-pick decision

| SHA | Subject | Why it's unresolved |
|---|---|---|
| f855322 | chore(hygiene): commit pre-demo security hardening (2026-04-17) | **42 files**, kitchen-sink commit. Includes changes to checkout, auth, paywall, FHIR, middleware, blog. Some hunks may already be on main via separate commits; others may be load-bearing for prod. **Action**: diff each of the 42 files against main's current state to determine what's missing. May result in split into multiple targeted cherry-picks. |

### Split-required (mixed-purpose commits)

| SHA | What ships | What skips |
|---|---|---|
| 9acd117 (B.6 + B.7) | All 4 code/config files | CLAUDE.md hunk |
| f07daef (B.4) | All 4 code files | CLAUDE.md hunk |
| 8bdf28d (B.9) | Code + (stripped) SQL | CLAUDE.md hunk |
| 25a3488 (post-A2 cleanup) | `.github/workflows/deploy-staging.yml` paths-ignore (`infra/**`) IF that workflow file's prod equivalent has the same pattern; otherwise skip | `docs/runbook.md` auto-recovery section (talks about staging Lambda), `CLAUDE.md` A2 entry |

### Permanent-skip but worth noting in passing

These were classified as skip in the gap analysis but should be re-evaluated if business needs change:

- **a2ebdc0** (A2 EventBridge + Lambda for staging RDS rotation): prod RDS also rotates its master secret on a schedule. If prod ever hits the same rotation-collision pattern, a parallel `infra/prod/rotation-recovery.tf` could be created. **Currently low priority** — prod RDS has different rotation schedule, and CMS-launch traffic is small. Track separately if needed.

### Docs that should ship but need conflict resolution

Most CLAUDE.md changes on develop reflect operational learnings that ARE relevant to prod. But main's CLAUDE.md was compressed in a single commit (`6c2d90f`) and has diverged significantly. **Strategy**: write fresh, condensed entries on top of main's current state — don't cherry-pick the develop hunks directly.

Specific CLAUDE.md content worth porting (in some form):
- B.6/B.7/B.9 backlog entries (from 9acd117, f07daef, 8bdf28d) — re-add as a "Billing kill-switch + customer reuse" section
- BB2.0 prod credentials rotation note (already on main via `201bb81`)
- CloudWatch retention bump (3ed16f5) — operational fact
- Stripe test-mode reference correction (1c4ca75) — content fix

---

## Stripe prod config state

Config that lives in Stripe Dashboard / environment variables / Secrets Manager — not in git. Capture here so we don't rediscover from scratch on every reconciliation.

### Stripe account

- **Account**: Qash Solutions, Inc. (CMS-approved 2026-05-03)
- **Mode**: live
- **Webhook signing secret**: stored in `denali/prod/app` Secrets Manager (`STRIPE_WEBHOOK_SECRET`)
- **API key**: stored in `denali/prod/app` Secrets Manager (`STRIPE_SECRET_KEY`)
- **Publishable key**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` baked into prod image at build time (GitHub Actions secret)

### Webhook endpoint

- **URL**: `https://denali.health/api/webhooks/stripe`
- **Events subscribed**: TBD — populate by running `stripe webhook_endpoints list` against the live key, or check Dashboard → Developers → Webhooks
- **Expected events** (per `app/src/app/api/webhooks/stripe/route.ts`):
  - `checkout.session.completed` → `fulfillCheckoutSession()` (sets `trial_converted=true` after 9007d14 lands)
  - `customer.subscription.created/updated` → `handle_subscription_change` SP
  - `customer.subscription.deleted` → `handle_subscription_change` SP with status='cancelled' (after 8bdf28d lands, reverts `users.plan` to trial)
  - `invoice.payment_failed` → marks subscription `past_due`

### Customer Portal config

- **Status**: TBD — needs to be enabled and configured in Stripe Dashboard before `97f5ee3` (Customer Portal endpoint) is functional in prod
- **Features to enable** (matching staging):
  - Cancel subscription (subscription cancellation → triggers `customer.subscription.deleted` webhook)
  - Update payment method
  - View invoices and billing history
- **Branding**: TBD — Denali logo + brand colors in Stripe Dashboard → Settings → Branding
- **Return URL**: `https://denali.health/app/settings` (from `97f5ee3` code path)

### Products and prices

- **Plus** ($20/mo recurring):
  - Product ID: TBD
  - Price ID: TBD (in `denali/prod/app` Secrets Manager as `STRIPE_PRICE_PLUS`)
- **Unlimited** ($60/mo recurring):
  - Product ID: TBD
  - Price ID: TBD (`STRIPE_PRICE_UNLIMITED`)
- **Starter** ($10 one-time):
  - Product ID: TBD
  - Price ID: TBD (`STRIPE_PRICE_STARTER`)
  - **Note**: currently broken per CLAUDE.md (`mode: "subscription"` for all plans; Starter is `one_time`). Not yet fixed in any pending commit. Track separately.

### Active subscriptions snapshot (as of 2026-05-11 B.8 audit)

- 4 active subscriptions (3 Plus + 1 Unlimited)
- 1 trialing
- 0 past_due, 0 cancelled
- All users have exactly one stripe_customer_id (no duplicates)

### Items intentionally NOT in this doc

- Customer email addresses, names, payment method details — PHI/PII per Denali Privacy §2
- Subscription IDs of specific users — same reason
- Stripe keys and webhook secrets — secrets management lives in AWS Secrets Manager

---

## Reconciliation log

Append a new dated entry on every cherry-pick / migration application / Stripe config change.

| Date | Operator | What changed | Where |
|---|---|---|---|
| 2026-05-11 | gap analysis | Initial creation of this doc | docs/staging-prod-sync-may11.md |

---

## Future work tracked here (not blocking)

- **Prod-side rotation recovery automation** (parallel to A2 on staging): create `infra/prod/rotation-recovery.tf` if prod RDS rotation ever causes outages. Currently no incident has occurred on prod.
- **Starter plan checkout mode fix**: `app/src/app/api/checkout/route.ts` uses `mode: "subscription"` for all plans; Starter is one-time. Not in any develop commit yet. Track separately.
- **f855322 investigation**: the 42-file pre-demo hardening commit needs per-file diff against main before any cherry-pick decision.
- **CLAUDE.md re-divergence**: this doc + the cherry-pick chain will land BILLING-SAFETY entries onto main's compressed CLAUDE.md, intentionally NOT porting the staging-specific backlog (A2, B.10 trial-user copy, etc.). Future develop turns will continue to add staging-specific entries — that's fine, this doc tracks the gap.
