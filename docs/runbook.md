# Staging Operational Runbook

Daily-ops procedures for `staging.denali.health`. Topic-specific incident
runbooks live in `docs/runbooks/`; this file covers ongoing operations and
known recurring issues.

## Automated lifecycle

Staging shuts down nightly and starts up in the morning to save Fargate cost.

- `denali-staging-shutdown` Lambda — fires ~04:00 CT. Scales ECS service to 0, stops RDS.
- `denali-staging-startup` Lambda — fires ~07:55 CT. Starts RDS (~6 min), scales ECS service to 1.
- Both are Python 3.12, in `us-east-1` account `<account-id>`.
- Last modified 2026-04-26.

**Implication**: the running ECS task is replaced every morning. Anything
cached in the previous task instance (DB connection pool, in-process state)
is gone.

## RDS-managed secret rotation collision (known issue, A2)

The RDS master credentials live in Secrets Manager secret
`<rds-managed-secret-name>` (see `infra/dbinit-task-def.json` for the
actual ARN, or `infra/staging/terraform.tfvars` if locally generated)
with `RotationEnabled: true`. Rotation runs on its own schedule,
independent of the shutdown/startup Lambdas.

**Failure mode**: ECS task starts at ~08:02 CT and resolves the secret as
env vars. If RDS rotation fires AFTER the task starts (e.g., 08:24 CT), the
running task has the OLD password while RDS now accepts only the NEW
password. Result: every DB-touching request fails with PostgreSQL error
`28P01 FATAL auth_failed`, HTTP 500. Routes that don't touch DB (e.g.,
`/api/health`) keep working.

**Symptoms in the UI**:

- Sign In button appears even though Cognito cookies are valid
- App greets user by name (Cognito JWT) but `/api/profile` returns 500
- Settings page shows "trial plan" or "Sign In"
- Hard refresh appears to "log user out" (actually the UI fails to populate
  `authState` because `/api/profile` is 500)

### Auto-recovery (in place as of 2026-05-10)

An EventBridge rule + Lambda automatically force-redeploys ECS when the
RDS-managed secret rotation completes. The rotation collision pattern
that caused the 2026-05-09 incident should no longer require manual
intervention.

Resources:
- EventBridge rule: denali-staging-rotation-succeeded
- Lambda: denali-staging-rotation-recovery
- Recovery time: ~140s (verified via synthetic invocation 2026-05-10)
- Source: infra/staging/rotation-recovery.tf

The manual procedure below remains as fallback if EventBridge misses
an event. Real-world validation of the filter pattern happens on the
2026-05-15 18:59 CT rotation.

**Recovery** (one command, ~3–5 min):

```bash
aws ecs update-service --cluster denali-staging \
  --service denali-staging-web --force-new-deployment

aws ecs wait services-stable --cluster denali-staging \
  --services denali-staging-web
```

**Diagnostic confirmation** — look for these in `/ecs/denali-staging` logs:

- `severity: 'FATAL', code: '28P01', routine: 'auth_failed'`
- `aws secretsmanager describe-secret --secret-id '<rds-managed-secret-name>'`
  showing `LastRotatedDate` AFTER the running task's `startedAt`

## When you see persistent 5xx on staging — check this FIRST

Before investigating code, check for the rotation-collision pattern:

1. `aws ecs describe-tasks` → get task `startedAt`
2. `aws secretsmanager describe-secret` → check `LastRotatedDate`
3. If `LastRotatedDate > startedAt`: it's the collision. `force-new-deployment`. Done.

This was ~30 min of wasted investigation on 2026-05-08 that could have been
~3 min of recovery if the runbook existed.
