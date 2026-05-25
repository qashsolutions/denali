# Security & HIPAA Compliance

Denali handles sensitive Medicare health data and must meet CMS interoperability requirements. This document covers authentication, authorization, encryption, auditing, consent management, and HIPAA compliance status.

> **Update — May 24, 2026:** Vercel and Supabase are no longer in use. All infrastructure (staging and production) now runs on AWS exclusively (ECS Fargate, RDS Postgres, Cognito, Bedrock, SES; AWS BAA executed 2026-02-25). Row-Level Security has been replaced by explicit `WHERE user_id = $1` clauses in application code. Strikethroughs below preserve the original text as historical record.

---

## Authentication

### Email OTP (Primary)

Primary authentication method. User enters email address, receives a one-time password, and verifies.

| Aspect | Detail |
|--------|--------|
| Provider | ~~Supabase Auth~~ AWS Cognito |
| Method | Email magic link / OTP |
| Required for | Appeal letters (first 3 free), subscription management, health data |
| Implementation | `useAuth` hook, Settings account section |

### TOTP MFA (Opt-In)

Time-based One-Time Password via authenticator app. Available in Settings > Security. Not required for any feature -- opt-in only for users who want extra protection.

| Aspect | Detail |
|--------|--------|
| Provider | ~~Supabase Auth (TOTP factor type)~~ AWS Cognito (TOTP factor type) |
| Enrollment | `TOTPEnrollModal` -- scan QR code, verify with 6-digit code |
| Challenge | `TOTPChallengeModal` -- prompted when accessing health data (if enrolled) |
| CMS requirement | None. TOTP is defense-in-depth, not CMS-mandated |
| UI | Settings > Security section |

~~Note: WebAuthn/passkeys are NOT supported by Supabase on any plan. TOTP and Phone are the only MFA factor types available.~~ (Note no longer applies — Cognito has a different MFA-factor set; TOTP is the factor in use.)

### Blue Button OAuth (IAL2/AAL2)

Identity proofing for Medicare health data access. Handled entirely by CMS via Medicare.gov.

| Aspect | Detail |
|--------|--------|
| Protocol | OAuth 2.0 with PKCE (S256) |
| Identity assurance | IAL2/AAL2 provided by Medicare.gov (CMS handles identity verification) |
| CMS compliance | Satisfies CMS A1 criterion via intermediary PHR path |
| Token storage | AES-256-GCM encrypted in `ehr_connections` table |

---

## Authorization

### ~~Supabase Row-Level Security (RLS)~~ (historical — RDS uses explicit `WHERE user_id = $1` clauses)

~~All tables have RLS policies enabled. Users can only access their own data.~~ All RDS queries include explicit `WHERE user_id = $1` clauses (RDS has no Row-Level Security); users can only access their own data.

| Table | ~~RLS Policy~~ Access control (now `WHERE user_id = $1`) |
|-------|-----------|
| `conversations` | User reads/writes own conversations |
| `messages` | User reads/writes own messages |
| `appeals` | User reads own appeals |
| `consent_preferences` | User reads/writes own preferences |
| `fhir_cache` | User reads own cached health data |
| `audit_logs` | Users read own logs; service role writes |
| `ehr_connections` | User reads own connection; admin writes tokens |

> **Historical (post-2026-02-26 migration):** The following Admin Client Usage subsection describes the Supabase admin-client pattern that no longer exists. The operations themselves still happen (token writes, audit log writes, account deletion) — now via direct RDS queries via the pg pool. Preserved as historical record.

### ~~Admin Client Usage~~

~~Some operations require bypassing RLS via the Supabase admin client (service role):~~

| ~~Operation~~ | ~~Why Admin Client~~ |
|-----------|-----------------|
| ~~Token writes (`ehr_connections`)~~ | ~~Encrypted tokens written server-side during OAuth callback~~ |
| ~~Audit log writes~~ | ~~`logAudit()` fires non-blocking; bypasses RLS for reliability~~ |
| ~~Account deletion~~ | ~~`delete_user_cascade()` needs cross-table access~~ |

### ~~Key RLS Gotchas~~ (historical — RDS has no RLS)

