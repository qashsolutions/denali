# CMS Interoperability Framework

Full topic doc — extracted from CLAUDE.md during the 2026-05-13 doc refactor.

---

## CMS Interoperability Framework (summary)

> **Full compliance report**: see [`cms_readiness.md`](cms_readiness.md). Historical audit log + 2026-03-04 CMS submission Q&A: see [`docs/history/cms-compliance-log.md`](docs/history/cms-compliance-log.md).

**Sources**: [Framework](https://www.cms.gov/health-technology-ecosystem/interoperability-framework) (26 criteria) | [Categories](https://www.cms.gov/health-technology-ecosystem/categories) | [Pledge Form](https://surveys.cms.gov/jfe/form/SV_6SbVcS5IOqXXOnk)

Denali = **Patient-Facing App** in 2 categories: **Conversational AI** + **Diabetes & Obesity Prevention**. Must meet ALL 6 app criteria (A1–A6) + category-specific criteria.

### Current status (compressed)

- **Identity & Security** (A1): Blue Button OAuth via Medicare.gov satisfies IAL2/AAL2. ID.me path was integrated 2026-03-10 but is **NOT REQUIRED per CMS reaffirmation 2026-04-21** — `REQUIRE_IDENTITY_VERIFICATION=false` permanently. Audit logging on all sensitive ops.
- **Trial & Discovery** (A3/A4/A5): 14-day free trial, `/api/cms-metadata`, `CmsPledge` component (AI + Diabetes pledges).
- **Conversational AI**: Personalized AI across clinical record (extracted from EOB claims via `eob-clinical.ts`). Blue Button PHR connection. AI disclaimers. "Talk to your doctor" patterns. Note: lab values not available from Blue Button — only lab procedures (CPT codes).
- **Diabetes & Obesity**: Full EOB extraction pipeline (8 extractors). `ScreeningReminders` from real CPT claim dates. `RiskAlerts` for high A1C, missing meds, refill gaps, no endocrinologist, post-discharge follow-up. SAD list includes 6 obesity drugs (Wegovy, Zepbound, Saxenda, Contrave, Qsymia, Orlistat). Severity classification.
- **Medicare Notifications** (A2 partial): `MEDICARE_NOTIFICATIONS_SKILL` detects EOB/coverage changes.
- **Policy Change Notification** (Terms §12, Privacy §15): `POST /api/admin/email/policy-change` — admin-only, dry-run support, audit-logged.
- **AWS BAA executed 2026-02-25** (covers RDS, ECS, Bedrock, Cognito, SES). Legal pages aligned to AWS-only architecture. Audit log REVOKE applied 2026-04-10 (append-only).

### Remaining Gaps

| Gap | CMS Ref | Priority | Type |
|---|---|---|---|
| HIPAA compliance | A6 | P0 | **DONE** — AWS migration complete + BAA executed 2026-02-25 |
| HITRUST certification | Criterion 26 | P0 | Process — org-level cert |
| CMS security self-assessment | A3 | P0 | Docs — submit data source inventory + security checklist (Terms+Privacy PDFs ready) |
| Medicare.gov notification bridge | A2 | P1 | Code + API |
| CMS credential service integration | A1 | **N/A — DEPRECATED 2026-04-21** | NOT REQUIRED per CMS confirmation. ID.me code retained for historical context |
| CMS review submission | A3 | P1 | Docs |
| CMS app directory submission | A5 | P1 | Docs — screenshots + descriptions |
| AAL2 app auth | A1, Criteria 3, 23 | **DONE via Blue Button OAuth** | Email OTP remains as app-layer factor |
| FHIR USCDI v3 compliance | Criterion 13 | P2 | Code — verify by July 2026 |

### Key Dates

| Date | Milestone |
|---|---|
| 2026-04-29 | CMS BB2.0 production access **granted** |
| 2026-05-01 | BB2.0 production credentials rotated into `denali/prod/app`; staging E2E verified with sandbox test user; prod OAuth verified through Medicare.gov authentication step (full Medicare beneficiary login flow not tested — no real Medicare-enrolled account available) |
| Q1 2026 | CMS early adopter showcase target |
| **July 4, 2026** | FHIR API mandate (Criteria 13–16) |
