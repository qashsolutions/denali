# Staging Lockdown

**Last updated:** 2026-05-06
**Purpose:** Restrict access to `staging.denali.health` to two specific email addresses.
**Scope:** Staging environment only. Prod is unaffected by all changes documented here.

## Threat model

The staging URL is publicly reachable on the internet (no IP restriction — access from anywhere is allowed by design). All authentication paths into the app are gated to a small allowlist of email addresses.

## How the lockdown works

1. **Email allowlist at the auth-route layer.** Any email not in `STAGING_EMAIL_ALLOWLIST` (an ECS task-definition env var) is rejected at `/api/auth/send-otp` and `/api/auth/verify-otp` with `HTTP 403 {"error":"Not allowed"}` before any Cognito or SES call.
2. **Cognito self-signup disabled.** `AllowAdminCreateUserOnly: true` on the staging user pool. Bypassing the route still hits a closed door.
3. **Server-side admin gate.** `/admin/content` returns 404 via `notFound()` in the server component for unauthenticated or non-admin requests.
4. **Host gate on `/api/cms-metadata`.** Returns `404 {"error":"Not Found"}` on the staging hostname; prod unchanged.
5. **CSP enforced.** Was Report-Only. `unsafe-inline` for scripts/styles remains pending nonce wiring.

## AWS-side changes (not in IaC)

| Component | Change | Where set |
|---|---|---|
| Cognito user pool `denali-staging-users` | Self-service sign-up disabled (`AllowAdminCreateUserOnly: true`) | Console → Cognito → User pools → Sign-up tab |
| Cognito user pool `denali-staging-users` | MFA enforcement = OFF (cannot be set to Required — see Known gaps) | Console → same pool → Sign-in tab → MFA |
| ECS task definition `denali-staging` | Env var `STAGING_EMAIL_ALLOWLIST` added (rev 58) | Console → ECS → Task definitions |
| ECS task definition `denali-staging` | **The E2E test-OTP env vars MUST NOT be set here.** `E2E_TEST_OTP_ENABLED=true` is fatal on any *deployed* service: `next start` forces `NODE_ENV=production`, and the module-load assertion in `e2e-test-otp.ts` throws on `flag && NODE_ENV==="production"`, crashing `verify-otp` (breaks sign-in). The bypass runs only in a `NODE_ENV !== "production"` backend (local `next dev` / CI) — see "E2E test-OTP bypass" below. The prod deploy gate independently refuses any task def carrying `E2E_TEST_OTP*` keys. | n/a — never on a deployed task def |
| Cognito user pool `denali-staging-users` | Test account `e2e@denali.health` created with a permanent password equal to the static-password secret. A **local/CI backend** (NODE_ENV ≠ production) can point at this staging pool and mint real sessions via `ADMIN_USER_PASSWORD_AUTH` — the pool's app client has `ALLOW_ADMIN_USER_PASSWORD_AUTH` enabled. The pool is environment-agnostic; the `NODE_ENV` constraint is on the *backend process* running `verify-otp`, not on which pool it talks to. | Console → Cognito + RDS seed |

These are not currently in source control. Future automation should capture them in Terraform or similar.

## E2E test-OTP bypass — operating instructions

The bypass lives in `app/src/lib/e2e-test-otp.ts` and is invoked from
`app/src/app/api/auth/verify-otp/route.ts`. The five-guard stack (see
the module docstring) is structurally unreachable in production.

### ⛔ Where it can and cannot run (read first)

**The bypass runs ONLY in a backend process where `NODE_ENV !== "production"`** —
i.e. a local `next dev` server or a CI job, never a *deployed* ECS
service. Two independent code paths enforce this:

- **Guard G2** denies every bypass attempt when `process.env.NODE_ENV === "production"`.
- The **module-load assertion** `assertProdAndFlagNeverCoexist()` *throws*
  when `E2E_TEST_OTP_ENABLED=true` AND `NODE_ENV === "production"` — so the
  `verify-otp` route module fails to import and the auth route 500s.

`next start` (every deployed service, **staging included**) forces
`NODE_ENV=production`. Therefore **the `E2E_TEST_OTP_*` env vars must
never be set on the deployed `denali-staging` (or prod) ECS task def** —
doing so breaks sign-in for everyone on that service. (Confirmed the hard
way 2026-06-10: setting the flag on a staging task-def revision was the
fatal combination; reverted immediately.)

The `NODE_ENV` constraint is on the **backend process**, not the data
plane. A local/CI backend (NODE_ENV ≠ production) may freely point at the
staging Cognito pool, staging RDS, and the Blue Button sandbox — that's
the intended setup for E2E.

### Setup for a local / CI backend

1. **Process env** (e.g. `app/.env.local` for `next dev`, or the CI job's
   env block — **not** a deployed task def):

   ```
   E2E_TEST_OTP_ENABLED=true
   E2E_TEST_OTP_EMAILS=e2e@denali.health
   E2E_TEST_OTP_CODE=999999
   E2E_TEST_OTP_STATIC_PASSWORD=<static-password>
   ```

