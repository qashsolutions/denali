# Legal Document Consistency Audit

**Date:** 2026-04-12 (updated from 2026-04-10)
**Tool:** `scripts/check-legal-docs.ts` (automated, 29 checks)
**Result:** 29/29 passed

Privacy policy prose sections score Flesch-Kincaid grade 9-13 after readability improvements on 2026-04-12.

## Pages Audited

| Page             | Path       | Sections    |
| ---------------- | ---------- | ----------- |
| Terms of Service | `/terms`   | 15 sections |
| Privacy Policy   | `/privacy` | 16 sections |
| FAQ              | `/faq`     | 9 sections  |
| HIPAA Notice     | `/hipaa`   | Full notice |

## Vendor Disclosures (consistent across all pages)

All four legal pages disclose the same two vendors:

| Vendor                    | Services                                               | Certification                                          |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| AWS (Amazon Web Services) | RDS PostgreSQL, ECS/Fargate, Bedrock (AI), SES (email) | HIPAA-eligible, SOC 2 Type II, BAA executed 2026-02-25 |
| Stripe                    | Payment processing                                     | PCI DSS Level 1                                        |

Resend is not mentioned in any legal page. AWS SES is explicitly named in the primary AWS vendor bullet and the vendor commitments paragraph of the Privacy Policy.

## Check Categories

| Category                                            | Checks | Status   |
| --------------------------------------------------- | ------ | -------- |
| Breach notification (60-day, FTC, HHS)              | 3      | All pass |
| Audit log retention (6-year, carve-outs)            | 4      | All pass |
| Cache TTL (24-hour)                                 | 1      | Pass     |
| Encryption (AES-256-GCM, TLS 1.2+)                  | 2      | All pass |
| Pricing tiers (Trial/Starter/Plus/Unlimited)        | 6      | All pass |
| Data processors (AWS, Stripe)                       | 1      | Pass     |
| BAA execution date                                  | 1      | Pass     |
| No AI model training                                | 1      | Pass     |
| Policy change notification (30-day)                 | 1      | Pass     |
| CMS non-endorsement                                 | 1      | Pass     |
| Resend NOT named (replaced by SES)                  | 1      | Pass     |
| Negative checks (no false PII claims, no stale TTL) | 2      | All pass |
| AWS Bedrock no-retention                            | 1      | Pass     |
| Medicare data scope (Patient, Coverage, EOB)        | 1      | Pass     |
| Disconnect deletes cached data                      | 1      | Pass     |

## Automated Audit Tool

The checker runs from the project root:

```
npx tsx scripts/check-legal-docs.ts
```

Header comment includes a reality-sync date (2026-04-10) and a note that checks must be updated in the same PR as any pricing, vendor, or feature change.
