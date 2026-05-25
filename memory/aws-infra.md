# AWS Infrastructure — Denali

> Last updated: 2026-02-28
> Account: 236823123138 | Region: us-east-1 | IAM user: denaliadmin

> **Update — May 24, 2026:** Vercel and Supabase are no longer in use. All infrastructure (staging and production) now runs on AWS exclusively (ECS Fargate, RDS Postgres, Cognito, Bedrock, SES; AWS BAA executed 2026-02-25). Row-Level Security has been replaced by explicit `WHERE user_id = $1` clauses in application code. Strikethroughs below preserve the original text as historical record.

## Changes Made (2026-02-27 Session)

### 1. CloudWatch Log Retention
- `/ecs/denali` retention changed from **90 days → 3 days**
- Reason: pre-launch, no production traffic — 3 days sufficient for debugging
- Saves negligible cost but good hygiene

### 2. RDS Security Hardening
- `denali-prod` set to **PubliclyAccessible: false**
- RDS EIP (54.83.185.123, eipalloc-0baf0a1505001d356) auto-released by AWS
- EIPs went from 4 → 3 (remaining 3 are ALB-attached)
- Connectivity verified: ECS SG `sg-0c234bbde5efb2d53` → RDS SG `sg-018b0bc1ca0f1db14` port 5432

### 3. Shell Aliases Created
- File: `infra/denali-aliases.sh`
- Commands: `denali-up`, `denali-down`, `denali-status`
- Setup: add `source ~/Documents/Project/Denali/infra/denali-aliases.sh` to `~/.zshrc`

### 4. IAM Role for Lambda Scheduler
- Role: `denali-scheduler-lambda-role`
- Created: 2026-02-27T23:24:54+00:00
- Permissions: RDS start/stop/describe (denali-prod), ECS update/describe (denali-web), CloudWatch Logs
- Trust: lambda.amazonaws.com

### 5. CloudFormation Template + Deploy Script
- Template: `infra/cfn-scheduler.json`
- Deploy: `infra/deploy-scheduler.sh`
- Stack name: `denali-scheduler`
- **STATUS: NOT YET DEPLOYED** — run `./deploy-scheduler.sh` from Mac terminal
- Contains: 3 Lambda functions (shutdown, startup, safety-stop) + 5 EventBridge rules + 5 permissions

## Network Architecture

```
Internet → ALB (denali-alb, sg-0f52b535fcf3742f3)
              → ECS Fargate (denali-web, sg-0c234bbde5efb2d53)
                  → RDS PostgreSQL (denali-prod, sg-018b0bc1ca0f1db14, PRIVATE)
```

VPC: vpc-0ff561d6675cd32eb
Subnets: subnet-095e672c1abdf83ce, subnet-02774ce466170d818, subnet-0322ce60675a738f9
No NAT Gateways. No VPC Endpoints.

## Resource Inventory (Live as of 2026-02-27 23:36 UTC)

| Service | Resource | Details | Status |
|---------|----------|---------|--------|
| RDS | denali-prod | db.t4g.micro, PG 16.9, 20GB gp3, private | available |
| ECS | denali-web | 0.5 vCPU, 1GB, Fargate, task :21 | desired=1, running=1 |
| ALB | denali-alb | Application, internet-facing | active |
| EIP | 3× | All ALB-associated | in-use |
| Secrets | 3 | denali/prod/db, denali/prod/app, rds!db-... | active |
| CW Logs | /ecs/denali | 3-day retention, ~8KB | active |
| S3 | denali-cloudtrail-logs-236823123138 | CloudTrail bucket | active |
| CloudTrail | denali-audit-trail | Multi-region | active |
| ECR | denali | Docker images | active |
| Cognito | denali-users | us-east-1_bA3bcPcy2 | active |
| IAM | 4 denali-* roles | ecs-execution, ecs-task, github-actions, scheduler-lambda | active |
| Lambda | (none) | Pending CFN deploy | — |
| EventBridge | (none) | Pending CFN deploy | — |
| CloudFormation | (none) | Pending CFN deploy | — |

## Cost Estimate

### 24/7 Runtime (Current — No Scheduler)

| Service | Monthly |
|---------|---------|
| RDS db.t4g.micro (730 hrs × $0.016) | $11.68 |
| RDS storage (20GB × $0.08) | $1.60 |
| ECS Fargate CPU (0.5 × $0.04048 × 730) | $14.78 |
| ECS Fargate Memory (1GB × $0.004445 × 730) | $3.24 |
| ALB fixed hourly (730 × $0.0225) | $16.43 |
| ALB LCU (minimal pre-launch) | ~$0.50 |
| Secrets Manager (3 × $0.40) | $1.20 |
| S3 + CloudTrail + CW | ~$0.10 |
| ECR + Cognito + IAM + EventBridge | $0 (free tier) |
| **Total** | **~$49.53** |

### With Scheduler Deployed (~16hr/day weekdays, less weekends)

Working hours: ~7:45am–11:30pm CT weekdays, ~7:45am–2:00am weekends
Estimated uptime: ~480 hrs/mo (vs 730)