2. **Cognito user** in whichever pool that backend authenticates against
   (the staging pool works). Permanent password == the static password;
   app client needs `ALLOW_ADMIN_USER_PASSWORD_AUTH`.

   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <pool-id> \
     --username e2e@denali.health \
     --user-attributes Name=email,Value=e2e@denali.health \
                       Name=email_verified,Value=true \
     --message-action SUPPRESS
   aws cognito-idp admin-set-user-password \
     --user-pool-id <pool-id> \
     --username e2e@denali.health \
     --password "<static-password>" --permanent
   ```

3. **DB row**: the bypass path still requires an existing `users` +
   `user_verification` row for the email (verify-otp returns
   `OTP_NOT_FOUND` otherwise). In the staging pool/RDS these are created
   the first time `send-otp` is called for the address.

### Known caveats (current code — reconcile before relying on the flow)

- **Email allowlist.** If the backend has `STAGING_EMAIL_ALLOWLIST` set,
  `e2e@denali.health` must be on it — both `send-otp` and `verify-otp`
  return 403 before the bypass runs otherwise. A plain local `next dev`
  usually leaves this unset (no-op).
- **`send-otp` rotates the Cognito password.** Every `send-otp` call runs
  `setCognitoPassword(email, "Otp.<otp>!")`, but the bypass authenticates
  with the *static* password. So a flow that taps "send code" before
  "verify" (the current Maestro `signin_onboarding.yaml` does) leaves the
  Cognito password ≠ the static password, and the bypass's
  `ADMIN_USER_PASSWORD_AUTH` then fails. This is an **unresolved gap** in
  the current code: a working local E2E run must either re-assert the
  static password after `send-otp`, or pre-seed the `user_verification`
  row and skip the send-otp tap. (A code fix is deferred — see the
  redesign option in the 2026-06-10 session notes.)

### Prod safety (unchanged)

- **Prod deploy gate**: `.github/workflows/deploy.yml` step `Prod task-def
  gate — refuse any E2E_TEST_OTP env var` fails the prod deploy if any env
  key starts with `E2E_TEST_OTP`. Belt-and-braces alongside the in-process
  startup assertion above.
- **Removal** (if ever set on a deployed service by mistake): delete the
  `E2E_TEST_OTP_*` env vars from the task def and redeploy; the helper
  denies at G1 and the real OTP path is untouched.

## Code-side changes (develop branch)

| File | Change |
|---|---|
| `app/src/lib/auth-server.ts` | Added `isEmailAllowed()` and `getAuthUserFromServerContext()` helpers |
| `app/src/app/api/auth/send-otp/route.ts` | Allowlist check before rate-limit/Cognito/SES |
| `app/src/app/api/auth/verify-otp/route.ts` | Allowlist check before rate-limit/Cognito |
| `app/src/app/admin/content/page.tsx` | Server component with admin auth check; client `router.push("/")` retained as fallback |
| `app/src/app/api/cms-metadata/route.ts` | Host-header gate; returns `Response.json({ error: "Not Found" }, { status: 404 })` on staging |
| `app/next.config.ts` | CSP header `Content-Security-Policy-Report-Only` → `Content-Security-Policy` |

## Operating the allowlist

**Current allowlisted emails:** see the `STAGING_EMAIL_ALLOWLIST` env var on the latest staging task definition revision.

**To add or remove an email:**
1. Console → ECS → Task definitions → `denali-staging` → Create new revision.
2. Edit the `denali` container's `STAGING_EMAIL_ALLOWLIST` (comma-separated, no spaces).
3. Update service `denali-staging-web` to use the new revision.
4. Next deploy on push to `develop` inherits the env var via `describe-task-definition`.

The check is exact-match after `trim` + `lowercase`. Gmail dot-insensitivity and `+tag` aliasing are NOT handled — log in with the exact form stored in the env var.

## Known gaps

1. **MFA Required is incompatible with the custom email-OTP flow.** The app uses Cognito's `CUSTOM_AUTH` flow. Setting MFA enforcement to Required at the user pool causes Cognito to return a `SOFTWARE_TOKEN_MFA` next-challenge after the custom challenge succeeds. `/api/auth/verify-otp` doesn't handle that response shape — it treats anything other than an `AuthenticationResult` as a 400 failure, which blocks login entirely. This was attempted on 2026-05-06 and rolled back to MFA OFF after both allowlisted users could no longer sign in. To enforce MFA properly, extend the verify-otp route to handle the next-challenge response, prompt the user for TOTP, and complete the auth flow. Until then, MFA stays OFF at the pool level. Per-user TOTP enrollment via Cognito (e.g., admin accounts that have enrolled) does not affect sign-in because `CUSTOM_AUTH` doesn't invoke that challenge.
2. **CSP `unsafe-inline` allowance.** script-src and style-src both allow inline. Removing requires Next.js nonce or hash-based CSP.
3. **Shared AWS account.** Staging and prod share one account, one ALB, one ALB security group. Resource naming (`denali-staging-*`) is the only separator. Account split is the durable fix.
4. **No IaC source of truth.** ALB listener rules, security groups, ECS task definitions, and Cognito pool settings are managed via console.

## Rollback

| Change | Rollback |
|---|---|
| Email allowlist code | Revert commit, push to `develop` |
| `STAGING_EMAIL_ALLOWLIST` env var | Remove from task definition; allowlist code becomes a no-op |
| Cognito self-signup | Console → User pools → Sign-up → re-enable self-registration |
| Cognito MFA | Console → User pools → Sign-in → MFA → Optional or Off |
| Admin gate | Revert commit |
| CMS-metadata host gate | Revert commit |
| CSP enforcement | Revert commit (header reverts to Report-Only) |

## Verification commands

Last verified: 2026-05-06.

```bash
# Block path
curl -X POST https://staging.denali.health/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"random@example.com"}'
# Expect: 403 {"error":"Not allowed"}

# Admin gate
curl -i https://staging.denali.health/admin/content
# Expect: 404

# Host gate
curl -i https://staging.denali.health/api/cms-metadata
# Expect: 404 + {"error":"Not Found"}
curl -i https://denali.health/api/cms-metadata
# Expect: 200 + JSON metadata

# CSP enforced
curl -I https://staging.denali.health/ | grep -i security-policy
# Expect: content-security-policy: ... (no -report-only suffix)
```
