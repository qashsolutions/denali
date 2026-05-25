# CMS Compliance — Historical Audit Log

This file archives dated CMS Blue Button compliance audit
deltas and the 2026-03-04 CMS submission Q&A. Extracted from
CLAUDE.md to keep the main file focused on current status
and remaining gaps.

For active CMS compliance status, remaining gaps, and key
dates, see CLAUDE.md "CMS Interoperability Framework
(summary)".

For the full compliance report, see `cms_readiness.md`.

> **Update — May 24, 2026:** Vercel and Supabase are no longer in use. All infrastructure (staging and production) now runs on AWS exclusively (ECS Fargate, RDS Postgres, Cognito, Bedrock, SES; AWS BAA executed 2026-02-25). Row-Level Security has been replaced by explicit `WHERE user_id = $1` clauses in application code. Strikethroughs below preserve the original text as historical record.

---

## Dated Audit Deltas

**Blue Button ToS v3 Compliance** (2026-02-24): Full audit completed against all ToS sections. Fixed two code gaps: (1) Blue Button attribution ("not endorsed or certified by CMS or HHS") added to connected health page (`health/page.tsx`) so it's visible whenever Medicare data is displayed — previously only on the pre-connect screen; (2) `context.ts` consent gate changed from `=== false` to `!== true` so `null`/`undefined` `consentHealthDataAi` never accidentally injects health data into Claude (null-safe allow-list pattern). All 7 Framework principles verified: Transparency ✅, Consent ✅, Use & Disclosure ✅, Individual Access ✅, Security ✅, Data Quality ✅, Accountability ✅.

**Patient-Facing Data Access History** (Criterion 4, 2026-02-24): Settings page "Activity Log" renamed to "Data Access History" with subtitle explaining it records Medicare data access events. 16 action types covered with human-readable labels. IP masking implemented. Fully satisfies Criterion 4. UI (2026-02-25): collapsible — shows 3 most recent entries by default, "Show N more ↓" / "Show less ↑" toggle, fetches up to 50 entries upfront (no second network call on expand). "Load all activity →" appears only when >50 entries exist and list is expanded.

**Privacy Policy — CMS Blue Button Checklist** (2026-02-24): Full audit against CMS BB privacy policy checklist. All 16 checklist requirements now satisfied. Four gaps fixed: (1) Re-identification risk caveat added to §7 — anonymized data could theoretically re-identify individuals with uncommon conditions, as CMS explicitly requires disclosing; (2) Revocation data handling — dedicated clear statement added to §4 that disconnecting Medicare immediately and permanently deletes all cached health data; (3) Vendor data protection commitments — §5 now explicitly states all third-party providers are contractually required to protect data consistent with applicable law, with BAA/SOC2 Type II/PCI DSS certifications enumerated; (4) Breach notification user steps — §10 now lists specific protective actions users can take (monitor Medicare Summary Notices, call 1-800-MEDICARE, review credit report). Effective date updated to 2026-02-24.

**Privacy Policy Code Deltas — All 4 Resolved** (2026-02-24): Full audit of gaps between privacy policy claims and code behavior (`docs/delta-privacy.md`). Two code fixes, two policy text fixes: (1) **`health_data_storage` consent** — `useHealthData.ts` `cacheSet()` now gated on `healthDataStorageRef.current === true`; uses `useRef` pattern so stable `useCallback` dep array is not disturbed; (2) **`analytics` consent** — `trackEvent()` in `conversation-service.ts` now returns early if `analyticsConsent !== true`; `useChat.ts` imports `useConsent` and passes `consent.analytics` to all 3 call sites (`appeal_completed`, `feedback_positive`/`negative`, `outcome_reported`); (3) **audit log retention conflict** — removed audit logs from §7 deletion list, added HIPAA 6-year retention note; (4) **inactive account notice** — softened "will receive" → "may receive" (feature not yet implemented). TypeScript: clean.

**FAQ Cross-Audit vs Terms + Privacy — 6 Deltas Fixed** (2026-02-24, updated 2026-03-04): Full three-way audit of `/faq` against `/terms` and `/privacy`. Six contradictions or omissions corrected: (1) "never store your full name" → now code-accurate: `transformPatient()` only extracts age+gender from FHIR Patient resource, discards name/DOB/Medicare ID/address (Privacy §2); (2) data sharing list omitted Vercel → added (Privacy §5 lists Vercel as data processor, 30-day log retention); (3) "Is Denali free?" had no post-trial lock warning → added "chat access is locked until you purchase a plan" (Terms §7); (4) "Can I delete your account?" said "permanently delete all your data / payment records" → replaced with precise list matching Privacy §7; removed "payment records" (we cancel Stripe subscription, we don't delete Stripe's own records); (5) "What data is retained after deletion?" said "only anonymized data" → added audit logs as second retained category with 6-year HIPAA explanation (contradicted Privacy §7 directly); (6) "Is there a free trial?" said "1 appeal letter" → corrected to "1 appeal credit" (Terms §7 terminology); added post-trial lock notice for consistency.

