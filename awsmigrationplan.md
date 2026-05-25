# Denali — AWS Migration Plan

> Status: ~~**Planning**~~ **COMPLETED 2026-02-26** | Started: 2026-02-25 | AWS BAA: Active (2026-02-25)
> Maintainer: @cvr

> **Update — May 24, 2026:** Vercel and Supabase are no longer in use. All infrastructure (staging and production) now runs on AWS exclusively (ECS Fargate, RDS Postgres, Cognito, Bedrock, SES; AWS BAA executed 2026-02-25). Row-Level Security has been replaced by explicit `WHERE user_id = $1` clauses in application code. This document is the historical plan; body preserved as record of the migration steps taken.

---

## 1. Overview

### Why We Are Migrating

| Dimension | Current Stack | AWS Stack |
|-----------|-------------|-----------|
| **Monthly cost** | $1,368/month (Supabase $998 + Vercel $370) | ~$55/month |
| **BAAs** | 3 separate BAAs (none yet signed) | 1 BAA (signed 2026-02-25) |
| **HIPAA status** | Not yet compliant | Compliant from day 1 |
| **Vendor risk** | 3 PHI processors | 1 PHI processor |
| **Annual savings** | — | ~$15,756/year |

### Confirmed Pricing
- **Supabase HIPAA**: Team plan $599/month + HIPAA add-on $399/month = **$998/month**
- **Vercel HIPAA**: Pro plan $20/month + HIPAA add-on $350/month = **$370/month**
- **AWS**: All HIPAA-eligible services under **free BAA** via AWS Artifact = **~$55/month**

### AWS BAA Status
- **Signed**: February 25, 2026
- **Account**: Qash Solutions Inc. (`admin@denali.health`)
- **Scope**: Covers all HIPAA-eligible AWS services in this account
- **Critical rule**: Only use HIPAA-eligible services with PHI; encrypt all PHI in-transit and at-rest

---

## 2. Current Stack vs Target Stack

### Current
```
User → Vercel (hosting/CDN) → Supabase (auth + database) → Anthropic API (Claude direct)
                                                          → MCP servers (mcp.deepsense.ai)
```

### Target
```
User → AWS ECS + Fargate (hosting) → AWS RDS PostgreSQL (database)
                                   → AWS Cognito (auth)
                                   → AWS Bedrock (Claude — HIPAA-eligible, no PHI retention)
                                   → MCP servers (mcp.deepsense.ai — unchanged, no PHI)
```

### What Is NOT Changing
- Vercel → AWS for hosting code
- Next.js framework
- Stripe (payments — no PHI, no BAA needed)
- CMS Blue Button 2.0 FHIR API
- MCP servers at mcp.deepsense.ai (code lookups only, no patient identifiers)
- Resend (email OTP delivery)
- Application logic, UI, skills, tools, orchestration flows

---

## 3. Scope of Migration

### Infrastructure (AWS Setup)
- [x] AWS account created (`admin@denali.health`, Qash Solutions Inc.)
- [x] AWS BAA signed (February 25, 2026)
- [ ] IAM user + CLI access
- [ ] RDS PostgreSQL (database)
- [ ] AWS Cognito (auth)
- [ ] AWS Bedrock (Claude AI)
- [ ] AWS Secrets Manager (environment variables)
- [ ] AWS ECS + Fargate (hosting)
- [ ] AWS ALB + ACM (load balancer + SSL)
- [ ] AWS Route 53 (DNS)
- [ ] AWS CloudTrail (audit logging — HIPAA required)
- [ ] AWS CloudWatch (application logs)
- [ ] GitHub Actions (CI/CD — replaces Vercel git integration)

### Code Changes
- [ ] `src/lib/claude.ts` — Anthropic SDK → Bedrock SDK
- [ ] `src/lib/tools/index.ts` — Add 3 MCP tools as local tools (ICD-10, CMS, NPI direct API)
- [ ] `src/lib/supabase.ts` — Remove; replaced by Drizzle/Prisma → RDS
- [ ] `src/lib/supabase-server.ts` — Remove; replaced by server DB client
- [ ] `src/lib/supabase-admin.ts` — Remove; replaced by admin DB client
- [ ] `src/middleware.ts` — Add `export const runtime = 'nodejs'`; replace Supabase auth refresh with Cognito
- [ ] `src/hooks/useAuth.ts` — Supabase Auth → Cognito SDK
- [ ] All API routes using `createServerSupabaseClient()` → new DB + Cognito client
- [ ] `src/config/api.ts` — Update model IDs to Bedrock ARNs

