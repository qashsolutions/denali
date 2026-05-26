# Staging Terraform

Infrastructure-as-code for the `staging.denali.health` environment.

## Purpose

Captures staging-only AWS resources in Terraform so they can be reviewed,
diffed, and reproduced. Prod resources remain managed out-of-band; shared
resources (the ALB, listener, security group, hosted zone, ECS task roles)
are referenced as data sources only — never managed from this stack.

## Layout

```
infra/staging/
├── versions.tf     # Terraform + provider version pins
├── providers.tf    # AWS provider config (region + default tags)
├── backend.tf      # Remote state in S3 with S3-native locking
├── variables.tf    # Input variables (region, environment)
├── locals.tf       # Common tags applied to every resource
├── outputs.tf      # Outputs (added as resources land)
└── README.md       # This file
```

## Backend

Remote state in a versioned, server-side-encrypted S3 bucket with
S3-native locking (`use_lockfile = true`). The bucket is pre-provisioned
and shared by future stacks (each stack gets its own state key).

See `backend.tf` for the exact bucket name and state key.

## Commands

```bash
cd infra/staging

terraform fmt -check -recursive      # CI-style format check
terraform init                       # Download providers, configure backend
terraform validate                   # Syntax + provider schema check
terraform plan                       # Show diff vs current AWS state
terraform apply                      # Apply diff (require explicit approval)
```

## Currently managed resources

None. This stack is the foundation only — resources will be imported
in subsequent sessions following the inventory in
[`STAGING-LOCKDOWN.md`](../../STAGING-LOCKDOWN.md) and the read-only
inventory captured before this scaffold landed.

## Conventions

- All resources receive the tags in `locals.common_tags` automatically
  via the provider's `default_tags` block.
- Shared-with-prod resources (ALB, listener, hosted zone, task roles)
  are referenced via `data` sources, never imported as managed.
- Image tags inside ECS task definitions rotate every deploy — when
  the task definition is imported, expect `lifecycle { ignore_changes
  = [container_definitions] }` to suppress phantom drift.
