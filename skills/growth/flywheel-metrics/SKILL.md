---
name: flywheel-metrics
description: Metrics and analytics for measuring the health and effectiveness of the data flywheel
version: 1.0.0
triggers:
  - analytics_review
  - flywheel_health_check
---

# Flywheel Metrics Skill

## Purpose

Track the health and effectiveness of the data flywheel. Measure what matters, ignore vanity metrics.

## North Star Metric

**Appeal success rate improvement over time.** If the flywheel works, appeals generated with Denali should have a higher success rate as more outcome data flows in.

## Key Metrics

| Metric | Formula | Target (Month 3) | Target (Month 6) |
|--------|---------|-------------------|-------------------|
| Total outcomes collected | COUNT(appeal_outcomes) | 100 | 1,000 |
| Outcome response rate | responded / sent followups | 25% | 35% |
| Active SHIP counselors | Users WHERE role=counselor AND active < 30d | 10 | 30 |
| Provider practices | COUNT(provider_practices) | 1 | 3 |
| Success rate (overall) | approved / total outcomes | Baseline | +5% |
| Unique CPT+CARC combos | DISTINCT pairs in outcomes | 20 | 100 |
| Flywheel-informed appeals | Appeals where flywheel data was injected | 0% | 30% |

## When Flywheel Data Is "Good Enough"

The system only injects flywheel data into Claude's prompt when:
- At least 3 cases exist for that CPT+CARC combination
- The data is from the last 12 months

Below these thresholds, the data is too sparse to be reliable.

## Implementation Files

| File | Purpose |
|------|---------|
| `flywheel_metrics` materialized view | Aggregated outcome data |
| `get_flywheel_context()` RPC | Query flywheel data for specific CPT+CARC |
| `refresh_flywheel_metrics()` RPC | Nightly refresh |
| `supabase/functions/refresh-flywheel-metrics/` | Cron edge function |
| `app/src/lib/learning.ts` | `getFlywheelContext()`, `buildFlywheelPromptInjection()` |
| `app/src/lib/skills-loader.ts` | Injects flywheel data into system prompt |
