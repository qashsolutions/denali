# Auth & Identity — AAL2 Compliance Strategy

## Context

CMS Interoperability Framework requires **AAL2** (Authenticator Assurance Level 2) for patient-facing apps (Criteria A1, 3, 23). CMS cites "passkeys" as an example AAL2 method, but the requirement is AAL2 — not passkeys specifically.

## Why Not WebAuthn/Passkeys

Supabase does not support WebAuthn MFA on any plan (Free, Pro, Team, Enterprise). The `supabase.auth.mfa.enroll({ factorType: 'webauthn' })` call returns: **"MFA enroll is disabled for WebAuthn"**.

Supabase MFA supports only:
- **TOTP** (authenticator app) — available on all plans
- **Phone** (SMS) — requires Pro plan

PasskeyEnrollModal and PasskeyChallengeModal exist in the codebase but are non-functional (dead code).

## NIST 800-63B: What Satisfies AAL2

Per [NIST SP 800-63B Section 4.2.1](https://pages.nist.gov/800-63-3/sp800-63b.html):

AAL2 requires **either**:
1. A **multi-factor authenticator** (standalone device), OR
2. A **memorized secret** (password/PIN) + one single-factor authenticator:
   - Single-Factor OTP Device (TOTP app)
   - Out-of-Band Device (phone SMS)
   - Single-Factor Cryptographic Software/Device

**What does NOT satisfy AAL2:**
- Email OTP alone (AAL1)
- Email OTP + TOTP (no memorized secret)
- TOTP alone (single factor)
- Two OOB devices without a memorized secret

## Denali Two-Layer AAL2 Strategy

### Layer 1: FHIR Data Access — Blue Button OAuth (CMS A1) ✅ DONE

| Component | AAL Level | Who Provides |
|-----------|-----------|-------------|
| Medicare.gov login | IAL2/AAL2 | CMS (identity-proofed) |
| OAuth 2.0 + PKCE | Secure token exchange | Denali (implemented) |

Medicare beneficiaries authenticate through Medicare.gov when connecting Blue Button. CMS has already identity-proofed these users at IAL2/AAL2. This satisfies CMS requirement A1 via the **"intermediary PHR app"** path.

**Key insight**: CMS A1 says apps can satisfy IAL2/AAL2 "either via an intermediary personal health record application OR using a CMS-approved service." Blue Button 2.0 is the intermediary PHR path — CMS handles the identity proofing, not Denali.

**What's implemented**:
- PKCE (RFC 7636) with S256 code challenge
- httpOnly cookies for state + code_verifier (10-min TTL)
- AES-256-GCM token encryption at rest
- FHIR authorize route checks TOTP enrollment → requires AAL2 if enrolled
- Scopes: `patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read profile openid`

### Layer 2: App Authentication — Email+Password + TOTP (P1, Not Yet Implemented)

| Component | NIST Category | AAL Level |
|-----------|---------------|-----------|
| Email + password | Memorized Secret | Factor 1 |
| TOTP (authenticator app) | Single-Factor OTP Device | Factor 2 |
| **Combined** | **Memorized Secret + OTP** | **AAL2** |

**Why P1 (not P0)**: Layer 1 (Blue Button) already satisfies CMS A1 minimum. Layer 2 adds defense-in-depth — if someone compromises a user's email (and thus email OTP), TOTP enrollment still blocks them from accessing cached health data. This is a security hardening measure, not a CMS compliance blocker.

**Migration required**: Switch sign-in from `signInWithOtp()` (magic link, AAL1) to `signInWithPassword()` (memorized secret). Keep email OTP as a password-reset/recovery path.

**Supabase support**: Native. `signUpWithPassword()`, `signInWithPassword()`, TOTP enroll/challenge all work on free plan.

## Current Implementation Status

### Working (Supabase-native)
- `useAuth.ts`: `enrollTOTP()`, `challengeAndVerifyTOTP()` — fully implemented
- `TOTPEnrollModal`: QR code enrollment flow (intro -> scan QR -> enter 6-digit code)
- `TOTPChallengeModal`: 6-digit verification for sensitive operations
- Settings Security section: wired to TOTP enrollment
- `authState.isMfaEnrolled`, `authState.isMfaVerified` — tracked from Supabase session
- Supabase AAL tracking: `auth.mfa.getAuthenticatorAssuranceLevel()` returns `aal1` or `aal2`
- FHIR authorize route: checks TOTP enrollment, requires AAL2 challenge if enrolled

### Not Yet Implemented (P1)
- **Email+password sign-in**: Currently email OTP only. Need `signUpWithPassword()` / `signInWithPassword()` flow
- **Full AAL2 gating**: Gate appeal generation behind AAL2 when TOTP enrolled
- **CMS credential service**: Connect to CMS-approved identity service for IAL2 (future)

### Non-functional (Supabase limitation)
- `PasskeyEnrollModal`: Calls `mfa.enroll({ factorType: 'webauthn' })` — always errors
- `PasskeyChallengeModal`: Never reachable since enrollment fails

## Migration Plan: Email OTP -> Email+Password (P1)

### Phase 1: Add password support alongside OTP
1. Add password field to sign-up flow in Settings
2. Use `supabase.auth.signUp({ email, password })` for new users
3. Keep email OTP as fallback/recovery
4. Existing OTP-only users prompted to set a password on next login

### Phase 2: Require password for AAL2 features
1. FHIR connect: require password login + TOTP if enrolled
2. Appeal generation (paid): require password login
3. Non-AAL2 features (coverage guidance, free appeals) remain email OTP

### Phase 3: Full AAL2 enforcement
1. Require TOTP enrollment for FHIR data access
2. Gate all health data operations behind AAL2
3. RLS policies check `(auth.jwt()->>'aal') = 'aal2'` on sensitive tables

## Key Files

| File | Role |
|------|------|
| `src/hooks/useAuth.ts` | Auth state, OTP, TOTP enroll/challenge, AAL tracking |
| `src/components/auth/TOTPEnrollModal.tsx` | TOTP enrollment UI (QR + 6-digit verify) |
| `src/components/auth/TOTPChallengeModal.tsx` | TOTP challenge UI (6-digit code entry) |
| `src/components/auth/index.ts` | Barrel exports (TOTPEnrollModal, TOTPChallengeModal) |
| `src/app/app/settings/page.tsx` | Settings Security section with TOTP enrollment |
| `src/app/api/fhir/authorize/route.ts` | FHIR OAuth — checks TOTP AAL2 before allowing connect |

## References

- [NIST SP 800-63B — Authentication & Lifecycle](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [NIST AAL Implementation Resources](https://pages.nist.gov/800-63-3-Implementation-Resources/63B/AAL/)
- [CMS Interoperability Framework](https://www.cms.gov/health-technology-ecosystem/interoperability-framework)
- [CMS Health Tech Categories](https://www.cms.gov/health-technology-ecosystem/categories)
- [Supabase MFA Docs](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase MFA TOTP Guide](https://supabase.com/docs/guides/auth/auth-mfa/totp)
