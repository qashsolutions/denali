# Audit Log Integrity Verification

**Date:** 2026-04-10
**Source:** Production RDS (`denali-prod`, us-east-1) via ECS exec read-only query

## Schema

| Column        | Type        | Nullable | Default           |
| ------------- | ----------- | -------- | ----------------- |
| id            | uuid        | NO       | gen_random_uuid() |
| user_id       | uuid        | YES      | null              |
| action        | text        | NO       | null              |
| resource_type | text        | YES      | null              |
| resource_id   | text        | YES      | null              |
| metadata      | jsonb       | YES      | '{}'::jsonb       |
| ip_address    | text        | YES      | null              |
| user_agent    | text        | YES      | null              |
| created_at    | timestamptz | YES      | now()             |

## Foreign Key

```
constraint: audit_logs_user_id_fkey
definition: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
```

When a user deletes their account, their audit log rows are preserved with `user_id` set to `NULL`. The 6-year HIPAA retention guarantee holds. Rows are never cascade-deleted.

## Indexes

| Index                 | Definition                       |
| --------------------- | -------------------------------- |
| audit_logs_pkey       | UNIQUE btree (id)                |
| idx_audit_logs_user   | btree (user_id, created_at DESC) |
| idx_audit_logs_action | btree (action, created_at DESC)  |

## Row Statistics

| Metric         | Value      |
| -------------- | ---------- |
| Total rows     | 100        |
| Distinct users | 6          |
| Oldest entry   | 2026-02-27 |
| Newest entry   | 2026-03-25 |

## Baseline Migration

The full production schema is documented in version control at `scripts/migrate-audit-logs-baseline.sql` (commit `3307903`). This file is idempotent (`CREATE TABLE IF NOT EXISTS`) and includes `REVOKE UPDATE, DELETE, TRUNCATE` statements for database-layer append-only enforcement.
