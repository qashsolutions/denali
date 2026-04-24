# Incident: ECR Image Eviction Caused Prod Outage

**Date:** 2026-04-23
**Duration:** ~88 minutes (08:00 CT — 09:28 CT, workflow completion)
**MTTR from discovery:** 28 minutes (09:00 → 09:28 CT)
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
| 2026-04-23 09:24 | `gh workflow run deploy.yml --ref main` triggered (run `24840807861`) |
| 2026-04-23 09:26 | Prod image rebuilt + pushed to ECR, task def `:168` registered |
| 2026-04-23 09:28 | denali-web service healthy on `:168`, prod restored (workflow completion; 3m 33s total) |
| 2026-04-23 12:11 | Initial postmortem + CLAUDE.md Infrastructure section committed (`a29436c`) |
| 2026-04-23 ~12:30 | Phase A Step 1: ECR lifecycle policy rewritten (5-rule per-prefix) |
| 2026-04-23 ~12:45 | Phase A Step 2: SNS topic `denali-prod-alerts` created |
| 2026-04-23 ~13:30 | Phase A Step 3: 2 email subscriptions confirmed (after Gmail unsubscribe-prefetch workaround via `AuthenticateOnUnsubscribe=true`) |
| 2026-04-23 15:05 | Phase A Step 4: ECS `running-below-desired` alarm live (OK state) — required enabling Container Insights on both clusters |
| 2026-04-23 15:11 | Phase A Step 5: ALB `alb-5xx-rate-high` alarm live (OK state) |
| 2026-04-23 ~15:20 | Phase A Step 6: EventBridge rule `ecs-task-failed-to-start` routing to SNS (log-metric-filter approach abandoned — ECS service events don't flow to CloudWatch Logs) |
| 2026-04-23 ~15:40 | Phase B Step 7: `denali-staging` ECR repo created with 2-rule lifecycle |
| 2026-04-23 15:45 | Phase B Step 8: staging workflow repointed (`f05cb34`) — push fails on IAM scope |
| 2026-04-23 ~15:54 | Phase B Step 8 retry: IAM `ECRPush` scope expanded; staging push succeeds (run `24858354590`) |
| 2026-04-23 16:18 | Phase C Step 11: `denali-staging-deploy-role` created; workflow cut over (`65b05bf`, run `24859350441`) |
| 2026-04-23 16:29 | Phase C Step 12: `denali-prod-deploy-role` created; workflow cut over on main (`6df64e8`, run `24859797756`) |
| 2026-04-23 ~16:35 | Phase C Step 13: legacy `denali-github-actions-role` disarmed (inline policy detached, trust policy retained) |
| 2026-04-23 16:43 | Phase D Step 14: Dockerfile base image digest-pinned on develop (`05d9655`) |
| 2026-04-23 16:49 | Phase D Step 14: reproducibility verified via second staging build (base layers bit-identical) |
| 2026-04-23 16:59 | Phase D Step 15A: Dockerfile pin cherry-picked to main (`be8f409`); prod rebuilt under pinned base |
| 2026-04-23 17:22 | Phase D Step 15B: GitHub Actions SHA-pinned on develop (`ad1b387`) |
| 2026-04-23 18:36 | Phase D Step 15C: Actions pin cherry-picked to main via 3-way apply (`335da77`) |
| 2026-04-23 21:52 | Phase D Step 16: `prod-stable` tag automation added to `deploy.yml` (`db50655`, run `24869734462`) |
| 2026-04-23 ~22:05 | Phase D Step 17: broken task defs `:163`-`:167` deregistered |
| 2026-04-23 22:50 | Phase E Step 18: runbook written (`ea05a6c` — `docs/runbooks/ecr-eviction-recovery.md`) |
| 2026-04-23 22:59 | Phase E Step 19: rollback artifacts preserved (`e044c85` — `docs/runbooks/rollback-artifacts/`) |
| 2026-04-23 23:08 | Phase E Step 20: CLAUDE.md Infrastructure Architecture flipped to current state (`63650c0`) |

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
   to healthy state at 09:28 CDT — 3m 33s after workflow trigger.

## Prevention Measures Implemented (Same Day)

All measures landed 2026-04-23. See `CLAUDE.md` Infrastructure
Architecture section for current-state documentation and
`docs/runbooks/ecr-eviction-recovery.md` §"Preventing
Recurrence" for verification commands.

### 1. ECR Lifecycle Policy — per-prefix

Rewrote the `denali` repo lifecycle from single rule (keep last
3, any tag) to 5 rules scoped by tag prefix:
- `prod-stable`: never expires (9999 retention)
- Hex 0-7 SHA tags: keep last 10
- Hex 8-f SHA tags: keep last 10
- `staging-` prefix: keep last 5 (transitional, see measure 2)
- Untagged: expire after 1 day

Applied via `aws ecr put-lifecycle-policy` (no git commit —
AWS-side config). Lifecycle preview confirmed zero current
images would be evicted.

### 2. Separate ECR Repos

Created new `denali-staging` ECR repo with its own 2-rule
lifecycle (staging- keep 10 + untagged 1-day). Staging pushes
physically isolated from prod repo.

Workflow change committed on develop at commit `f05cb34`;
verified via Phase B Step 8 workflow run `24858354590`.

### 3. Separate IAM Roles

Created `denali-prod-deploy-role` (trusts `refs/heads/main`
only, scoped to `denali` ECR repo + `denali-web` service) and
`denali-staging-deploy-role` (trusts `refs/heads/develop` only,
scoped to `denali-staging` ECR repo + `denali-staging-web`
service).

Each role has 7-statement inline policy with per-resource
scoping on `ecs:UpdateService`, `ecs:DeregisterTaskDefinition`,
and `ecr:*` push actions. `iam:PassRole` tightened with
`iam:PassedToService: ecs-tasks.amazonaws.com` condition.

Workflow cutovers:
- Staging: commit `65b05bf` on develop, workflow run `24859350441`
- Prod: commit `6df64e8` on main, workflow run `24859797756`

Legacy `denali-github-actions-role` disarmed: inline policy
detached (preserved at `docs/runbooks/rollback-artifacts/denali-deploy-policy.json`),
trust policy retained as cooling-off rollback target.

### 4. CloudWatch Detection

Three-layer detection on prod, all publishing to
`denali-prod-alerts` SNS topic with email subscriptions to
admin@denali.health and ramanac@gmail.com:

- `denali-prod-ecs-running-below-desired` — CloudWatch alarm
  on ECS/ContainerInsights metric `RunningTaskCount` vs
  `DesiredTaskCount` via metric math. Fires at 2 min.
- `denali-prod-alb-5xx-rate-high` — CloudWatch alarm on
  AWS/ApplicationELB `HTTPCode_Target_5XX_Count`, fires when
  rate > 5% with volume gate at 20 req/5min.
- `denali-prod-ecs-task-failed-to-start` — EventBridge rule
  (not CloudWatch alarm) on `ECS Task State Change` events
  with `stopCode=TaskFailedToStart`. Direct SNS target.

Container Insights enabled on both `denali` and
`denali-staging` clusters as prerequisite.

### 5. Dockerfile Base Image Digest-Pinned

`FROM node:20-alpine` changed to `FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293`.

Commit lineage:
- Develop: `05d9655`
- Main: cherry-picked as `be8f409`

Verified reproducibility: two independent staging builds of
commit `05d9655` produced bit-identical base layers.

### 6. GitHub Actions Pinned to SHAs

All `uses:` references in both workflows replaced with 40-char
commit SHAs (5 actions: checkout, configure-aws-credentials,
ecr-login, render-task-definition, deploy-task-definition).
Comments preserve human-readable version tags.

Commit lineage:
- Develop: `ad1b387`
- Main: cherry-picked via 3-way apply as `335da77`
  (cherry-pick needed --3way due to structural differences
  between branches)

### 7. `prod-stable` Tag Automation

Added post-deploy step to `deploy.yml`: after ECS service
stability wait completes, retag the newly-deployed image as
`prod-stable` via `aws ecr put-image` (manifest-level, no
layer re-push). Lifecycle rule 1 protects the tag indefinitely.

Commit: `db50655` on main, workflow run `24869734462`.

Guarantees a permanent rollback target regardless of lifecycle
rule changes or SHA-bucket rotation.

### 8. Broken Task Defs Deregistered

Task defs `denali:163` through `denali:167` marked INACTIVE.
All referenced ECR image tags that were evicted during the
incident (the retag of `1307f0e5...` during recovery
accidentally made `:167` resolvable again, but its content is
functionally equivalent to `:168+` so it was retired for
audit clarity).

Command: `aws ecs deregister-task-definition`, 5 revisions.
Definitions preserved in INACTIVE state for forensic reference.

### 9. Runbook + Rollback Artifacts

- `docs/runbooks/ecr-eviction-recovery.md` — step-by-step
  recovery procedure with 2 paths (rebuild from main,
  rollback to `prod-stable`), plus verification commands for
  all 8 prevention measures. Commit `ea05a6c`.
- `docs/runbooks/rollback-artifacts/denali-deploy-policy.json`
  — preserved pre-disarm IAM policy for emergency restoration
  of the legacy shared role. Commit `e044c85`.
- `docs/runbooks/rollback-artifacts/README.md` — emergency
  procedure + 90-day review cadence.

### 10. CLAUDE.md Infrastructure Architecture Updated

Flipped all PLANNED markers to current state. Added new
subsection "GitHub Actions Pinning" documenting the SHA-pin
rationale and commit lineage. Commit `63650c0`.

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

**Incident detected:** 2026-04-23 09:00 CDT (manual discovery;
no alarms were configured at time of outage)

**Prod restored:** 2026-04-23 09:28 CDT (28 min MTTR from
discovery; 88 min total outage measured from scheduler start)

**Remediation completed:** 2026-04-23 during same-day session.
Branch propagation state of the 10 prevention measures:

- Measures 3, 5, 6 (IAM role split, Dockerfile pin, Actions
  pin): live on both `main` and `develop` via separate
  commits or cherry-picks
- Measure 7 (`prod-stable` tag automation): `main` only —
  prod-specific deploy step; no develop equivalent needed
  because staging uses its own deploy workflow
- Measures 2, 9, 10 (ECR repo split workflow change, runbook,
  CLAUDE.md sweep): `develop` only — will propagate to `main`
  via next develop→main merge cycle
- Measures 1, 4, 8 (ECR lifecycle policy, alarms + EventBridge,
  task def deregister): AWS-side configuration, not
  version-controlled in this repo

**Review cadence:**
- Legacy `denali-github-actions-role` — 90 day review, delete
  if new roles stable (earliest: 2026-07-22)
- Base image digest — bump via deliberate PR when Node 20.x
  security patches warrant
- GitHub Actions pins — bump when action authors publish
  security updates to pinned versions

**Long-term operational responsibility:** Qash Solutions Inc
engineering.
