# denali.health — Medicare Claims Simplified

A conversational assistant that helps Medicare patients:

1. Understand what Medicare requires to approve a service
2. Know what to ask their doctor to document
3. If denied — build an appeal with Medicare policy citations and clinical evidence

**Key Insight:** Proactive denial prevention, not reactive appeals. That's a much better value prop for patients.

---

## Documentation Index

| File | Contents |
|------|----------|
| [01-scope.md](01-scope.md) | Locked scope, data inventory, payer gap analysis |
| [02-user-flow.md](02-user-flow.md) | Patient flow, use case, outputs |
| [03-architecture.md](03-architecture.md) | High-level architecture, components, tool layer |
| [04-skills.md](04-skills.md) | Skills directory, registry, all skill definitions |
| [05-database.md](05-database.md) | Supabase tables, RLS, schema |
| [06-business.md](06-business.md) | Pricing, auth, gating logic |
| [07-ui.md](07-ui.md) | UI/UX principles, mockups |
| [08-learning.md](08-learning.md) | Agentic learning system, feedback loops |
| [09-app-tree.md](09-app-tree.md) | **Complete app tree** - screens, flows, DB, functions |
| [sql/001-schema.sql](sql/001-schema.sql) | Full PostgreSQL schema (16 tables, 17 functions) |

---

## Core Principles

| Principle | What It Means |
|-----------|---------------|
| Modular | Each function is a standalone component — swap, upgrade, reuse |
| Componentized | UI and logic separated, reusable across screens |
| 100% Agentic | Claude drives the conversation, decision-making, and learning — not rigid forms |
| Self-Learning | Every user interaction improves the system over time |
| Medicare Only | No commercial payer dependency — NCDs/LCDs are our source of truth |
| Simple English | Patient talks like a human, not a coder or biller |

---

## Quick Reference

- **Target User:** Medicare patients & caregivers
- **Payer:** Original Medicare only (not MA)
- **Backend:** Supabase + Edge functions + Claude
- **Data Sources:** ICD-10, CPT (dev), NPI, NCD/LCD, SAD list, PubMed
