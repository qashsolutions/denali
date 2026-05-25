# CMS Blue Button Production Access Form — Responses

**Applicant:** Qash Solutions Inc
**Application:** Denali — www.denali.health
**Prepared:** 2026-02-24
**Form URL:** https://cmsapps.my.site.com/BB2Application/s/prod-access-form?id=a0zSJ00000TRvCnYAL

All responses are grounded in the live privacy policy at https://www.denali.health/privacy
and terms of service at https://www.denali.health/terms.

> **Update — May 24, 2026:** Vercel and Supabase are no longer in use. All infrastructure (staging and production) now runs on AWS exclusively (ECS Fargate, RDS Postgres, Cognito, Bedrock, SES; AWS BAA executed 2026-02-25). Row-Level Security has been replaced by explicit `WHERE user_id = $1` clauses in application code. Strikethroughs below preserve the original text as historical record.

---

## Question: If data is shared with third-parties, is that on a one-time basis or persistently collected?

**Response:**

Data sharing varies by third party. Each relationship is labeled in our Privacy Policy (§5):

| Third Party | Basis | Duration |
|-------------|-------|----------|
| **Anthropic (Claude AI)** | Transactional — per-message | Each request is independent. Anthropic retains API inputs/outputs up to 30 days for safety monitoring, then auto-deletes. |
| **CMS (Medicare API)** | Persistent | While the user's Medicare connection is active. Ceases immediately on disconnect. |
| ~~**Supabase (database)**~~ **AWS RDS PostgreSQL (database)** | Persistent | For the lifetime of the user's account. Deleted on account deletion. |
| ~~**Vercel (hosting)**~~ **AWS ECS Fargate (hosting)** | Transactional — per-request | Server-side request logs retained up to 30 days in CloudWatch. |
| **Stripe (payments)** | Transactional — per-payment event | We never see or store credit card numbers. |
| **Legal/Regulatory** | As required | Only when compelled by law, court order, or government regulation. |

---

## Question: If data is shared with third-parties, how will you obtain users' informed, proactive consent in advance of data sharing?

**Response:**

Informed, proactive consent is obtained through layered mechanisms before any data sharing occurs:

1. **Medicare data → Anthropic (Claude AI):**
   Users must explicitly enable the "Use health data in AI conversations" toggle in Settings > Privacy & Data before any Medicare claims data is sent to Anthropic. This toggle defaults to **OFF**. The toggle label clearly states: "This data is sent to Anthropic's Claude AI to generate personalized guidance." No health data reaches Anthropic unless the user affirmatively turns this on.

2. **Medicare data → CMS API:**
   Users must complete the full OAuth 2.0 authorization flow on the official Medicare.gov website — they actively log in to Medicare.gov and click "Authorize" to grant access. We never initiate data retrieval without this explicit authorization. Users can revoke this connection at any time in Settings.

3. **Payment data → Stripe:**
   Data sharing with Stripe is initiated only when the user chooses to make a payment. The user enters the checkout flow voluntarily.

4. ~~**Infrastructure providers (Supabase, Vercel):**~~ **Infrastructure providers (AWS):**
   These providers receive data in the course of operating the service. Their use is disclosed in the Privacy Policy (§5), which users must acknowledge at account creation. Account creation requires an affirmative action (entering an email and verifying a one-time passcode) — we do not assume acceptance through passive use.

5. **All sharing:**
   The Privacy Policy is publicly accessible at https://www.denali.health/privacy before account creation. Users must actively create an account to use the service, constituting informed acceptance.

---

## Question: If your application works with third-party vendors, do your third-party vendors commit to data protection requirements consistent with the law and your expectations, both based on the sensitivity of PII/PHI?

**Response: YES**

All third-party vendors are contractually required to protect user information using safeguards appropriate to the sensitivity of the data they handle, consistent with applicable law (Privacy Policy §5, §9):

- ~~**Supabase** — SOC 2 compliant. BAA being established as our database provider handling PHI.~~ **AWS** — SOC 2 Type II compliant. AWS BAA executed 2026-02-25 (covers RDS, ECS, Bedrock, Cognito, SES); a single BAA covers all HIPAA-eligible services.
- ~~**Vercel** — SOC 2 compliant. BAA being established as our hosting provider.~~ (Hosting subsumed by the AWS BAA above; Vercel removed.)
- **Anthropic** — SOC 2 Type II certified. Does not train models on API-submitted data. Retains inputs/outputs maximum 30 days for safety monitoring only.
- **Stripe** — PCI DSS certified. Handles payment data only; never receives health information.

Business Associate Agreements are required from all service providers who access, process, or store protected health information on our behalf, as required under HIPAA (Privacy Policy §9). ~~BAAs with Supabase and Vercel are currently being finalized and will be executed prior to production launch.~~ AWS BAA executed 2026-02-25 covers all HIPAA-eligible services (RDS, ECS, Bedrock, Cognito, SES); Supabase and Vercel are no longer used.

---

## Question: What happens if your company is sold and the use of user's data could change in a material way? Are Medicare enrollees and CMS notified?

**Response:**

**Medicare enrollees:** Yes — notified via email at least **30 days before** any data transfer to a new entity, with a plain-language explanation of what is changing (Privacy Policy §5, Business Transfers). Users may delete their accounts and all associated data before the effective date if they do not agree to the new terms.

**CMS:** Yes — as a participant in the CMS Health Technology Ecosystem and a holder of Blue Button API production credentials, we commit to notifying CMS at the earliest practicable time if a merger, acquisition, or material change of control occurs that could affect how Medicare data is handled. We understand that production API credentials are issued to a specific approved application and entity, and that a change of ownership requires re-review.

