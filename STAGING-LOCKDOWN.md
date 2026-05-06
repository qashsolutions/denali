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

These are not currently in source control. Future automation should capture them in Terraform or similar.

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
