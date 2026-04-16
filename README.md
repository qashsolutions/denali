# Denali Health — Medicare Coverage Intelligence

A conversational AI assistant that helps Medicare patients understand
their coverage, track diabetes and obesity care, and fight claim denials
with evidence-based appeal letters.

## What It Does

1. **Coverage Guidance** — Answers Medicare coverage questions in plain
   English using the patient's own claims data
2. **Diabetes & Obesity Tracking** — Monitors A1C screenings, medications,
   refill gaps, and preventive care from Medicare claims
3. **Appeal Letters** — Generates formal appeal letters with ICD-10/CPT
   codes, LCD/NCD policy citations, and PubMed clinical evidence
4. **Proactive Alerts** — Notifies patients of upcoming appeal deadlines,
   medication refill gaps, and new claim denials

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16, React 19, TypeScript strict |
| Hosting | AWS ECS Fargate |
| Database | PostgreSQL 16.9 on AWS RDS (AES-256) |
| AI | Claude Sonnet 4.6 + Opus 4.6 via AWS Bedrock |
| Auth | AWS Cognito + SES (OTP, HIPAA 30-min timeout) |
| Payments | Stripe (PCI DSS certified) |
| Email | AWS SES (BAA signed Feb 25, 2026) |
| Data Sources | Blue Button 2.0 API (FHIR R4), ICD-10, CPT, NPI Registry, NCD/LCD, PubMed |

## Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| Privacy by Default | All consent toggles OFF, no raw FHIR stored, PHI never logged |
| Minimum Necessary | AI sees only relevant transformed data, not full claims |
| User Control | Disconnect Medicare and delete account with confirmation dialogs |
| Transparency | "AI-generated - Not medical advice" on every response |
| HIPAA Compliant | BAA with AWS, append-only audit logs, AES-256-GCM token encryption |

## CMS Blue Button 2.0

This product uses the Blue Button APIs but is not endorsed or certified
by the Centers for Medicare & Medicaid Services or the U.S. Department
of Health and Human Services.

## Documentation

Project documentation is maintained in CLAUDE.md. CMS demo evidence
documents are in docs/cms-demo-evidence/.

---

Qash Solutions Inc - 2026