---

## Question: Do you understand — Your application may only collect health information that a user expressly consents to?

**Response: YES — Understood and implemented.**

- Medicare data is accessed only after the user completes the OAuth authorization on Medicare.gov.
- Health data is only used in AI conversations if the user has enabled the "Use health data in AI conversations" toggle (opt-in, defaults OFF).
- Health data is only cached locally if the user has enabled "Store health data locally" (opt-in, defaults OFF).
- All three consent preferences default to OFF. No health data is collected or used without an affirmative opt-in action by the user.

---

## Question: Do you understand — Your application may only collect, use, and disclose health information in ways that are consistent with user expectation and consent?

**Response: YES — Understood and implemented.**

Medicare data is used solely for the three purposes disclosed to users at the time of collection (Privacy Policy §5, Terms §5):
1. Displaying their health information to them directly.
2. Providing AI-powered Medicare coverage guidance and appeal assistance.
3. Personalizing AI conversations — only with explicit `health_data_ai` consent enabled.

It is not used for advertising, sold to any party, used for employment or insurance decisions, or shared beyond the vendors named in the Privacy Policy. Purpose limitation is enforced in code: `buildHealthContextForPrompt()` returns null unless `consentHealthDataAi === true`.

---

## Question: You commit to following laws and best-practices to minimize the risk of unauthorized access, use, destruction, unauthorized annotation or disclosure of user data?

**Response: YES — Committed and implemented.**

Technical and administrative safeguards in place (Privacy Policy §8, §9):

- **Encryption at rest:** AES-256-GCM for all OAuth tokens
- **Encryption in transit:** TLS 1.2+ for all data
- **Database security:** ~~Row-Level Security (RLS) — each user can only access their own rows~~ Explicit `WHERE user_id = $1` clauses on all RDS queries (RDS has no Row-Level Security); each user can only access their own rows.
- **Authentication:** Email OTP (one-time passcode); optional TOTP multi-factor authentication
- **OAuth security:** PKCE (Proof Key for Code Exchange) prevents authorization code interception
- **Audit logging:** Every sensitive data access is logged (who, what, when, why) and visible to the user in Settings > Data Access History
- **Consent enforcement:** All three consent preferences enforced before data is used or shared
- **HIPAA BAAs:** ~~In place with Supabase and Vercel~~ AWS BAA executed 2026-02-25 (covers RDS, ECS, Bedrock, Cognito, SES); Supabase and Vercel no longer in use.
- **Incident response:** Documented procedures to detect, investigate, and contain breaches
- **Minimum retention:** Health data cache refreshes every 24 hours; deleted immediately on disconnect or account deletion

---

## Question: You agree to comply with applicable breach notification laws and provide meaningful remedies to address security breaches, privacy, or other violations incurred because of misuse of the user's health information?

**Response: YES — Agreed and documented.**

We comply with the **FTC Health Breach Notification Rule (16 CFR Part 318)** and the **HITECH Act** breach notification requirements (Privacy Policy §10):

- Affected individuals notified **within 60 days** of discovery via email
- Notification includes: description of breach, types of data involved, steps we have taken to mitigate, and **specific steps the user can take to protect themselves** — including monitoring Medicare Summary Notices and Explanation of Benefits for unfamiliar claims, contacting 1-800-MEDICARE (1-800-633-4227) to report suspected misuse of their Medicare number, and reviewing their credit report if personal identifiers were involved
- For breaches affecting **500 or more individuals**: FTC and HHS notified as required by law
- Incident response procedures maintained and tested

---

## Question: How will you store and retain health information in a manner consistent with best practices associated with the protection of personally identifiable health information?

**Response:**

Storage and retention practices (Privacy Policy §4, §6, §8):

**Storage:**
- OAuth tokens (access + refresh) encrypted at rest using AES-256-GCM before writing to our database
- Health data cache stored in ~~Supabase with Row-Level Security~~ AWS RDS with explicit `WHERE user_id = $1` clauses — only the authenticated user can read their own rows
- All data in transit protected by TLS 1.2+
- No health data written to server-side logs or application error tracking
- ~~HIPAA Business Associate Agreements in place with Supabase (database) and Vercel (hosting), both SOC 2 compliant~~ HIPAA Business Associate Agreement in place with AWS (executed 2026-02-25), covering RDS, ECS Fargate, Bedrock, Cognito, SES; SOC 2 Type II compliant.

**Retention:**
- Health data cache: refreshed every 24 hours; **immediately and permanently deleted** when the user disconnects Medicare or deletes their account
- OAuth tokens: **immediately and permanently deleted** on disconnect or account deletion
- Conversation history and appeal letters: retained until account deletion
- Audit logs: retained minimum 6 years per HIPAA compliance requirements
- Anonymized learning data (no PII, no account identifiers): retained indefinitely, deliberately minimized and aggregated
- Inactive accounts: users with no sign-in for 24 months receive a 30-day email notice before data is archived

**Minimum data principle:** We collect only what is necessary for the stated purpose. We access Patient, Coverage, and Explanation of Benefits (EOB) data only — we do not request access to Medicare.gov credentials, Social Security Numbers, or data beyond what is needed for claims guidance and appeal assistance.

---

*Document prepared by Claude Code (Anthropic) for CMS production access review.*
*Privacy policy: https://www.denali.health/privacy*
*Terms of service: https://www.denali.health/terms*
