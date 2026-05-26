# Chunk 19: Infrastructure Verification (AWS CLI)

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 14 (10 positive + 4 negative)**
**Prerequisites**: AWS CLI configured with appropriate credentials
**Account**: N/A (AWS CLI, not app login)
**Clean state**: N/A

**Note**: Replace cluster names, ARNs, and identifiers with actual values. The names below are based on the feature inventory — adjust if different.

---

## Positive Tests

### 19.P1 — ECS service running
**Steps**: `aws ecs describe-services --cluster denali --services denali-web --query 'services[0].{desired:desiredCount,running:runningCount,status:status}'`
**Expected**: `desiredCount == runningCount`, status = `ACTIVE`.
**Log**: desired, running, status values.

### 19.P2 — RDS instance available
**Steps**: `aws rds describe-db-instances --db-instance-identifier denali-prod --query 'DBInstances[0].DBInstanceStatus'`
**Expected**: Status = `available`.
**Log**: Status value.

### 19.P3 — RDS not publicly accessible
**Steps**: `aws rds describe-db-instances --db-instance-identifier denali-prod --query 'DBInstances[0].PubliclyAccessible'`
**Expected**: `false`.
**Log**: Value (must be false — CRITICAL SECURITY).

### 19.P4 — RDS encryption enabled
**Steps**: `aws rds describe-db-instances --db-instance-identifier denali-prod --query 'DBInstances[0].StorageEncrypted'`
**Expected**: `true` (AES-256 KMS encryption).
**Log**: Value.

### 19.P5 — ALB healthy targets
**Steps**: First get target group ARN: `aws elbv2 describe-target-groups --query 'TargetGroups[?contains(TargetGroupName,`denali`)].TargetGroupArn' --output text`
Then: `aws elbv2 describe-target-health --target-group-arn [ARN]`
**Expected**: All targets show `State: healthy`.
**Log**: Target count, all healthy yes/no.

### 19.P6 — Cognito user pool exists
**Steps**: `aws cognito-idp list-user-pools --max-results 20 --query 'UserPools[?contains(Name,`denali`)]'`
Then describe: `aws cognito-idp describe-user-pool --user-pool-id [ID] --query 'UserPool.{Name:Name,DeletionProtection:DeletionProtection,Status:Status}'`
**Expected**: Pool `denali-users` exists, deletion protection = ON (or `ACTIVE`).
**Log**: Pool name, deletion protection value.

### 19.P7 — Secrets Manager has 3 secrets
**Steps**: `aws secretsmanager list-secrets --query 'SecretList[?contains(Name,`denali`)].Name'`
**Expected**: At least 3 secrets present: `denali/prod/db`, `denali/prod/app`, and `rds!db-*` (auto-generated).
**Log**: List of secret names found.

### 19.P8 — CloudTrail active
**Steps**: `aws cloudtrail describe-trails --trail-name-list denali-audit-trail --query 'trailList[0].{Name:Name,IsMultiRegion:IsMultiRegionTrail}'`
Then: `aws cloudtrail get-trail-status --name denali-audit-trail --query '{IsLogging:IsLogging}'`
**Expected**: Trail exists, multi-region = true, IsLogging = true.
**Log**: Name, multi-region, logging status.

### 19.P9 — ECR lifecycle policy (keep last 3)
**Steps**: `aws ecr get-lifecycle-policy --repository-name denali --query 'lifecyclePolicyText'`
**Expected**: Policy contains keep-last-3 rule (imageCountMoreThan: 3 or similar).
**Log**: Policy rule summary.

### 19.P10 — Scheduler stack exists
**Steps**: `aws cloudformation describe-stacks --stack-name denali-scheduler --query 'Stacks[0].StackStatus'`
**Expected**: Status = `CREATE_COMPLETE` or `UPDATE_COMPLETE`.
**Log**: Stack status.

---

## Negative Tests

### 19.N1 — RDS not publicly accessible (redundant security check)
**Steps**: Re-verify: `aws rds describe-db-instances --db-instance-identifier denali-prod --query 'DBInstances[0].PubliclyAccessible'`
**Expected**: `false`. This is a CRITICAL security check — verifying twice intentionally.
**Log**: Value (MUST be false).

### 19.N2 — No wide-open security groups on DB
**Steps**: Get RDS security groups: `aws rds describe-db-instances --db-instance-identifier denali-prod --query 'DBInstances[0].VpcSecurityGroups[*].VpcSecurityGroupId' --output text`
Then for each SG: `aws ec2 describe-security-groups --group-ids [SG_ID] --query 'SecurityGroups[0].IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`]]'`
**Expected**: No `0.0.0.0/0` rule on database ports (5432). Empty result.
**Log**: Open rules found (should be none on DB ports).

### 19.N3 — ALB enforces HTTPS
**Steps**: `aws elbv2 describe-listeners --load-balancer-arn [ALB_ARN] --query 'Listeners[*].{Port:Port,Protocol:Protocol,DefaultActions:DefaultActions[0].Type}'`
**Expected**: Port 80 listener has action = `redirect` (to HTTPS). Port 443 listener uses TLS 1.2+.
**Log**: Listener configs, HTTP redirect present yes/no.

### 19.N4 — S3 CloudTrail bucket not public
**Steps**: `aws s3api get-bucket-policy-status --bucket denali-cloudtrail-logs --query 'PolicyStatus.IsPublic'`
If error (no policy), also check: `aws s3api get-public-access-block --bucket denali-cloudtrail-logs`
**Expected**: `IsPublic: false` or public access block enabled.
**Log**: Public status, access block settings.

---

## End of Chunk 19

**You must now**: Write `results/chunk-19-results.md` with every test result, then report summary to user and STOP.