### Legal Docs (Update BEFORE sending to CMS)
- [ ] `app/src/app/faq/page.tsx` — 1 change
- [ ] `app/src/app/terms/page.tsx` — 1 change
- [ ] `app/src/app/privacy/page.tsx` — 5 changes (critical: Bedrock no-retention, BAA active)
- [ ] `app/src/app/hipaa/page.tsx` — 2 changes (critical: BAA active, vendor consolidation)

---

## 4. Pre-Migration Checklist

Before writing a single line of code:

- [ ] Export Supabase schema: `pg_dump --schema-only --no-owner --no-acl "postgresql://..." > denali_schema.sql`
- [ ] Export seed data (5 tables): `pg_dump --data-only -t carc_codes -t rarc_codes -t eob_denial_mappings -t denial_patterns -t appeal_levels "postgresql://..." > denali_seed.sql`
- [ ] Document all current Supabase RPC function names (for RDS recreation)
- [ ] Document all current env vars (Vercel dashboard → Settings → Environment Variables)
- [ ] Confirm AWS CLI configured with IAM credentials
- [ ] Enable CloudTrail on AWS account (HIPAA requirement — do before any PHI enters AWS)
- [ ] Update legal docs (see Section 9) before going live

---

## 5. Step-by-Step Migration

---

### Step 1: IAM Setup
**Goal**: CLI access with least-privilege

```bash
# Create IAM user: denali-app
# Attach policies:
#   - AmazonRDSFullAccess
#   - AmazonCognitoPowerUser
#   - SecretsManagerReadWrite
#   - AmazonBedrockFullAccess
#   - AmazonECS_FullAccess
#   - ElasticLoadBalancingFullAccess
#   - AmazonEC2ContainerRegistryFullAccess
#   - Route53FullAccess
#   - CloudWatchLogsFullAccess
# Generate Access Key → configure AWS CLI
aws configure
```

**Verification**: `aws sts get-caller-identity` returns Qash Solutions account ID.

---

### Step 2: Enable CloudTrail (HIPAA Required — Do First)
**Goal**: Audit trail of all AWS API calls before any PHI enters the account

```bash
aws cloudtrail create-trail \
  --name denali-hipaa-trail \
  --s3-bucket-name denali-cloudtrail-logs \
  --include-global-service-events \
  --is-multi-region-trail

aws cloudtrail start-logging --name denali-hipaa-trail
```

**Verification**: CloudTrail console shows trail status = "Logging".

---

### Step 3: RDS PostgreSQL
**Goal**: HIPAA-eligible PostgreSQL database, encrypted at rest

```bash
# Create DB subnet group (public subnets for now — restrict via security group)
# Create security group: allow port 5432 from ECS security group only

aws rds create-db-instance \
  --db-instance-identifier denali-prod \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username denali_admin \
  --master-user-password <strong-password-via-secrets-manager> \
  --allocated-storage 20 \
  --storage-type gp3 \
  --storage-encrypted \
  --backup-retention-period 7 \
  --deletion-protection \
  --publicly-accessible \
  --region us-east-1
```

**After creation**:
```bash
# Import schema
psql -h <rds-endpoint> -U denali_admin -d postgres -f denali_schema.sql

# Import seed data
psql -h <rds-endpoint> -U denali_admin -d postgres -f denali_seed.sql
```

**Verification**:
- All tables present: `\dt` shows same tables as Supabase
- RLS policies active: `\d+ users` shows RLS enabled
- Seed data present: `SELECT COUNT(*) FROM carc_codes` = 90
- Connection uses SSL: `psql "sslmode=require host=..."`

---

### Step 4: AWS Cognito User Pool
**Goal**: Email OTP + TOTP MFA — replaces Supabase Auth

```bash
aws cognito-idp create-user-pool \
  --pool-name denali-users \
  --policies '{"PasswordPolicy":{"MinimumLength":6}}' \
  --mfa-configuration OPTIONAL \
  --email-configuration SourceArn=<ses-arn> \
  --username-attributes email \
  --auto-verified-attributes email \
  --region us-east-1
```