**HIPAA Page Cross-Audit — 6 Deltas Fixed** (2026-02-24, see below for final pass): Full audit of `/hipaa` against `/faq`, `/terms`, and `/privacy`. Six issues corrected: (1) **PHI deletion claim** — closing paragraph in "PHI Retention" said "all PHI permanently removed on account deletion" with no carve-out; added audit log exception (6-year HIPAA retention) to match Privacy §7 and FAQ; (2) **BAA false claim** (highest risk for CMS) — `hipaa/page.tsx`, `privacy/page.tsx`, and `docs/cmsreview.md` all stated BAAs with Supabase and Vercel were "in place" / "maintained"; BAAs are not yet signed; softened to "BAAs being established / in process" with note that docs will update on execution; (3) **Breach 500+ bullet omitted FTC** — said "HHS and media" only; added FTC to match Privacy §10 and FAQ ("FTC and HHS"); (4) **"Improving our AI models"** — implied model training; Privacy §5 explicitly says Anthropic does not train on API data; changed to "improving our service using anonymized learning patterns" + added "We do not use your data to train AI models"; (5) **"Active session" TTL wording** — said cache retained only for "the active session"; actual behavior is 24-hour TTL surviving across sessions; corrected to "24-hour TTL, deleted on disconnect or account deletion"; (6) **Effective date** — updated Feb 8 → Feb 24, 2026. **Note**: Supabase and Vercel references in these historical audit entries are obsolete — fully migrated to AWS (2026-02-26). No Supabase/Vercel BAAs needed.

**Legal Page Footer Parity** (2026-02-24): All four legal pages (`/faq`, `/terms`, `/privacy`, `/hipaa`) were missing cross-navigation links and the CMS non-endorsement/medical advice disclaimer row present in `LandingFooter`. Each page now shows links to its three sibling legal pages + the disclaimer: "Coverage guidance only, not medical advice. Always consult with healthcare providers for medical decisions. This product is not endorsed or certified by CMS or HHS." Footer structure now matches the landing page. Previously: HIPAA had only Privacy + FAQ links (missing Terms); Privacy and Terms had no nav links at all; FAQ had no nav links and no disclaimer.

**Final 4-Doc Cross-Audit + Automated Checker** (2026-02-24): Exhaustive final pass across all four legal documents (FAQ, Terms, Privacy, HIPAA) using both a human-equivalent agent (23 topics) and a new automated script (`scripts/check-legal-docs.ts`, 28 checks). The script found 4 issues the human audit missed: (1) **Terms §11** — "all your data will be permanently deleted" had no audit log carve-out, contradicting Privacy §7/FAQ/HIPAA; (2) **Terms §13** — "all Medicare data is permanently deleted immediately" had no audit log carve-out; (3) **HIPAA "no model training" phrasing** — "do not use your data to train AI models" didn't literally contain "not train" — rephrased to "do not train AI models on your data" to match Privacy §5; (4) **FAQ audit log check** — case-sensitivity bug in the checker itself ("Audit" vs "audit") — fixed regex to case-insensitive. All 28 checks now green. **Run anytime:** `npx tsx scripts/check-legal-docs.ts` from project root.

**CMS Blue Button Terminology + Vendor Alignment** (2026-03-23): Full audit of Terms and Privacy against CMS Blue Button production access requirements and ToS v3. Two fixes: (1) **"Blue Button" → "Medicare"** in all user-facing legal text (Terms §13, Privacy §9, §5 business transfers) — CMS requires "Medicare" as data source name, not "Blue Button". CMS-mandated attribution notice ("This product uses the Blue Button APIs but is not endorsed...") preserved as-is in CmsPledge, ConnectMedicare, health page, ReportView. (2) **Resend → AWS SES** in Privacy §5 — Resend vendor bullet removed (no longer used), SES folded into AWS bullet explicitly listing RDS+ECS+Bedrock+SES. CMS naming commitment added to Privacy §11. Privacy §5 effective date updated to March 5, 2026.

**Health Report Data Field Bug Fix** (2026-03-23): API returns report content as `data` field, but `useHealthReport.ts` interface expected `reportData` and report page accessed `report.reportData` — always `undefined`, so `<ReportView>` never rendered for authenticated users (public share page worked correctly since it used `report.data`). Fixed: hook interface `reportData` → `data`, report page `report.reportData` → `report.data`. E2E mocks aligned to match API response shape.

### CMS Submission Q&A (2026-03-04)

Verified answers to CMS early adopter questionnaire, backed by code and AWS infrastructure audit.

**App description (for CMS directory):**

