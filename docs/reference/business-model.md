# Business Model, Auth & Payments Reference

Full pricing tables, AAL2 deprecation context, complete Stripe
architecture, environment variable inventory, ECS deployment
gotchas, infrastructure scheduling/monitoring/alerting tables,
AWS resource inventory. Extracted from CLAUDE.md.

For the active subset (pricing + auth gating + appeal gating
+ Stripe critical rules), see CLAUDE.md "Business Model, Auth
& Payments (summary)".

For incident response and runbooks: `docs/incidents/` and
`docs/runbooks/`.

---


### Pricing

| Plan                 | Price     | Appeals/30d | Chat Messages/Day | Weekly Frequency | Auth Required                    |
| -------------------- | --------- | ----------- | ----------------- | ---------------- | -------------------------------- |
| Trial (14 days)      | $0        | 0           | 10                | 1 day/week       | Email OTP                        |
| Expired (post-trial) | —         | —           | 0 (locked)        | —                | Email OTP                        |
| Starter              | $10 one-time (pay-per-claim) | 1 credit    | 20                | 1 day/week       | Email OTP                        |
| Plus                 | $20/month | 2 credits   | 20                | Every day        | Email OTP                        |
| Unlimited            | $60/month | Unlimited   | Unlimited         | Unlimited        | Email OTP                        |
| **Admin**            | —         | Unlimited   | Unlimited         | Unlimited        | `is_admin = TRUE` on `users` row |

**Sign-in required for all chat.** No anonymous access — users must sign up (email OTP) before chatting. **Gmail plus address normalization**: `user+tag@gmail.com` → `user@gmail.com` at sign-in via `normalizeEmail()` in `src/lib/normalize-email.ts` — prevents duplicate accounts. OTP email sent to original address (Gmail delivers it). Every signup = automatic 14-day trial (inline DB insert in `verify-otp`, not self-referencing HTTP fetch). After trial expires → locked (0 chats, must pay). Plan values are `trial`, `starter`, `plus`, `unlimited` only. **Starter is a one-time pay-per-claim charge ($10 grants 1 appeal credit, no recurring billing); Plus and Unlimited are monthly subscriptions.** Appeal access is credit-based via `usage.appeal_credits` column; `unlimited` plan bypasses credit checks entirely. `AppealAccessStatus` returns `"available"` (has credits), `"paywall"` (no credits), or `"allowed"` (admin/counselor/unlimited). Chat rate limiting enforced via two layers: (1) `check_weekly_frequency` for weekly day limits, (2) `check_and_increment_chat` for daily limits. Returns 429 `WEEKLY_LIMIT` / `RATE_LIMITED`; returns 401 `AUTH_REQUIRED` for unauthenticated users; returns 403 `TRIAL_EXPIRED` when expired trial users try to chat. **Admin users** (`users.is_admin`) bypass all rate limits and appeal paywalls.

**AI Model**: Sonnet 4.6 for all chat messages (cost-efficient). Opus 4.6 for appeal letter generation only (higher quality for formal letters).

### Auth Gating

| Feature                                     | Auth Required                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 14-day trial (10 msgs/day, 1 day/week)      | Email OTP                                                                                                                        |
| Post-trial (locked)                         | Email OTP + Subscription to continue                                                                                             |
| Starter (20 msgs/day, 1 day/week, 1 appeal) | Email OTP + $10 one-time (pay-per-claim)                                                                                         |
| Plus (20 msgs/day, every day, 2 appeals)    | Email OTP + $20/month                                                                                                            |
| Unlimited (everything unlimited)            | Email OTP + $60/month                                                                                                            |
| Medicare health data                        | Email OTP + Blue Button OAuth. **ID.me verification: DEPRECATED — NOT REQUIRED per CMS April 2026.** `REQUIRE_IDENTITY_VERIFICATION=false` permanently in all envs. |

### AAL2 Compliance Strategy (CMS A1 / NIST 800-63B)

> **DEPRECATED 2026-04-21 — NOT REQUIRED per CMS confirmation.** ID.me integration is permanently disabled in all environments. `REQUIRE_IDENTITY_VERIFICATION=false` in prod and staging. The flow description below is retained for historical context only; the feature is off and code removal is pending in a future commit.