| Service | Monthly |
|---------|---------|
| RDS (480 hrs × $0.016 + storage) | $9.28 |
| ECS Fargate (480 hrs) | $11.82 |
| ALB (still 730 hrs — always on) | $16.93 |
| Other (Secrets, S3, etc.) | $1.30 |
| **Total** | **~$39.33** |

**Savings**: ~$10/mo (~20%) from scheduler

## Completed Actions (2026-02-28)

1. ✅ **Scheduler deployed**: `denali-scheduler` CFN stack live — 3 Lambdas + 5 EventBridge rules
2. ✅ **Aliases sourced**: `denali-up`, `denali-down`, `denali-status` in `~/.zshrc`
3. ✅ **Monitor deployed**: `denali-monitor` CFN stack live — Lambda + SNS (email only) + 2 EventBridge rules
4. ✅ **ECR lifecycle**: Keep last 3 images, auto-expire older
5. ✅ **S3 lifecycle**: CloudTrail logs expire after 30 days
6. ✅ **qashai-api-production target group deleted**: Orphaned from dead project

## Additional Resources (post-deploy)

| Service | Resource | Details |
|---------|----------|---------|
| SNS | denali-monitor-alerts | Email: ramanac@gmail.com, admin@denali.health |
| Lambda | denali-monitor | Health + cost digest, Python 3.12 |
| Lambda | denali-shutdown | ECS→0 + RDS stop, Python 3.12 |
| Lambda | denali-startup | RDS start + ECS→1, Python 3.12 |
| Lambda | denali-safety-stop | Re-stop RDS if ECS=0, Python 3.12 |
| EventBridge | 7 rules | 5 scheduler + 2 monitor (8am/8pm CT) |
| CloudFormation | 2 stacks | denali-scheduler, denali-monitor |
| IAM | denali-monitor-lambda-role | ce, ecs, rds, elb, sns, logs |

## Deployment & DNS (2026-03-03)

### DNS Migration: GoDaddy → Route 53 (completed 2026-03-03)

- Hosted zone: `denali.health` in Route 53
- Nameservers: ns-1637.awsdns-12.co.uk, ns-463.awsdns-57.com, ns-1270.awsdns-30.org, ns-847.awsdns-41.net
- GoDaddy nameservers updated to point to Route 53

### Domain Routing (post-migration)

| Domain | Points To | Purpose |
|--------|-----------|---------|
| `www.denali.health` | **AWS ALB** (CNAME → denali-alb-1075324152.us-east-1.elb.amazonaws.com) | Production |
| `denali.health` | **AWS ALB** (A record alias) | Production |
| `staging.denali.health` | **AWS ALB** (CNAME) | Same ALB/ECS as production for now |
| `stage.denali.health` | ~~**Vercel**~~ (decommissioned) | ~~Old Vercel staging — DO NOT USE~~ Vercel staging fully removed; staging now on AWS ALB |

### Current ECS Deployment

- Task definition: `denali:30` (commit 958cfba)
- Image: `236823123138.dkr.ecr.us-east-1.amazonaws.com/denali:958cfba945d666de090cce1026f865f00247aedb`
- Deployed: 2026-03-03T16:32:00 CT (via GitHub Actions CI/CD)
- Status: PRIMARY, 1 running, healthy
- Includes all commits from :21 through :30 (Blue Button OAuth, card merge, PaywallModal, consent toggles, Supabase removal)

### Recent ECS Deployments

| Task Def | Commit | Changes |
|----------|--------|---------|
| :30 | 958cfba | Supabase cleanup (11K lines removed), consent toggles, PaywallModal, card merge, Blue Button OAuth fixes, docs updates |
| :21 | 35c160a | FHIR callback refreshes expired Cognito token during Blue Button OAuth |
| :20 | 7d86a37 | Skip middleware session enforcement on API routes |
| :19 | c4bd470 | 7-day forced re-auth, MFA gate on chat, session policy UX |
| :18 | 910ccfa | Error text visibility, UUID display name, sign-in friction |

### Blue Button Callback URLs

The FHIR authorize route auto-detects callback URL from request origin (no `BLUEBUTTON_CALLBACK_URL` env var). All registered in Blue Button sandbox: `denali.health`, `www.denali.health`, `staging.denali.health`, `stage.denali.health`, `localhost:3000`.

**Blue Button OAuth fix (commit 14adc86)**: Removed `www.` stripping that caused cookie domain mismatch. Fixed callback route using internal ECS hostname (`ip-172-31-...`) by reading `x-forwarded-host` header for all redirects.

### Stripe Status

- **Sandbox mode** — both plans ($10 single, $20 monthly) verified end-to-end on denali.health (2026-03-03)
- PaywallModal wired to chat page "Upgrade plan" suggestion button
- Switch to live Stripe keys for production launch

## Notes

- SMS not available: Account in SNS SMS sandbox. Needs toll-free origination number (~$2/mo) to enable. Email-only for now.
- ALB is the biggest fixed cost ($16.43/mo). Could replace with API Gateway for further savings (more complex).
