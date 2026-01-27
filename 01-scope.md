# Scope & Data Inventory

## Locked Scope

| Dimension | Decision |
|-----------|----------|
| Payer | Medicare only (Original Medicare, not Medicare Advantage custom rules) |
| Use case | Denial prevention (proactive) + Appeal support (reactive) |
| User | Medicare patients & their caregivers |
| Data sources | ICD-10, CPT (dev), NPI, NCD/LCD, SAD list, PubMed, Claude |
| No dependency on | Commercial payers, Medicaid, real-time eligibility |
| UX | Simple chat, plain English, smart prompts |
| Backend | Supabase + Edge functions + Claude agentic |
| Learning | App gets smarter from every interaction |
| Compliance | GDPR/CCPA account deletion, data portability |

---

## Data Inventory

| Data | Status | Scope |
|------|--------|-------|
| ICD-10 (Dx & Px) | ✅ Full | All codes |
| CPT (via AMA) | ✅ Dev only | Good enough to build & demo |
| HCPCS Level II | ⚠️ Partial | SAD list only |
| NPI Registry | ✅ Full | Provider validation |
| Coverage Policies | ✅ NCDs/LCDs | Medicare only |
| Payer Policies | ❌ None | No commercial payers |
| PubMed | ✅ Full | Clinical evidence |
| Claude API | ✅ Full | AI reasoning |

---

## The Payer Gap — Is It Actually a Problem?

For a Medicare-focused tool, no payer API needed — CMS is the payer, and we have their policies (NCDs/LCDs).

Medicare is a huge market:
- 67M+ beneficiaries
- Primary care, chronic conditions
- Clear, publicly documented rules

Commercial payers are fragmented anyway — each has different rules, portals, and no standard API.
