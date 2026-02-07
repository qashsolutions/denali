---
name: provider-pilot
description: Workflow adaptations for healthcare provider practices using Denali for denial prevention and appeal management
version: 1.0.0
triggers:
  - user_role_is_provider
  - provider_onboarding
  - batch_case_mode
---

# Provider Pilot Skill

## Purpose

Adapt Denali for healthcare provider offices (billing staff, practice managers, physicians) who handle dozens of Medicare claims and denials per month.

## Why Providers Matter for the Flywheel

| Metric | Patient | SHIP Counselor | Provider Practice |
|--------|---------|---------------|-------------------|
| Cases/month | 1-2 | 20-50 | 100-500 |
| Outcome known? | Sometimes | Usually | Always (from remittance) |
| Code accuracy | Low | Medium | High (billing system) |
| MAC-specific data | Random | Regional | Concentrated |

One practice generates more flywheel data in a month than 100 individual patients in a year.

## Behavior Changes

| Aspect | Patient Mode | Provider Mode |
|--------|-------------|---------------|
| Terminology | Plain English only | Clinical + billing terminology OK |
| Code handling | Never show codes | Show codes directly |
| Input style | Conversational | Structured: "CPT 72148, ICD M54.5, CARC 50" |
| Batch mode | No | Process multiple cases per session |
| Output focus | Patient understanding | Actionable billing guidance |

## Provider Onboarding

First session collects:
1. Practice name
2. NPI (validated via MCP)
3. Primary specialty
4. State (derives MAC)
5. Most common procedures and denial codes

## Implementation Files

| File | Purpose |
|------|---------|
| `app/src/skills/channel/provider.ts` | Runtime skill (PROVIDER_PILOT_SKILL) |
| `provider_practices` table | Practice metadata |