**Current AAL2 path**: Blue Button OAuth via Medicare.gov satisfies the IAL2/AAL2 requirement (see the Blue Button OAuth section below). The ID.me flow description that follows is retained for historical reference only.

**ID.me provides IAL2/AAL2 identity verification.** Controlled by `REQUIRE_IDENTITY_VERIFICATION` env var:

- `false` (default) = **Connected Apps Directory** mode — Blue Button works without ID.me. ID.me card hidden in Settings unless already verified.
- `true` = **Medicare App Library** mode — users must verify identity via ID.me before connecting Blue Button. ID.me card shown as required.

ID.me uses OIDC (`nist_ial2_aal2` scope). CMS-approved NIST 800-63 credential service provider. One-time verification persists in `user_verification.idme_verified`. Admin bypass on the gate. Data minimization: UUID + first name + gender stored (no last name, DOB, SSN, address). TOTP MFA UI disabled (2026-03-10) — code preserved for potential re-enablement.

**ID.me OIDC flow**: Settings → "Verify with ID.me" button (ID.me brand green #2D844A) → confirmation panel (explains CMS-approved, used by VA/SSA, one-time, auto-return) → `GET /api/auth/idme/authorize` (PKCE + state + nonce cookies) → ID.me sandbox (`api.idmelabs.com`) → `GET /api/auth/idme/callback` (token exchange via `client_secret_post`, userinfo fetch → extract `uuid` + `fname` + `gender`, upsert `user_verification`) → redirect to `/app/settings?idme=verified`.

**Name/gender personalization flow**: ID.me userinfo `fname`/`given_name` → `user_verification.idme_first_name` → `/api/profile` response `firstName` → `useAuth` AuthState `firstName` → chat `sessionState.userName` (skips AI "What's your name?" onboarding) + dashboard greeting + chat empty state greeting. Gender stored for clinical context in AI conversations.

**CMS clarification (2026-03-13, reaffirmed 2026-04-21)**: ID.me/CLEAR/Login.gov are NOT required for Blue Button API / Connected Apps Directory. They were considered for the separate Medicare App Library initiative, but that path is no longer being pursued. `REQUIRE_IDENTITY_VERIFICATION=false` permanently in all environments.

### Appeal Gating Logic

```
1. User requests appeal letter
2. Check email:
   - Not verified -> Signup wall (email OTP → auto-trial, 0 appeal credits)
   - Verified, plan = unlimited -> Generate letter (no credit tracking)
   - Verified, appeal_credits > 0 -> Generate letter, decrement credit, increment count
   - Verified, appeal_credits = 0 (or trial) -> Show paywall (Starter $10 / Plus $20 / Unlimited $60)
3. After subscription -> Credits added per plan, reveal letter
```

### Stripe Payment Architecture

```
PaywallModal (client) → POST /api/checkout → Stripe Checkout Session
                                                    ↓
                                        User completes payment on Stripe
                                                    ↓
                              Stripe fires webhook → POST /api/webhooks/stripe
                                                    ↓
                                        stripe-fulfillment.ts
                                        ├── fulfillCheckoutSession() → update user plan
                                        └── handleSubscriptionEvent() → sync status
```

**Stripe products** (2026-03-05): 3 products in Stripe sandbox — `STRIPE_PRICE_PAY_PER_CLAIM` ($10 one-time, type=`one_time`), `STRIPE_PRICE_MONTHLY` ($20/mo recurring), `STRIPE_PRICE_UNLIMITED` ($60/mo recurring). Price IDs in AWS Secrets Manager (`denali/prod/app` for prod, `denali/staging/app` for staging — both currently point at the same test-mode price IDs since Stripe live mode hasn't been activated). Switch to live keys for production.

**Checkout route** (`checkout/route.ts`): Expects `plan: "starter" | "plus" | "unlimited"`. **Known gap (2026-04-20)**: route currently sets `mode: "subscription"` for all plans, but `STRIPE_PRICE_PAY_PER_CLAIM` is a `one_time` price — Starter checkout will fail at Stripe API call until the route branches on plan (`mode: "payment"` for starter, `mode: "subscription"` for plus/unlimited). `stripe-fulfillment.ts` also assumes a subscription is attached to every session and would need a payment-mode branch. Maps to Stripe Price IDs via `PRICING.STARTER/PLUS/UNLIMITED.stripePriceId`.

Key webhook events: `checkout.session.completed` → `fulfillCheckoutSession()` (reads metadata → plan upgrade to `starter`, `plus`, or `unlimited` + credit reset). `customer.subscription.updated/deleted` → `handleSubscriptionEvent()` (syncs status + plan-aware credit reset). `invoice.payment_failed` → marks `past_due`.

Subscription states: `active` (full access) → `past_due` (retry) → `cancelled` (reverts to expired/locked).

### Stripe Critical Rules

- **CRITICAL: `checkout/route.ts` must use `getAuthUser()`** — auth required server-side so `fulfillCheckoutSession()` can look up the user.
- **CRITICAL: Never return `{ url: null }` from checkout** — grants free access. Returns 503 error when Stripe not configured.
- **Stripe SDK v20**: `current_period_end` lives on `subscription.items.data[0]`, NOT directly on `subscription`.
- **Idempotent fulfillment**: `fulfillCheckoutSession()` is safe to call multiple times.
- **Settings page PaywallModal**: Upgrade button in Settings opens `PaywallModal` inline (not redirect to `/app/chat`). Settings displays plan name (Starter/Plus/Unlimited) with subtitle showing credits + message limits per plan.

### Environment Variables

All runtime env vars are stored in **AWS Secrets Manager** and injected by ECS at container start. Build-time vars are GitHub secrets baked into the Docker image.

```
# Injected by ECS from Secrets Manager at runtime:
# NOTE: Do NOT set ANTHROPIC_API_KEY in ECS — its absence triggers AWS Bedrock IAM auth
# ANTHROPIC_API_KEY=sk-ant-...          # Only for Vercel/local — omit for ECS/Bedrock
ANTHROPIC_MODEL=arn:aws:bedrock:us-east-1:236823123138:inference-profile/global.anthropic.claude-sonnet-4-6
ANTHROPIC_APPEAL_MODEL=arn:aws:bedrock:us-east-1:236823123138:inference-profile/global.anthropic.claude-opus-4-6-v1
# Bedrock: prefix is "global." NOT "us.", no ":0" suffix, full ARN required
# Vercel/local values: claude-sonnet-4-6-20260301 (chat) / claude-opus-4-6 (appeals)
DATABASE_URL=postgresql://...             # RDS connection string
COGNITO_USER_POOL_ID=us-east-1_...
COGNITO_CLIENT_ID=...
COGNITO_CLIENT_SECRET=...
AWS_REGION=us-east-1
SES_FROM_EMAIL=no-reply@denali.health          # AWS SES from address
BLUEBUTTON_CLIENT_ID=...
BLUEBUTTON_CLIENT_SECRET=...
BLUEBUTTON_BASE_URL=https://sandbox.bluebutton.cms.gov
FHIR_TOKEN_ENCRYPTION_KEY=...             # 32-byte hex key for AES-256-GCM token encryption
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PAY_PER_CLAIM=price_...     # Starter $10 one-time pay-per-claim (type=one_time)
STRIPE_PRICE_MONTHLY=price_...            # Plus $20/mo recurring (was STRIPE_PRICE_UNLIMITED_MONTHLY)
STRIPE_PRICE_UNLIMITED=price_...          # Unlimited $60/mo recurring
# DEPRECATED 2026-04-21 — IDME_* vars are NO LONGER USED in any environment.
# CMS confirmed ID.me is NOT REQUIRED for Blue Button API / Connected Apps Directory.
# Vars remain in denali/prod/app secret only for historical context; absent from denali/staging/app.
# REQUIRE_IDENTITY_VERIFICATION is permanently false; code removal pending in a future commit.
IDME_CLIENT_ID=...                        # [DEPRECATED — unused] ID.me OIDC client ID (sandbox)
IDME_CLIENT_SECRET=...                    # [DEPRECATED — unused] ID.me OIDC client secret (sandbox)
IDME_BASE_URL=https://api.idmelabs.com    # [DEPRECATED — unused] ID.me sandbox base URL
REQUIRE_IDENTITY_VERIFICATION=false       # [DEPRECATED — permanently false] historically: false = Connected Apps Directory (no ID.me gate), true = Medicare App Library (ID.me required)

# Baked into Docker image at build time (GitHub secrets):
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_APP_URL=https://denali.health  # or https://staging.denali.health
```

> **Note**: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` were removed from `denali/prod/app` Secrets Manager on 2026-04-09. No Resend references remain in AWS. Email is exclusively via AWS SES (IAM auth).

### ECS Deployment Gotchas

- **Execution role needs explicit Secrets Manager permissions.** `AmazonECSTaskExecutionRolePolicy` only covers ECR + CloudWatch. Add inline policy `denali-secrets-access` to `denali-ecs-execution-role` covering `denali/*` and `rds!db-...-*` secret ARNs.
- **RDS managed secret (`rds!db-...`) only has `username` + `password`** — no `host`/`dbname`/`port`. Use `denali/prod/db` (self-managed) for all DB connection fields.
- **Audit task def secrets before every manual deployment**: `aws ecs describe-task-definition --task-definition denali:N --query "taskDefinition.containerDefinitions[0].secrets[*].valueFrom" --region us-east-1 --output json | sort -u`
- **DB credentials**: DB_USER/DB_PASSWORD reference `rds!db-...:username::` / `rds!db-...:password::` (auto-rotates every 7 days). DB_HOST/DB_NAME/DB_PORT are plain env vars.
- **Current task def**: denali:124, deployed 2026-04-10. Revision 124: removed RESEND_API_KEY and RESEND_FROM_EMAIL secret references after SES migration completion. See `memory/aws-ecs.md` and `memory/aws-infra.md` for full details.
- **audit_logs REVOKE** (2026-04-10): `denali_admin` can only INSERT and SELECT on `audit_logs`. UPDATE, DELETE, TRUNCATE revoked. Rollback: `GRANT UPDATE, DELETE, TRUNCATE ON audit_logs TO denali_admin;`
- **RDS is private-only** (2026-02-27): `PubliclyAccessible: false`. ECS→RDS connectivity via security group `sg-018b0bc1ca0f1db14` allowing port 5432 from ECS SG `sg-0c234bbde5efb2d53`. No public endpoint, no EIP on RDS.
- **CloudWatch log retention**: `/ecs/denali` set to 3 days (was 90). Sufficient for pre-launch debugging. Increase post-launch if needed.

### Infrastructure Scheduling (Cost Optimization)

Pre-launch cost optimization: ECS+RDS can be shut down outside working hours to save ~35-40% on compute costs.

**Shell aliases** (`infra/denali-aliases.sh`): `denali-up`, `denali-down`, `denali-status`. Source from `~/.zshrc`.

**Automated scheduler** (`infra/cfn-scheduler.json`): CloudFormation stack `denali-scheduler` with 3 Lambda functions + 3 EventBridge rules. **Status: DEPLOYED** (2026-02-27, simplified to single nightly shutdown 2026-04-21). Deploy/update via `infra/deploy-scheduler.sh`.

| Component        | Schedule (CT — CDT pin) | UTC Cron             |
| ---------------- | ----------------------- | -------------------- |
| Startup          | Daily 8:00am            | `cron(0 13 * * ? *)` |
| Shutdown nightly | Every night 11:00pm     | `cron(0 4 * * ? *)`  |
| Safety re-stop   | Every 6 days            | `rate(6 days)`       |

> **DST note**: Crons are pinned to CDT (UTC-5). In winter (CST, UTC-6) they shift one hour earlier — startup 7am, shutdown 10pm. Acceptable drift; update CFN if winter behavior matters.

**IAM role**: `denali-scheduler-lambda-role` with minimal permissions (RDS start/stop/describe on `denali-prod`, ECS update/describe on `denali-web`, CloudWatch Logs).

**Safety mechanism**: `denali-safety-stop` Lambda checks ECS desired count — if 0, re-stops RDS to handle AWS's 7-day auto-restart. If user is working (desired > 0), skips.

### Infrastructure Monitoring

**Monitor** (`infra/cfn-monitor.json`): CloudFormation stack `denali-monitor` with Lambda + SNS + 2 EventBridge rules. **Status: DEPLOYED** (2026-02-27). Deploy/update via `infra/deploy-monitor.sh`.

- **Lambda** `denali-monitor`: Checks ECS status, RDS status/public access, ALB target health, Cost Explorer (MTD + yesterday + forecast). Alerts on: ECS mismatch, RDS unexpected state, RDS public, ALB unhealthy, daily cost >$3, forecast >$60/mo.
- **Schedule**: 8:00 AM CT + 8:00 PM CT daily
- **SNS topic** `denali-monitor-alerts`: Email to `ramanac@gmail.com` + `admin@denali.health`. SMS not available (account in SMS sandbox — needs toll-free origination number to enable).
- **IAM role**: `denali-monitor-lambda-role` with ECS/RDS describe, ELB target health, Cost Explorer, SNS publish, CloudWatch.

### App-Level Error Alerting (2026-04-08)

CloudWatch Logs metric filters on `/ecs/denali` log group → custom metrics → alarms → SNS alerts.

| Filter         | Pattern                                                                            | Metric             | Alarm Threshold |
| -------------- | ---------------------------------------------------------------------------------- | ------------------ | --------------- |
| `AppErrors`    | `console.error`, `[ERROR]`, `Error:`, `FATAL`                                      | `AppErrorCount`    | >20 / 5min      |
| `ClaudeErrors` | `[CLAUDE API]`, `timed out`, `Stream error`, `Bedrock`, `ThrottlingException`      | `ClaudeErrorCount` | >5 / 5min       |
| `DBErrors`     | `connection refused`, `ETIMEDOUT`, `ECONNREFUSED`, `[DB]`, `connection terminated` | `DBErrorCount`     | >3 / 5min       |

Plus the custom metrics alarms from `withMetrics` wrapper:

- `Denali-ErrorRate`: HTTP 5xx ErrorCount Sum >10 / 5min
- `Denali-P95Latency`: RequestLatency p95 >5000ms / 5min

All 5 alarms → `denali-monitor-alerts` SNS topic. Logs Insights queries in `infra/cloudwatch-queries.md`.

### Lifecycle Policies

- **ECR**: 5-rule per-prefix policy as of 2026-04-23 (replaces earlier "keep last 3, any tag" rule that caused prod outage). See [Infrastructure Architecture → ECR Lifecycle Policies](#ecr-lifecycle-policies) for full rules.
- **S3 CloudTrail bucket**: Expire logs after 30 days (set 2026-02-27)

### AWS Resource Inventory (2026-02-28)

| Service            | Resource                            | Spec                                                                      | Est. Monthly Cost |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------- | ----------------- |
| RDS                | denali-prod                         | db.t4g.micro, PostgreSQL 16.9, 20GB gp3, private                          | ~$12.10           |
| ECS Fargate        | denali-web                          | 0.5 vCPU, 1GB RAM, task def :30                                           | ~$18.40           |
| ALB                | denali-alb                          | Application, internet-facing                                              | ~$16.20           |
| EIP                | 3× (ALB-attached)                   | All associated, no idle charge                                            | $0                |
| Secrets Manager    | 3 secrets                           | denali/prod/db, denali/prod/app, rds!db-...                               | ~$1.20            |
| CloudWatch Logs    | /ecs/denali                         | 3-day retention, ~8KB stored                                              | ~$0               |
| S3                 | denali-cloudtrail-logs              | CloudTrail storage, 30-day lifecycle                                      | ~$0.05            |
| CloudTrail         | denali-audit-trail                  | Multi-region, management events                                           | $0 (free tier)    |
| ECR                | denali                              | Docker images, keep-last-3 lifecycle                                      | $0 (free tier)    |
| Cognito            | denali-users                        | User pool (us-east-1_bA3bcPcy2)                                           | $0 (free tier)    |
| SNS                | denali-monitor-alerts               | 2 email subscriptions                                                     | $0 (free tier)    |
| IAM                | 5 denali roles                      | ecs-execution, ecs-task, github-actions, scheduler-lambda, monitor-lambda | $0                |
| Lambda             | 4 functions                         | shutdown, startup, safety-stop, monitor                                   | $0 (free tier)    |
| EventBridge        | 7 rules                             | 5 scheduler + 2 monitor                                                   | $0                |
| CloudWatch Alarms  | Denali-ErrorRate, Denali-P95Latency | `Denali/App` namespace, SNS alerts on error rate >10/5min or P95 >5s      | $0.20             |
| CloudFormation     | 2 stacks                            | denali-scheduler, denali-monitor                                          | $0                |
| **TOTAL**          |                                     | **24/7 runtime**                                                          | **~$48/mo**       |
| **With scheduler** |                                     | **~16hr/day weekdays**                                                    | **~$30-35/mo**    |

