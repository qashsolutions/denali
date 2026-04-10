# AWS SES Production Verification

**Date:** 2026-04-10
**Region:** us-east-1

## Sending Status

| Attribute           | Value                                  |
| ------------------- | -------------------------------------- |
| Sending enabled     | Yes                                    |
| Production access   | Granted (review case #177389296600910) |
| Daily sending quota | 50,000 emails/day                      |
| Max send rate       | 14 emails/second                       |
| Verified domain     | denali.health                          |
| AWS BAA executed    | 2026-02-25                             |

## SES as Sole Email Vendor

AWS SES is the only email delivery service used by Denali Health. SES operates within the AWS BAA covering RDS, ECS/Fargate, Bedrock, and SES.

Email is used for:

- OTP authentication codes (`/api/auth/send-otp`)
- Health report delivery (`/api/health-report/email`)
- Policy change notifications (`/api/admin/email/policy-change`)
- Alert notifications (`lib/alerts/engine.ts`)

All email sending flows through `src/lib/email.ts`, which uses `@aws-sdk/client-sesv2` with IAM auth (ECS task role in production).

## Resend Residue Check

Resend (previous email vendor) was fully removed:

- **AWS Secrets Manager:** `RESEND_API_KEY` and `RESEND_FROM_EMAIL` removed from `denali/prod/app` on 2026-04-09
- **ECS task definition:** Resend secret references removed in revision 124 (2026-04-10)
- **Application code:** Zero `from "resend"` imports, zero `resend.com` API calls
- **Legal pages:** Resend removed from FAQ, Privacy, and HIPAA vendor disclosures (commit `4237b8c`)
- **Privacy policy:** AWS SES explicitly named in primary vendor bullet and vendor commitments paragraph

## Verification Method

AWS CLI: `aws sesv2 get-account --region us-east-1`
Codebase: `grep -rn "resend" app/src/` returns zero application-layer references