**Key configuration**:
- Sign-in: email only
- Email OTP: native (no Lambda triggers needed — Cognito supports this natively as of Nov 2024)
- TOTP MFA: optional (matches current Supabase TOTP)
- SES: configure and verify `admin@denali.health` as sender

**Verification**:
- Create test user via console → OTP email received
- Enroll TOTP → challenge works
- Token issued and valid

---

### Step 5: AWS Bedrock — Enable Claude Models
**Goal**: Enable Claude Sonnet 4.6 + Opus 4.6 in us-east-1

```
AWS Console → Bedrock → Model access → Request access:
  ✓ Claude Sonnet 4.6 (anthropic.claude-sonnet-4-6)
  ✓ Claude Opus 4.6 (anthropic.claude-opus-4-6-v1)
```

**Model IDs for code**:
```typescript
// src/config/api.ts
ANTHROPIC_MODEL: "global.anthropic.claude-sonnet-4-6"
ANTHROPIC_APPEAL_MODEL: "global.anthropic.claude-opus-4-6-v1"
```

**SDK change** (`src/lib/claude.ts`):
```typescript
// Before
import Anthropic from "@anthropic-ai/sdk";
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// After
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
const claude = new AnthropicBedrock({ awsRegion: "us-east-1" });
// Note: uses AWS credentials from environment — no API key needed
```

**MCP tools → local tools** (the only significant code change in `claude.ts`):
- Remove `mcp_servers` from API call (not supported on Bedrock)
- Remove `betas: ["mcp-client-2025-04-04"]`
- Add 3 new local tool definitions in `src/lib/tools/index.ts`:
  - `search_icd10` → calls ICD-10 API directly
  - `search_cms_coverage` → calls CMS Coverage API directly
  - `npi_lookup` → calls NPPES NPI API directly

**Verification**:
- Send test message → Claude responds via Bedrock
- Check CloudWatch → no prompt/response retention logs (default: no storage)
- Tool calling works (local tools + MCP converted tools)

---

### Step 6: AWS Secrets Manager
**Goal**: All env vars stored securely, injected into ECS tasks

Secrets to create:
```
denali/anthropic-not-needed     # Removed — Bedrock uses AWS creds
denali/bluebutton-client-id
denali/bluebutton-client-secret
denali/fhir-encryption-key
denali/stripe-secret-key
denali/stripe-webhook-secret
denali/stripe-price-per-appeal
denali/stripe-price-monthly
denali/database-url              # RDS connection string
denali/cognito-user-pool-id
denali/cognito-client-id
```

**Verification**: ECS task definition references secrets by ARN, not plaintext.

---

### Step 7: Docker + ECR
**Goal**: Containerize Next.js app for ECS

**Dockerfile**:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**next.config.ts** — add:
```typescript
output: 'standalone'
```

```bash
# Create ECR repository
aws ecr create-repository --repository-name denali-app --region us-east-1

# Build and push
aws ecr get-login-password | docker login --username AWS --password-stdin <ecr-uri>
docker build -t denali-app .
docker tag denali-app:latest <ecr-uri>/denali-app:latest
docker push <ecr-uri>/denali-app:latest
```

**Verification**: Image visible in ECR console, no vulnerabilities flagged.

---

### Step 8: ECS + Fargate
**Goal**: Run Next.js container with auto-scaling

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name denali-prod

# Create task definition (references ECR image + Secrets Manager ARNs)
# Create ECS service (1 task minimum, auto-scale to 3)
# Attach to ALB target group
```

**middleware.ts** — add one line:
```typescript
export const runtime = 'nodejs';  // Required for ECS (not Edge Runtime)
```

**Verification**:
- ECS service running 1 task
- Health check passes on `/api/health` (add this endpoint)
- App accessible via ALB DNS name

---

### Step 9: ALB + ACM SSL
**Goal**: HTTPS termination, routes traffic to ECS

```bash
# Request SSL certificate (free via ACM)
aws acm request-certificate \
  --domain-name denali.health \
  --subject-alternative-names "*.denali.health" \
  --validation-method DNS

