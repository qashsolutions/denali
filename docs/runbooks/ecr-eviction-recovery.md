# Runbook: ECR Eviction Recovery

**Applies to:** Denali prod (and staging by analogy)
**Last updated:** 2026-04-24
**Based on incident:** `docs/incidents/2026-04-23-ecr-eviction.md`

## Scheduled Downtime (Pre-Launch Cost Optimization)

**Important context for responders:** Denali prod is scheduled to run only during business hours as a cost optimization measure pre-launch. Outside these hours, the service is intentionally down.

**Schedule:**
- **23:00 CDT (04:00 UTC)** — Service scales to 0, RDS stops
- **08:00 CDT (13:00 UTC)** — RDS starts, service scales to 1

**Driven by:**
- EventBridge rule `denali-shutdown-nightly` → Lambda `denali-shutdown`
- EventBridge rule `denali-startup-daily` → Lambda `denali-startup`
- Both Lambdas use IAM role `denali-scheduler-lambda-role`

### Alarm Behavior During Scheduled Downtime

During the 23:00–08:00 CDT window, CloudWatch alarm actions are automatically disabled by the shutdown Lambda and re-enabled by the startup Lambda. This applies to:
- `denali-prod-ecs-running-below-desired`
- `denali-prod-alb-5xx-rate-high`

**Implication:** No alarm emails are sent during the quiet window, even if alarms enter ALARM state due to missing metrics. A **real outage during this window will NOT page you automatically.**

If you need to monitor prod during the quiet window for any reason (deploy test, late-night maintenance), you can manually re-enable actions:

```bash
aws cloudwatch enable-alarm-actions \
  --alarm-names denali-prod-ecs-running-below-desired \
                denali-prod-alb-5xx-rate-high
```

Remember to disable again before the next scheduled shutdown, or let the startup Lambda handle it at 08:00 CDT.

### How to Distinguish Scheduled Downtime from an Outage

Before diagnosing a 503 on denali.health or missing alarm emails, check the service state:

```bash
aws ecs describe-services --cluster denali --services denali-web \
  --query 'services[0].{desired:desiredCount,running:runningCount}'
```

| desired | running | Meaning |
|---------|---------|---------|
| 0 | 0 | Scheduled downtime — not an outage |
| 1 | 1 | Healthy — 503 likely app-layer issue |
| 1 | 0 | **Real outage** — proceed to Recovery paths below |
| 1 | 2 | Mid-deploy rollover — wait 2 min and recheck |

### Real Incident During Scheduled Downtime

If you need to recover prod before the 08:00 CDT scheduled startup (e.g., urgent user access required), manually invoke the startup Lambda:

```bash
aws lambda invoke \
  --function-name denali-startup \
  --invocation-type RequestResponse \
  --cli-binary-format raw-in-base64-out \
  --payload '{}' \
  /tmp/startup-response.json
cat /tmp/startup-response.json
```

The Lambda will:
1. Start RDS (up to 10 min)
2. Scale ECS service to 1
3. Poll for task READY (up to 3 min)
4. Re-enable alarm actions

Total time to healthy: ~13 min.

Alternative — manual sequence without the Lambda:

```bash
# 1. Start RDS
aws rds start-db-instance --db-instance-identifier denali-prod

# 2. Wait for RDS available
aws rds wait db-instance-available \
  --db-instance-identifier denali-prod

# 3. Scale ECS
aws ecs update-service --cluster denali --service denali-web \
  --desired-count 1

# 4. Re-enable alarms (important — otherwise you're flying blind)
aws cloudwatch enable-alarm-actions \
  --alarm-names denali-prod-ecs-running-below-desired \
                denali-prod-alb-5xx-rate-high
```

After manual recovery, the next scheduled shutdown at 23:00 CDT will re-run as normal.

## Symptoms

**Before troubleshooting:** If it's between 23:00 CDT and 08:00 CDT, see the "Scheduled Downtime" section above first. Most 503s and absent alarms during that window are expected behavior, not incidents.

Genuine incident symptoms:

- `denali.health` or `staging.denali.health` returns 502 or times out
- ECS service shows `desiredCount=1, runningCount=0`
- CloudWatch alarm `denali-prod-ecs-running-below-desired` fires (if prod)
- EventBridge rule `denali-prod-ecs-task-failed-to-start` emits an SNS email with `stoppedReason` containing `CannotPullContainerError`
- ECS service events include entries like:
  > `CannotPullContainerError: pull access denied for …, repository does not exist or may require 'docker login': denied: requested access to the resource is denied`
  >
  > or: `manifest for … not found`

## Immediate Diagnosis (2 min)

1. **Check what image the task def references:**

   ```bash
   aws ecs describe-task-definition \
     --task-definition denali:<revision> \
     --query 'taskDefinition.containerDefinitions[0].image'
   ```

