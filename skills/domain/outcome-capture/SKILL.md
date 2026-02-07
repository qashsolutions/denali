---
name: outcome-capture
description: Strategy and implementation for capturing appeal outcome data to build the flywheel
version: 1.0.0
triggers:
  - appeal_completed
  - user_returns_after_appeal
  - outcome_followup_scheduled
---

# Outcome Capture Skill

## Purpose

Close the feedback loop on every appeal. Every outcome reported makes the system smarter for the next patient.

## Why This Matters

The flywheel depends on real-world outcome data. Without outcomes:
- Coverage paths have no success/failure signal
- Appeal strategies can't be ranked by effectiveness
- Claude can't say "this appeal type has a 67% success rate"
- The product remains a commodity

## Capture Channels

| Channel | Mechanism | Expected Yield |
|---------|-----------|----------------|
| Email followup (day 30) | Automated Resend email with one-click buttons | 15-25% response rate |
| Email followup (day 60) | Second reminder if no response | 10-15% response rate |
| In-chat prompt | Ask returning users about past appeals | 30-40% response rate |
| Counselor reporting | SHIP counselors report outcomes as part of workflow | 80-90% response rate |
| Provider reporting | Practices know outcomes from remittance | 95%+ response rate |

## Data Captured Per Outcome

| Field | Source | Stored In |
|-------|--------|-----------|
| outcome (approved/denied/partial) | User report | appeals.status |
| days_to_resolution | Calculated from appeal date | appeals.outcome_reported_at |
| icd10_codes, cpt_codes | From original appeal | appeals (already stored) |
| lcd_refs, ncd_refs | From original appeal | appeals (already stored) |
| carc_codes | From original appeal | appeals (already stored) |

## Outcome Incentive

"Report your outcome, get your next appeal free."
- Costs nothing (appeal is digital)
- Massively increases reporting rate
- Implementation: decrement `usage.appeal_count` by 1 when outcome reported

## What Gets Updated on Outcome Report

1. `appeals.status` -> outcome value
2. `appeals.outcome_reported_at` -> timestamp
3. `coverage_paths` -> increment use_count, set outcome
4. `symptom_mappings` -> boost if approved (+0.1), penalize if denied (-0.05)
5. `procedure_mappings` -> boost if approved (+0.1), penalize if denied (-0.05)
6. `outcome_followups.responded_at` -> timestamp
7. `usage.appeal_count` -> decrement by 1 (incentive)

## Implementation Files

| File | Purpose |
|------|---------|
| `app/src/lib/conversation-service.ts` | `scheduleOutcomeFollowups()` after saveAppeal |
| `app/src/app/outcome/page.tsx` | Token-based one-click outcome reporting page |
| `app/src/app/api/outcome-report/route.ts` | API for token-based outcome submission |
| `app/src/skills/domain/outcome-prompting.ts` | In-chat prompt for returning users |
| `supabase/functions/send-outcome-followup/` | Cron edge function for email reminders |
| `app/src/lib/learning.ts` | `checkOutcomeIncentive()`, `applyOutcomeIncentive()` |
