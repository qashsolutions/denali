# Infrastructure

Full topic doc — extracted from CLAUDE.md during the 2026-05-13 doc refactor. Tool Integration section (formerly MCP) folded in as final subsection.

---

## Infrastructure Architecture

> Post-2026-04-23 hardening state. All items below are live ✓.
> See `docs/incidents/2026-04-23-ecr-eviction.md` (postmortem)
> and `docs/runbooks/ecr-eviction-recovery.md` (recovery + all
> verification commands) for rationale and deeper detail.

### AWS resources

**Prod**: cluster `denali` / service `denali-web` / ECR `denali` / RDS `denali-prod.ca5m0qc8e5h8.us-east-1.rds.amazonaws.com` / https://denali.health

**Staging**: cluster `denali-staging` / service `denali-staging-web` / ECR `denali-staging` (split from prod 2026-04-23) / RDS `denali-staging.ca5m0qc8e5h8.us-east-1.rds.amazonaws.com` / https://staging.denali.health

### ECR lifecycle (prod, 5 rules)

1. `prod-stable` tag — never expires (countNumber 9999)
2. Prod SHA tags (hex 0–7 prefix) — keep last 10
3. Prod SHA tags (hex 8–f prefix) — keep last 10
4. `staging-` prefix — keep last 5 (transitional)
5. Untagged — expire after 1 day

Staging repo: `staging-` keep last 10, untagged expire after 1 day.

### IAM (split 2026-04-23)

- `denali-prod-deploy-role` — trusts `refs/heads/main` only, scoped to prod ECR + ECS service
- `denali-staging-deploy-role` — trusts `refs/heads/develop` only, scoped to staging ECR + ECS service
- Legacy `denali-github-actions-role` disarmed (zero permissions); shell retained as rollback target. Policy archived at `docs/runbooks/rollback-artifacts/denali-deploy-policy.json`.

### Prod alarms → `denali-prod-alerts` SNS (admin@denali.health, ramanac@gmail.com)

- `denali-prod-ecs-running-below-desired` — running < desired for 2× 1-min periods (ECS/ContainerInsights)
- `denali-prod-alb-5xx-rate-high` — 5xx > 5% over 5 min, volume gate at 20 req/5min
- `denali-prod-ecs-task-failed-to-start` — EventBridge rule on TaskFailedToStart stopCode

### Protected tags + base image

- **`prod-stable`** is the absolute rollback floor — auto-retagged on every successful prod deploy after ECS stability wait. To roll back: register new task def with `<ECR>/denali:prod-stable`, update service. Commands in runbook.
- **Docker base image digest-pinned** (`node:20-alpine@sha256:fb4cd12c…`). Both staging and prod build against this digest. Updates require deliberate PR.
- **GitHub Actions SHA-pinned** in both deploy workflows. Action tag immutability is advisory; SHA-pinning prevents supply-chain risk.
---


## Tool Integration (formerly MCP)

MCP servers at `mcp.deepsense.ai` were fully replaced by local tool executors (2026-03-04). All tools now run server-side via `processToolCalls()` in the chat loop, calling public government APIs directly — no third-party intermediary receives patient data. `src/lib/claude.ts` calls `claude.messages.create({ tools })` with no `mcp_servers` parameter.

**Debug logs** (ECS CloudWatch): `[CLAUDE API] Using AWS Bedrock (IAM auth)` + `[CLAUDE API] >>> LOCAL TOOL CALLED: <name>`.
---

