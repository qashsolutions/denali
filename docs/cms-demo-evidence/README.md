# CMS Demo Evidence

Evidence artifacts supporting CMS Blue Button API production access review for Denali Health.

**Date:** 2026-04-10
**Prepared by:** Denali engineering team
**Scope:** Security hardening session covering HIPAA audit logging, PHI logging hygiene, PWA offline data handling, legal document consistency, and operational metrics.

> All artifacts are point-in-time snapshots captured on 2026-04-10. The underlying data is live and auditable in the production environment (AWS RDS `denali-prod`, CloudWatch `/ecs/denali`, GitHub `qashsolutions/denali`).

## Contents

| File                                                       | Description                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [01-audit-log-integrity.md](01-audit-log-integrity.md)     | Production audit_logs schema verification: FK behavior, row count, retention guarantee |
| [02-aws-ses-verification.md](02-aws-ses-verification.md)   | AWS SES production readiness: sending limits, verified domain, BAA coverage            |
| [03-legal-doc-consistency.md](03-legal-doc-consistency.md) | Automated 29-check legal cross-audit: all pages consistent, vendor disclosures aligned |
| [04-hipaa-fixes-summary.md](04-hipaa-fixes-summary.md)     | Structured table of all HIPAA findings remediated with commit SHAs and files changed   |
| [05-operational-metrics.md](05-operational-metrics.md)     | Test pass rates, error counts, deployment status post-hardening                        |
| [06-append-only-audit-log.md](06-append-only-audit-log.md) | Three-layer append-only enforcement model for HIPAA 6-year audit retention             |
