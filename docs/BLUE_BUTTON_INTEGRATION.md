# Blue Button 2.0 Integration

Denali connects Medicare patients to their claims data via CMS Blue Button 2.0 FHIR APIs. This document covers the OAuth flow, token management, data pipeline, and AI integration.

---

## OAuth Flow (PKCE)

Blue Button uses OAuth 2.0 with PKCE (Proof Key for Code Exchange, RFC 7636) to securely connect patients to their Medicare data without exposing client secrets to the browser.

### Sequence

```
1. User clicks "Connect Medicare" on /app/health
        |
        v
2. GET /api/fhir/authorize
   - Generate random `state` token (CSRF protection)
   - Generate random `code_verifier` (PKCE)
   - Compute `code_challenge` = base64url(SHA256(code_verifier))
   - Store state + code_verifier in httpOnly cookies (10 min TTL)
   - Redirect to CMS:
     /v2/o/authorize/?client_id=...&code_challenge=...&code_challenge_method=S256
        |
        v
3. User authenticates on Medicare.gov (IAL2/AAL2 handled by CMS)
   - User authorizes data sharing
   - CMS redirects to /api/fhir/callback?code=...&state=...
        |
        v
4. GET /api/fhir/callback
   - Validate state cookie matches state param (CSRF check)
   - Read code_verifier cookie
   - POST /v2/o/token/ with { code, code_verifier, redirect_uri } + Basic Auth
   - Receive access_token + refresh_token + patient FHIR ID
   - Encrypt tokens with AES-256-GCM
   - Upsert ehr_connections table
   - Clear cookies
   - Redirect to /app/health?connected=true
```

### FHIR Scopes

```
patient/Patient.read
patient/Coverage.read
patient/ExplanationOfBenefit.read
profile
openid
```

Note: Observation (laboratory) data is fetched via the ExplanationOfBenefit scope in the Blue Button sandbox. In production, lab data access depends on CMS data availability.

---

## Token Security

| Aspect | Implementation |
|--------|---------------|
| Encryption algorithm | AES-256-GCM |
| Encryption key | `FHIR_TOKEN_ENCRYPTION_KEY` env var (32-byte hex) |
| Storage | `ehr_connections` table (Supabase) |
| Token writes | Admin client (bypasses RLS to write encrypted tokens) |
| Token reads | Server client (respects RLS, user can only read own tokens) |
| Auto-refresh | `refreshAccessToken()` in `lib/fhir/tokens.ts` handles expired access tokens transparently |
| PKCE artifacts | httpOnly cookies with 10-minute TTL, cleared after callback |

---

## FHIR Resources

| Resource | What It Provides | Key Fields |
|----------|-----------------|------------|
| **Patient** | Beneficiary demographics | Name, date of birth, Medicare ID (masked as ***1234) |
| **Coverage** | Insurance plan details | Plan name, type, period, status |
| **ExplanationOfBenefit** | Claims and EOB data | Service dates, procedures, amounts, adjudication, providers |
| **Observation** | Laboratory results | A1C, glucose values (fetched with `category=laboratory`) |

### Diabetes Lab Codes (LOINC)

| LOINC Code | Description | Clinical Use |
|------------|-------------|-------------|
| `4548-4` | Hemoglobin A1C | Primary diabetes monitoring (normal < 5.7%, pre-diabetic 5.7-6.4%, diabetic >= 6.5%) |
| `2345-7` | Glucose (serum/plasma) | Fasting blood glucose |
| `2339-0` | Glucose (blood) | Point-of-care glucose |
| `14771-0` | Fasting glucose | Fasting blood glucose (specific) |

---

## Data Pipeline

```
CMS Blue Button API (FHIR)
        |
        v
src/lib/fhir/client.ts          -- Fetches raw FHIR bundles
        |
        v
src/lib/fhir/transforms.ts      -- Transforms FHIR resources to UI-friendly format
        |                           extractDiabetesLabs() extracts lab values
        v
fhir_cache table                 -- Stores transformed data with 24h TTL
        |
        v
/api/fhir/data (GET)             -- Serves cached data to client
        |
        v
useHealthData() hook             -- Client-side state management
        |                           Populates sessionState health fields
        v
src/lib/fhir/context.ts         -- buildHealthContextForPrompt()
        |                           Injects health data into Claude system prompt
        v
Claude AI                        -- Receives coverage, labs, denials as context
```

