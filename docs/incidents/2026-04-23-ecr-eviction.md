# Incident: ECR Image Eviction Caused Prod Outage

**Date:** 2026-04-23
**Duration:** ~70 minutes (08:00 CT — 09:10 CT)
**Severity:** Major — prod service running task count = 0
**Impact:** denali.health unreachable during off-hours
  scheduler startup window. Zero user impact (pre-launch).

## Summary

Prod ECS service failed to start at its scheduled 08:00 CT
startup time due to CannotPullContainerError — the Docker image
referenced by task def `denali:167` had been evicted from ECR
by an overly aggressive lifecycle policy.

## Timeline

| Time (CT) | Event |
|-----------|-------|
| 2026-04-22 19:xx | develop branch created, staging pipeline established |
| 2026-04-22 23:01 | Staging push 1 (staging-a6d22ce7) |
| 2026-04-22 23:21 | Staging push 2 (staging-cfc9c77b) |
| 2026-04-22 23:34 | Staging push 3 (staging-67815eda) — evicts prod image `1307f0e5...` |
| 2026-04-23 04:00 | Scheduler stopped prod ECS (normal) |
| 2026-04-23 08:00 | Scheduler started prod ECS — pull fails, retry loop begins |
| 2026-04-23 09:00 | Operator discovers outage via manual check |
| 2026-04-23 09:10 | Root cause identified; ECR lifecycle policy flagged |
| 2026-04-23 09:30 | `gh workflow run deploy.yml --ref main` triggered |
| 2026-04-23 09:45 | Prod image rebuilt, task def `:168` registered |
| 2026-04-23 09:55 | denali-web service healthy, prod restored |
| 2026-04-23 10:15 | ECR lifecycle policy fixed (5-rule per-prefix) |

## Root Cause

ECR lifecycle policy was a single rule: `keep last 3 images,
tagStatus: any`. Prod and staging shared the same ECR repo
(`denali`), so staging pushes competed with prod images for
the 3-slot retention. Three staging pushes the previous evening
evicted the prod image.

Task def `denali:167` referenced the image by content-addressed
digest (`@sha256:...`). When the image was evicted, the digest
no longer resolved in ECR, causing `CannotPullContainerError`.

## Contributing Factors

1. **Shared ECR repo** — prod and staging in the same repo meant
   staging activity could affect prod retention.
2. **No CloudWatch alarms** — outage was discovered via manual
   check, not automatic paging.
3. **Docker base image not digest-pinned** — `FROM node:20-alpine`
   is tag-floating, so rebuild produces different base layers
   (acceptable for this recovery, but not ideal for audit).
4. **No rollback target** — all recent task defs (`:163`–`:167`)
   referenced evicted SHAs. No prior image available for quick
   rollback.

## Resolution

1. Triggered `gh workflow run deploy.yml --ref main` to rebuild
   from CMS-approved commit `1307f0e` via the normal deploy
   pipeline. Produced a new image at a new content digest but
   bit-identical application bytes (same source, same lockfile).
2. New task def `denali:168` registered with new image digest.
3. ECS picked up `:168` on next retry cycle; service returned
   to healthy state within ~15 minutes of trigger.

## Prevention Measures Implemented (Same Day)

1. **ECR lifecycle rewrite** — per-prefix rules separating prod
   (`[0-9a-f]` SHA tags, keep 10 per hex bucket) from staging
   (`staging-` prefix, keep 5). Protected `prod-stable` tag
   never expires.
2. **Separate ECR repos** — `denali-staging` created; staging
   pushes now target their own repo. Prod `denali` repo isolated.
3. **Separate IAM roles** — `denali-prod-deploy-role` (trusts
   `main` only) and `denali-staging-deploy-role` (trusts
   `develop` only). Replaces shared `denali-github-actions-role`.
4. **CloudWatch alarms** on prod:
   - ECS RunningTaskCount < DesiredCount
   - ALB 5xx rate > 5%
   - CannotPullContainerError log events
   All alarms publish to `denali-prod-alerts` SNS topic with
   email subscriptions to admin@denali.health and
   ramanac@gmail.com.
5. **Dockerfile base image digest-pinned** — `FROM node:20-alpine@sha256:<digest>`
   for reproducible rebuilds.
6. **GitHub Actions pinned to SHAs** — supply chain hardening
   in both deploy workflows.
7. **Broken task defs deregistered** — `:163`, `:164`, `:165`,
   `:166`, `:167` marked INACTIVE (all referenced evicted
   images; useless as rollback targets).
8. **Runbook added** at `docs/runbooks/ecr-eviction-recovery.md`
   documenting the exact recovery path.

## Lessons

1. ECR lifecycle policies with `tagStatus: any` are landmines
   for multi-environment repos. Always scope by tag prefix.
2. Shared ECR repos across environments are anti-pattern — the
   blast radius crosses environment boundaries.
3. Off-hours automated startup without monitoring is blind by
   definition. Alarms must precede scheduled automation.
4. Even with `content-addressed digest pinning` in task defs,
   the underlying image must be retained in the registry. Digest
   pinning protects against tag-drift, not image eviction.

## Ownership

Addressed: 2026-04-23 during same-day remediation session.
Long-term operational responsibility: Qash Solutions Inc
engineering.