~~These are common pitfalls when working with Supabase RLS:~~ (Historical — RDS has no RLS; queries are direct SQL with explicit `WHERE user_id = $1`.)

| Gotcha | Explanation | Solution |
|--------|-------------|----------|
| **NULL = NULL is false** | `auth.uid() = user_id` fails when both are NULL | Use: `OR (auth.uid() IS NULL AND user_id IS NULL)` |
| **INSERT + .select()** | PostgREST RETURNING clause needs SELECT policy to pass too | Ensure both INSERT and SELECT policies exist |
| **UPDATE checks SELECT** | PostgreSQL combines SELECT + UPDATE -- row must pass SELECT first | Row must match both policies |
| ~~**Cross-RLS operations**~~ | ~~Functions that touch multiple users' data or system tables~~ | ~~Use `SECURITY DEFINER` functions (e.g., `claim_conversation()`)~~ |
| **Server route.ts = anon** | `createBrowserClient` on server has no auth context | Server creates anonymously; client claims via RPC |

---

## Data Encryption

### FHIR Tokens (At Rest)

| Aspect | Detail |
|--------|--------|
| Algorithm | AES-256-GCM |
| Key | `FHIR_TOKEN_ENCRYPTION_KEY` environment variable (32-byte hex, 64 hex chars) |
| Scope | Access tokens and refresh tokens in `ehr_connections` table |
| Implementation | `src/lib/fhir/crypto.ts` |
| Key separation | Encryption key stored in ~~Vercel env vars~~ AWS Secrets Manager (injected via ECS task definition), not in database |

> **Historical (post-2026-02-26 migration):** The following "Supabase Encryption" subsection described Supabase-managed infrastructure encryption. Replaced by AWS RDS AES-256 via KMS. Preserved as historical record.

### ~~Supabase Encryption~~

~~Supabase provides encryption at rest for all database storage. This is infrastructure-level and does not require application configuration.~~

### PKCE Artifacts

| Artifact | Storage | TTL |
|----------|---------|-----|
| `state` token | httpOnly cookie | 10 minutes |
| `code_verifier` | httpOnly cookie | 10 minutes |
| Both cleared after OAuth callback completes |

---

## Audit Logging

### `audit_logs` Table

All security-sensitive operations are logged to the `audit_logs` table.

| Field | Description |
|-------|-------------|
| `action` | What happened (e.g., `fhir_authorize`, `appeal_generated`, `consent_changed`) |
| `resource` | What was affected (table name, resource ID) |
| `user_id` | Who performed the action (nullable for anonymous) |
| `ip_address` | Client IP address |
| `user_agent` | Client user agent string |
| `metadata` | JSON with action-specific details |
| `created_at` | Timestamp |

### `logAudit()` Utility

Defined in `src/lib/audit.ts`. Non-blocking fire-and-forget writes ~~via admin client (bypasses RLS)~~ via pg pool to RDS.

### Covered Operations

| Operation | Action Logged |
|-----------|--------------|
| FHIR authorize (initiate Blue Button) | `fhir_authorize` |
| FHIR callback (token exchange) | `fhir_callback` |
| FHIR data access | `fhir_data_access` |
| FHIR disconnect | `fhir_disconnect` |
| Appeal letter generated | `appeal_generated` |
| Consent preference changed | `consent_changed` |
| Account deletion | `account_deleted` |
| Checkout / payment | `checkout` |
| Trial started | `trial_started` |

---

## Consent Management

### `consent_preferences` Table

Per-user consent toggles that gate data usage:

| Toggle | Purpose | Default |
|--------|---------|---------|
| `health_data_ai` | Allow health data injection into Claude prompts | `false` |
| `health_data_storage` | Allow caching of health data in `fhir_cache` | `false` |
| `analytics` | Allow anonymized usage analytics | `false` |

### Enforcement

- `buildHealthContextForPrompt()` checks `health_data_ai` before injecting health data
- FHIR data fetch respects `health_data_storage` for caching
- All consent changes are versioned and audit-logged
- UI: Settings > Privacy & Data section with toggles
- Hook: `useConsent()` manages consent state client-side