> DenaliHealth connects to Medicare claims data through Blue Button 2.0 and uses Claude (Anthropic) on AWS Bedrock to deliver personalized coverage guidance for beneficiaries with diabetes and obesity. The app extracts conditions, medications, screenings, and denial history from a patient's own claims, then provides tailored support — offering direct assistance when appropriate and directing patients to care from a health professional when needed.

**Q: If data is shared with third parties, how will you obtain informed consent?**
DenaliHealth does not share patient health data (PHI) with any third party. All health data processing runs through Claude on AWS Bedrock (Sonnet 4.6 for chat, Opus 4.6 for appeals) — data never leaves AWS. Email delivery via AWS SES (within BAA). One service provider receives limited operational data (email address only): Stripe (payments). Patient consent for health data use is obtained through three granular opt-in toggles (all default OFF) in Settings > Privacy & Data: Health Data AI, Health Data Storage, Analytics. Medicare data access requires separate Blue Button OAuth through Medicare.gov. Consent changes take effect immediately (including mid-conversation) and are audit-logged.

**Q: Do third-party vendors commit to data protection requirements?**
Yes. No third-party vendor has access to patient health data. AWS: BAA executed 2026-02-25, HIPAA-eligible, SOC 2 Type II, FedRAMP High, HITRUST certified. Email sending via AWS SES (within BAA). Stripe: PCI DSS Level 1 certified, receives only email + payment identifiers. Public government APIs (NLM, CMS, NPPES) receive only generic search terms — never patient data.

**Q: What happens when a user withdraws consent?**
Consent toggles take effect immediately. Health Data AI → OFF: data stripped client-side before any API call. Disconnecting Medicare: all cached health data + encrypted OAuth tokens permanently deleted. Account deletion: 11-step cascade deletes all user data, Cognito credentials removed as final step. Only audit logs (6-year HIPAA) and anonymized learning patterns survive.

**Q: What happens if the company is sold?**
Terms §12 and Privacy §5 both require: (1) users notified via email at least 30 days before data transfer; (2) CMS notified at earliest practicable time (Blue Button credentials are entity-specific, change of ownership requires CMS re-review); (3) users can delete account and all data before transfer.

**Q: How do you store/retain health information consistent with PHI protection best practices?**
Verified via AWS CLI audit (2026-03-04):

- **Encryption at rest**: RDS AES-256 via KMS (`a44e46d3-84bc-4f3e-87ff-50cc848843b8`), deletion protection ON. Blue Button tokens: app-layer AES-256-GCM. Secrets Manager: KMS encryption.
- **Encryption in transit**: ALB TLS 1.3/1.2 (`ELBSecurityPolicy-TLS13-1-2-2021-06`), HTTP→HTTPS redirect. RDS TLS via `rds-ca-rsa2048-g1` CA cert.
- **Network isolation**: RDS `PubliclyAccessible: false`, ECS→RDS via VPC security group (port 5432 restricted). Fargate serverless (no SSH).
- **Access controls**: Cognito with email OTP + ID.me IAL2 identity verification (required for Medicare data) + optional TOTP MFA, deletion protection ACTIVE. App-level user-scoped data access. HIPAA 30-min inactivity timeout.
- **Audit**: App-level audit log (6-year retention, 16 action types). CloudTrail multi-region with log file validation. Infrastructure monitoring 2x/daily.
- **Data minimization**: Only age+gender from FHIR Patient resource (no name/DOB/address/Medicare ID). Health cache 24h TTL, deleted on disconnect. Consent toggles all default OFF.
- **AI data handling**: All AI via Bedrock (within AWS/BAA). Anthropic does not train on Bedrock API data. Health data in AI only when consent toggle ON.
- **Backups**: RDS automated backups encrypted, 7-day retention.

**Q: Data deletion approach?**
"We securely delete all data on user request." Account deletion cascades through 11 tables + Cognito. Two categories retained per legal requirements: audit logs (6-year HIPAA) and anonymized learning patterns (no user linkage). Medicare data can also be deleted independently via Blue Button disconnect.

**Third-party data flow summary (verified 2026-03-04):**

| Service              | Data Sent                                     | Health Data?                  |
| -------------------- | --------------------------------------------- | ----------------------------- |
| AWS Bedrock (Claude) | Conversation + health context (consent-gated) | Yes — within AWS/BAA          |
| NLM Clinical Tables  | Generic ICD-10 search terms                   | No                            |
| CMS Coverage DB      | Generic procedure keywords                    | No                            |
| NPPES NPI Registry   | Provider names/locations                      | No                            |
| PubMed/NCBI          | Clinical search terms                         | No                            |
| CMS Blue Button      | OAuth tokens (reads FROM CMS)                 | No — inbound only             |
| ID.me                | OIDC auth code (identity verification)        | No — UUID only, no PII stored |
| Cognito              | Email address                                 | No                            |
| Stripe               | Email, internal user ID                       | No                            |
| AWS SES              | Email address (within AWS/BAA)                | No                            |

