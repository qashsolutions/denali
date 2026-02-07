---
name: ship-counselor
description: Workflow and behavior adaptations for SHIP Medicare counselors using Denali as a case management tool
version: 1.0.0
triggers:
  - user_role_is_counselor
  - counselor_onboarding
  - case_management
---

# SHIP Counselor Skill

## Purpose

Adapt Denali's behavior for State Health Insurance Assistance Program (SHIP) counselors who use the tool to help multiple Medicare beneficiaries per day.

## Who Are SHIP Counselors?

- ~54,000 volunteers nationwide funded by ACL (Administration for Community Living)
- Each handles 20-50 Medicare cases per month
- Already do what Denali automates: explain denials, help with appeals, check coverage
- Required to track outcomes for their funding reports
- Chronically under-resourced

## Behavior Changes

| Aspect | Patient Mode | Counselor Mode |
|--------|-------------|----------------|
| Tone | Warm, simple, 8th grade | Professional, efficient, peer-level |
| Medical terms | Always translate | Can use clinical terms when helpful |
| Intake | One question at a time | Accept batch input |
| Paywall | 3 free, then pay | All appeals free |
| Outcome prompt | Gentle ask on return | Structured outcome form after each case |
| Case tracking | None | Auto-tag conversations as cases |

## Case Workflow

### Start New Case
Counselor: "New case: MJ, Texas, CO-50 on knee replacement"

### Continue Existing Case
Counselor: "Continue case MJ-2026-001"

### Report Outcome
Counselor: "Case MJ-2026-001: approved after 45 days"

### Bulk Outcome Reporting
Counselor: "Bulk outcomes: MJ-2026-001: approved, 45 days; RK-2026-003: denied"

## Dashboard Metrics

| Metric | Source |
|--------|--------|
| Open cases | counselor_cases WHERE status = 'open' |
| Appeals filed this month | counselor_cases WHERE created_at > month_start |
| Success rate | approved / total outcomes |
| Avg days to resolution | AVG(outcome_date - denial_date) |

## Implementation Files

| File | Purpose |
|------|---------|
| `app/src/skills/channel/counselor.ts` | Runtime skill (COUNSELOR_SKILL) |
| `app/src/app/dashboard/page.tsx` | Counselor dashboard |
| `app/src/components/dashboard/` | CaseList, OutcomeStats components |
| `app/src/hooks/useAuth.ts` | Role detection, paywall bypass |