2. **Check if that image exists in ECR:**

   ```bash
   aws ecr describe-images \
     --repository-name denali \
     --image-ids imageTag=<sha-from-image-uri>
   ```

   If this returns `ImageNotFoundException`, the image has been evicted — continue to **Recovery**.

   If it returns a valid result, the failure is not an eviction — check ECS task role permissions, VPC endpoints, or ECR authentication instead.

## Recovery Path 1: Roll Back to `prod-stable` Tag (Fastest)

**Prerequisite:** `prod-stable` tag exists in ECR (applied automatically on successful prod deploys since 2026-04-23).

1. **Verify `prod-stable` exists:**

   ```bash
   aws ecr describe-images \
     --repository-name denali \
     --image-ids imageTag=prod-stable
   ```

2. **Register a new task def pointing at `prod-stable`:**

   The simplest method is to trigger a prod redeploy from main, which rebuilds from the CMS-approved source commit. See **Recovery Path 2**.

   For a truly urgent rollback without rebuild, create a new task def revision manually:

   ```bash
   # Pull the last known-good task def as a template
   aws ecs describe-task-definition \
     --task-definition denali:<last-known-good> \
     --query 'taskDefinition' > /tmp/taskdef.json

   # Edit /tmp/taskdef.json:
   #   - Change containerDefinitions[0].image to <ECR_URI>/denali:prod-stable
   #   - Remove read-only fields: taskDefinitionArn, revision, status,
   #     requiresAttributes, compatibilities, registeredAt, registeredBy

   aws ecs register-task-definition \
     --cli-input-json file:///tmp/taskdef.json

   aws ecs update-service \
     --cluster denali --service denali-web \
     --task-definition denali:<new-revision> \
     --force-new-deployment
   ```

## Recovery Path 2: Rebuild from Main (Recommended)

This is what we did during the 2026-04-23 incident. Safer than manual task def surgery. Takes ~15 min.

1. **Verify main is at the expected tip:**

   ```bash
   git fetch origin
   git log --oneline origin/main -1
   ```

2. **Trigger a rebuild via workflow dispatch:**

   ```bash
   gh workflow run deploy.yml --ref main
   ```

3. **Watch the run:**

   ```bash
   RUN_ID=$(gh run list --workflow=deploy.yml --branch main \
     --limit 1 --json databaseId -q '.[0].databaseId')
   gh run watch $RUN_ID --exit-status
   ```

   The workflow will:
   - Build a new Docker image (base layers pinned via Dockerfile digest-pin since Step 15A, so no base-image drift)
   - Push to ECR with both `<sha>` and `latest` tags
   - Register a new task def revision
   - Update `denali-web` service to the new revision
   - Wait for service stability
   - Retag the image as `prod-stable` on success

4. **Verify recovery:**

   ```bash
   aws ecs describe-services \
     --cluster denali --services denali-web \
     --query 'services[0].{task:taskDefinition,running:runningCount,state:deployments[0].rolloutState}'

   curl -sS -o /dev/null -w "%{http_code}\n" https://denali.health/api/health
   ```

   Expected: `rolloutState: COMPLETED`, `running: 1`, health `200`.

## Preventing Recurrence

The following defenses were implemented 2026-04-23. Verify each is still in place if investigating a regression.

### 1. ECR lifecycle policy (`denali` repo)

5-rule policy, per-prefix:
- Rule 1: `prod-stable` tag never expires (9999 retention)
- Rule 2: hex 0-7 SHA tags, keep last 10
- Rule 3: hex 8-f SHA tags, keep last 10
- Rule 4: `staging-` prefix, keep last 5 (legacy; staging now writes to its own repo)
- Rule 5: untagged, expire after 1 day

Verify:

```bash
aws ecr get-lifecycle-policy \
  --repository-name denali \
  --query 'lifecyclePolicyText' --output text | jq '.rules | length'
```

Expected: `5`.

### 2. Separate ECR repos

- `denali` (prod) and `denali-staging` (staging) are independent. Staging pushes physically cannot affect prod retention.

Verify:

```bash
aws ecr describe-repositories \
  --query 'repositories[].repositoryName' --output text
```

Expected: both repos present.

### 3. Separate IAM deploy roles

- `denali-prod-deploy-role`: trusts `refs/heads/main`, scoped to prod cluster/service/repo
- `denali-staging-deploy-role`: trusts `refs/heads/develop`, scoped to staging
- `denali-github-actions-role`: legacy, DISARMED (zero permissions, kept as rollback target)

Verify:

```bash
aws iam list-roles \
  --query 'Roles[?contains(RoleName, `denali`) && contains(RoleName, `deploy-role`)].RoleName'
```

Expected: both new roles.

### 4. Dockerfile base image pinned

- `FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293`
- Prevents base-layer drift across rebuilds

Verify:

```bash
head -6 app/Dockerfile | grep "FROM node"
```