# Create ALB
# Create listener: 443 → forward to ECS target group
# Create redirect: 80 → 443
```

**Verification**: `curl https://<alb-dns>` returns 200.

---

### Step 10: Route 53 DNS Cutover
**Goal**: Point denali.health from Vercel → ALB

```bash
# Create hosted zone
aws route53 create-hosted-zone --name denali.health --caller-reference $(date +%s)

# Create A record (alias to ALB)
# Update domain registrar nameservers to Route 53
```

**Zero-downtime approach**: TTL on current Vercel DNS records → 60 seconds before cutover. After ALB is verified → update nameservers → wait TTL → Vercel DNS decommissioned.

**Verification**: `dig denali.health` resolves to ALB IP. `https://denali.health` loads app.

---

### Step 11: GitHub Actions CI/CD
**Goal**: Git push → auto deploy to ECS (replaces Vercel)

```yaml
# .github/workflows/deploy.yml
name: Deploy to ECS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push to ECR
        # Build Docker image, push to ECR
      - name: Deploy to ECS
        # Update ECS service with new image
        run: aws ecs update-service --cluster denali-prod --service denali-app --force-new-deployment
```

**Verification**: Push a commit → GitHub Actions runs → ECS deploys new version → no downtime.

---

### Step 12: Code Migration — Auth Layer
**Goal**: Replace Supabase Auth with Cognito throughout codebase

**Files to change** (in order):
1. `src/lib/supabase.ts` → `src/lib/db.ts` (Drizzle client to RDS)
2. `src/lib/supabase-server.ts` → `src/lib/db-server.ts`
3. `src/lib/supabase-admin.ts` → `src/lib/db-admin.ts`
4. `src/middleware.ts` — replace Supabase session refresh with Cognito token validation
5. `src/hooks/useAuth.ts` — replace all Supabase auth calls with Cognito SDK
6. All `src/app/api/*/route.ts` files — replace `createServerSupabaseClient()` with new server client

**Key mappings**:
```typescript
// Supabase → Cognito equivalents
supabase.auth.sendOtp({ email })           → cognito.initiateAuth(EMAIL_OTP flow)
supabase.auth.verifyOtp({ token })         → cognito.respondToAuthChallenge()
supabase.auth.getSession()                 → cognito.getUser() / JWT validation
supabase.auth.signOut()                    → cognito.globalSignOut()
supabase.auth.mfa.enroll({ factorType })   → cognito.associateSoftwareToken()
supabase.auth.mfa.challengeAndVerify()     → cognito.verifySoftwareToken()
```

---

### Step 13: Code Migration — DB Layer
**Goal**: Replace Supabase PostgREST with Drizzle ORM → RDS

**Install**:
```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg
```

**Key mappings**:
```typescript
// Supabase SDK → Drizzle ORM
supabase.from("conversations").select("*").eq("user_id", id)
→ db.select().from(conversations).where(eq(conversations.userId, id))

supabase.from("conversations").insert({ ... })
→ db.insert(conversations).values({ ... })
```

**RLS**: PostgreSQL RLS policies migrate as-is to RDS — same syntax, same behavior.

---

### Step 14: Decommission Supabase + Vercel
**Goal**: Remove old services after verification

- [ ] Confirm all traffic on AWS for 48 hours
- [ ] Export final Supabase backup (schema + data) for records
- [ ] Cancel Supabase subscription
- [ ] Remove Vercel project (keep account for now)
- [ ] Revoke old API keys from env vars

---

## 6. Verification Checks

### Database
- [ ] All 27 tables present in RDS
- [ ] RLS policies active on all PHI tables
- [ ] 5 seed tables have correct row counts (carc=90, rarc=195, eob_mappings=1873, denial_patterns=12, appeal_levels=5)
- [ ] RPCs/functions all present and working
- [ ] Encryption at rest confirmed in RDS console

### Auth
- [ ] Email OTP: send → receive → verify → session created
- [ ] TOTP: enroll → verify code → MFA working
- [ ] Sign out: session invalidated
- [ ] Token refresh: automatic (middleware handles)
- [ ] Admin user: bypass rate limits confirmed