---

## Privacy

### Data Not Stored

Denali does NOT store the following PII:
- Full names
- Addresses
- Social Security numbers
- Insurance IDs
- Medical records (raw FHIR data is cached temporarily, not permanently stored)

### Data Stored

| Data | Purpose | Protection |
|------|---------|------------|
| Email | Authentication (OTP) | ~~Supabase Auth~~ AWS Cognito |
| Phone | Authentication (OTP for paid plans) | ~~Supabase Auth~~ AWS Cognito |
| Conversation content | Chat history | ~~RLS (user-only access)~~ explicit `WHERE user_id = $1` (user-only access) |
| Anonymized phrases | Learning system | No user link |
| Medicare ID | Display only | Masked as `***1234` |

### Account Deletion

`delete_user_cascade()` provides GDPR/CCPA compliant deletion:

1. Delete `ehr_connections` (FHIR tokens become irrecoverable)
2. Delete `fhir_cache` entries
3. Delete conversations and messages
4. Delete appeals
5. Delete consent preferences
6. Delete usage records
7. Cancel Stripe subscription (if active)
8. ~~Delete Supabase auth user~~ Delete AWS Cognito user via `CognitoIdentityProviderClient.AdminDeleteUser()`
9. Retain anonymized learning data (no user link)

Triggered via Settings > Danger Zone with 2-step confirmation. Calls `/api/account/delete`.

---

## HIPAA Compliance Status

### Implemented (Technical Controls)

| Control | Status | Implementation |
|---------|--------|---------------|
| Access control ~~(RLS)~~ | Done | ~~Supabase RLS on all tables~~ Explicit `WHERE user_id = $1` clauses on all RDS queries |
| Encryption at rest | Done | AES-256-GCM for tokens, ~~Supabase infra encryption~~ AWS RDS AES-256 via KMS |
| Encryption in transit | Done | HTTPS everywhere ~~(Vercel + Supabase)~~ (AWS ALB termination → ECS Fargate; RDS TLS-only) |
| Audit logging | Done | `audit_logs` table with comprehensive coverage |
| Consent management | Done | `consent_preferences` with enforcement |
| Minimum necessary | Done | Scoped FHIR access, minimal PII storage |
| Account deletion | Done | `delete_user_cascade()` with full data removal |
| AI disclaimers | Done | "AI-generated . Not medical advice" on all responses |

### Remaining Gaps

| Gap | Priority | Type | Description |
|-----|----------|------|-------------|
| ~~**BAA with Supabase**~~ Closed | ~~P0~~ | ~~Process~~ Done | ~~Business Associate Agreement required for HIPAA covered entity status~~ Subsumed by AWS BAA (executed 2026-02-25); Supabase removed |
| ~~**BAA with Vercel**~~ Closed | ~~P0~~ | ~~Process~~ Done | ~~Hosting provider must sign BAA~~ Subsumed by AWS BAA (executed 2026-02-25); Vercel removed |
| **HITRUST certification** | P0 | Process | CMS Criterion 26 requires HITRUST or equivalent |
| **Breach notification plan** | P0 | Process | Documented procedures for data breach response |
| **HIPAA policies document** | P0 | Documentation | Written policies for workforce, access management, incident response |
| **Risk assessment** | P0 | Process | Formal security risk assessment per HIPAA Security Rule |
| **Patient-facing audit viewer** | P1 | Code | Let users view their own audit log (Settings > Activity Log) |

---

## Environment Variables (Security-Relevant)

| Variable | Purpose | Sensitivity |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Claude API access | High -- never expose client-side |
| `FHIR_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for FHIR tokens | Critical -- loss means token re-encryption needed |
| `BLUEBUTTON_CLIENT_SECRET` | CMS OAuth client secret | High -- server-side only |
| `STRIPE_SECRET_KEY` | Stripe API access | High -- server-side only |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | High -- prevents forged webhooks |

~~All secrets are stored in Vercel environment variables and never committed to source control.~~ All secrets are stored in AWS Secrets Manager and injected at ECS task startup via the task definition. Secrets are never committed to source control.