Expected: FROM line includes `@sha256:`.

### 5. GitHub Actions pinned to SHAs

- All `uses:` references use 40-char commit SHAs with version comments for readability

Verify:

```bash
grep "uses:" .github/workflows/deploy.yml \
  | grep -v '@[0-9a-f]\{40\}'
```

Expected: empty output (all actions pinned).

### 6. CloudWatch alarms + EventBridge rule → SNS

Three detection layers, all publishing to `denali-prod-alerts` SNS topic:

- `denali-prod-ecs-running-below-desired` (CloudWatch alarm): 2-min symptom-level
- `denali-prod-alb-5xx-rate-high` (CloudWatch alarm): 5-min app-level
- `denali-prod-ecs-task-failed-to-start` (EventBridge rule): per-event cause-level — fires on ECS Task State Change events with `stopCode: TaskFailedToStart`
- SNS topic `denali-prod-alerts` with 2 confirmed email subscriptions

Verify:

```bash
# CloudWatch alarms (both should be in OK state)
aws cloudwatch describe-alarms \
  --alarm-names \
    "denali-prod-ecs-running-below-desired" \
    "denali-prod-alb-5xx-rate-high" \
  --query 'MetricAlarms[*].{name:AlarmName,state:StateValue}'

# EventBridge rule (should be ENABLED with 1 SNS target)
aws events describe-rule \
  --name denali-prod-ecs-task-failed-to-start \
  --query '{name:Name,state:State}'
aws events list-targets-by-rule \
  --rule denali-prod-ecs-task-failed-to-start \
  --query 'Targets[*].{id:Id,arn:Arn}'

# SNS subscriptions
aws sns get-topic-attributes \
  --topic-arn arn:aws:sns:us-east-1:236823123138:denali-prod-alerts \
  --query 'Attributes.SubscriptionsConfirmed'
```

Expected: both alarms in `OK` state, EventBridge rule `ENABLED` with SNS target, `SubscriptionsConfirmed = 2`.

### 7. Scheduler Lambda Alarm Suppression

The `denali-shutdown` Lambda calls `cloudwatch:DisableAlarmActions` on prod alarms before scaling ECS to 0. The `denali-startup` Lambda re-enables after the service is verified running. Prevents false-positive alarm emails during the nightly scheduled downtime window without sacrificing real-incident detection during uptime hours.

IAM permission granted on `denali-scheduler-lambda-role` (statement 4 of `denali-scheduler-permissions` inline policy), scoped to the two prod alarm ARNs only.

Verify deployed:

```bash
aws lambda get-function-configuration \
  --function-name denali-shutdown \
  --query 'CodeSha256'

aws lambda get-function-configuration \
  --function-name denali-startup \
  --query 'CodeSha256'
```

Compare SHAs against the deployment record (incident postmortem, Step 24).

Verify IAM:

```bash
aws iam get-role-policy \
  --role-name denali-scheduler-lambda-role \
  --policy-name denali-scheduler-permissions \
  --query 'PolicyDocument.Statement | length'
```

Expected: 4.

## Forensic Information

If investigating an incident, these INACTIVE task defs preserve historical state for audit:

- `denali:163`, `:164`, `:165`, `:166`, `:167`: pre-recovery task defs from 2026-04-23 outage. All reference images that were evicted during the incident (for :163-:166) or that existed originally at a now-evicted digest (:167).

Inspect any of them:

```bash
aws ecs describe-task-definition \
  --task-definition denali:<revision> \
  --query 'taskDefinition.containerDefinitions[0].image'
```

## Known False Positive Alarm Scenarios

1. **`denali-prod-ecs-running-below-desired` fires briefly during normal deploys.** Task rollover creates momentary windows where a new task is launching and the old is stopping. The 2-of-2-datapoints evaluation should mask rollovers under 2 min, but sustained deploys > 2 min may trigger. Check `rolloutState: IN_PROGRESS` before escalating.

2. **EventBridge `TaskFailedToStart` can fire for transient infrastructure issues.** E.g., brief Secrets Manager or STS throttling. If the next task attempt succeeds and the service recovers, this is noise. Persistent (>2 events in 5 min) indicates real problem.

3. **Alarms appear stale during scheduled downtime window.** Between 23:00–08:00 CDT, alarm actions are disabled by design (see "Scheduled Downtime" section above). If you see `ActionsEnabled: false` on either prod alarm during this window, it's expected. If you see it during uptime hours (08:00–23:00 CDT), something is wrong — investigate why `denali-startup` Lambda failed to re-enable, and manually re-enable alarm actions.

## Further reading

- Incident postmortem: `docs/incidents/2026-04-23-ecr-eviction.md`
- `CLAUDE.md` → Infrastructure Architecture section
- Rollback artifacts: `docs/runbooks/rollback-artifacts/` (if present — contains prior IAM policies for emergency restoration)