### Cache Strategy

- Transformed FHIR data is cached in `fhir_cache` table with 24-hour TTL
- On data request: check cache freshness, return cached if valid, re-fetch if stale
- `sync.ts` handles cache synchronization logic
- Cache is RLS-protected: users can only read their own cached data

---

## Consent Gating

Health data injection into AI prompts is gated by user consent:

1. `consent_preferences` table stores per-user toggles
2. `health_data_ai` toggle must be `true` for AI context injection
3. `buildHealthContextForPrompt()` checks consent before building health context
4. If consent is off, Claude has no access to health data even if connected
5. Consent changes are versioned and audit-logged

---

## AI Integration

When health data is available and consent is granted, the following flows into the AI context:

| Data Type | Source | AI Use |
|-----------|--------|--------|
| Active coverage | Coverage resource | Verify Medicare enrollment, plan type |
| Recent claims | ExplanationOfBenefit | Identify recent procedures, detect denial patterns |
| Recent denials | EOB adjudication items | Proactive appeal guidance, denial code lookup |
| Lab results | Observation resource | Diabetes coaching, A1C interpretation, risk assessment |
| Patient demographics | Patient resource | Age-appropriate guidance, personalization |

### SessionState Health Fields

```typescript
healthDataAvailable: boolean    // FHIR connection active
activeCoverage: object[]        // Transformed coverage data
recentDenials: object[]         // Claims with denial adjudications
```

### Skill Triggers

| Trigger | Fires When | Skill Loaded |
|---------|-----------|--------------|
| `hasHealthData` | FHIR connection active + data available | `HEALTH_RECORDS_SKILL` |
| `hasRecentDenials` | EOB data contains denial adjudications | `HEALTH_RECORDS_SKILL` |
| `hasRecentChanges` | Coverage or EOB changes detected since last check | `MEDICARE_NOTIFICATIONS_SKILL` |
| `hasDiabetesContext` | A1C or glucose labs present in health data | `DIABETES_PREVENTION_SKILL` |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/fhir/crypto.ts` | AES-256-GCM encryption/decryption for FHIR tokens |
| `src/lib/fhir/tokens.ts` | Token storage, retrieval, refresh logic |
| `src/lib/fhir/client.ts` | FHIR API client (fetch Patient, Coverage, EOB, Observation) |
| `src/lib/fhir/transforms.ts` | FHIR resource transformation, `extractDiabetesLabs()` |
| `src/lib/fhir/context.ts` | `buildHealthContextForPrompt()` for AI injection |
| `src/lib/fhir/sync.ts` | Cache synchronization with TTL management |
| `src/app/api/fhir/authorize/route.ts` | OAuth initiation (PKCE state + code_verifier) |
| `src/app/api/fhir/callback/route.ts` | OAuth callback (token exchange + encryption + storage) |
| `src/app/api/fhir/data/route.ts` | FHIR data retrieval + cache serving |
| `src/app/api/fhir/disconnect/route.ts` | Revoke Blue Button connection |
| `src/hooks/useHealthData.ts` | Client-side hook for health data state |

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BLUEBUTTON_CLIENT_ID` | CMS Blue Button OAuth client ID | `abc123...` |
| `BLUEBUTTON_CLIENT_SECRET` | CMS Blue Button OAuth client secret | `secret...` |
| `BLUEBUTTON_BASE_URL` | CMS API base URL | `https://sandbox.bluebutton.cms.gov` (sandbox) or production URL |
| `FHIR_TOKEN_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM token encryption | `0a1b2c3d...` (64 hex chars) |

---

## Account Deletion

When a user deletes their account via `delete_user_cascade()`:

1. `ehr_connections` record deleted (step 0, before other deletions)
2. `fhir_cache` entries deleted
3. Tokens are irrecoverable (encrypted, key not stored with data)
4. Anonymized learning data retained per privacy policy