### AI (Bedrock)
- [ ] Chat message → Claude responds
- [ ] Health context injection works (with consent ON)
- [ ] Tool calling works (local tools)
- [ ] ICD-10 lookup tool works (converted from MCP)
- [ ] CMS coverage lookup tool works (converted from MCP)
- [ ] NPI lookup tool works (converted from MCP)
- [ ] Appeal letter generation works (Opus 4.6 on Bedrock)
- [ ] Streaming (SSE) works
- [ ] CloudWatch shows NO prompt/response logs (default: off)

### Hosting
- [ ] `https://denali.health` loads
- [ ] HTTPS certificate valid
- [ ] Health check endpoint `/api/health` returns 200
- [ ] GitHub Actions deploys on push to main
- [ ] ECS task shows healthy in ALB

### HIPAA
- [ ] CloudTrail logging enabled and recording
- [ ] RDS encryption at rest confirmed
- [ ] All secrets in Secrets Manager (no plaintext in task definition)
- [ ] No PHI in CloudWatch application logs
- [ ] Deletion cascade test: create test user → delete → confirm auth.users + all tables cleared

---

## 7. Legal Documents — Required Updates Before CMS Submission

All four docs must be updated BEFORE sending to CMS. Changes are vendor-driven by the AWS migration.

### faq/page.tsx — 1 change
**Current**: "Anthropic (AI responses), Stripe (payments), Supabase (database), and Vercel (hosting)"
**New**: "Amazon Web Services (AI, database, hosting, and authentication) and Stripe (payments)"

### terms/page.tsx — 1 change
**Current**: "The Service uses artificial intelligence (Claude by Anthropic)"
**New**: "The Service uses artificial intelligence (Claude via AWS Bedrock)"

### privacy/page.tsx — 5 changes
1. Supabase → AWS RDS (database hosting entry)
2. Vercel → AWS ECS + Fargate (hosting entry)
3. Certifications: "Anthropic SOC 2, Supabase SOC 2, Vercel SOC 2" → "AWS SOC 2 Type II, BAA active"
4. Anthropic subsection → AWS Bedrock subsection (**critical**: no 30-day retention → Bedrock retains nothing by default)
5. BAA status: "being established" → "AWS BAA active February 25, 2026"

### hipaa/page.tsx — 2 changes
1. Physical safeguards: "Supabase, Vercel" → "AWS (SOC 2 Type II, HIPAA compliant)"
2. Business Associates section: Replace entire Supabase/Vercel/Anthropic list with AWS + Stripe only; update BAA status to active

### Consistency checker
Run `npx tsx scripts/check-legal-docs.ts` after every change — all 28 checks must pass.

---

## 8. Rollback Plan

If migration causes issues, rollback is straightforward:

1. **DNS**: Repoint Route 53 to Vercel (60-second TTL cutover)
2. **Code**: Revert to previous `main` branch (Supabase SDK still installed until decommission)
3. **Data**: RDS has no user data (all mock) — no data migration risk
4. **Auth**: Users would need to re-authenticate on Vercel (Cognito sessions won't work with Supabase)

**Window**: Keep Supabase subscription active for 30 days post-migration as safety net.

---

## 9. Cost Summary (Post-Migration)

| Service | Monthly |
|---------|---------|
| RDS PostgreSQL db.t4g.micro | $15 |
| ECS + Fargate (1 task always-on) | $15 |
| ALB | $18 |
| Cognito (<10k MAUs) | $0 |
| Bedrock Claude (token usage) | ~$10-20 (usage-based) |
| Secrets Manager (~12 secrets) | $5 |
| Route 53 | $1 |
| CloudTrail | $2 |
| SES (email OTP) | $1 |
| **Total** | **~$67-77/month** |

vs $1,368/month current → **$1,291-1,301/month savings** → **~$15,500/year savings**

---

## 10. Open Items

| Item | Status | Action |
|------|--------|--------|
| AWS BAA | ✅ Active 2026-02-25 | Done |
| Anthropic BAA | Not needed | Using Bedrock (covered by AWS BAA) |
| Vercel BAA | Not needed | Migrating off Vercel |
| Supabase BAA | Not needed | Migrating off Supabase |
| CloudTrail | ⏳ Pending | Step 2 of migration |
| Legal docs update | ⏳ Pending | Before CMS submission |
| AWS CLI credentials | ⏳ Pending | User to share with Claude Code |
