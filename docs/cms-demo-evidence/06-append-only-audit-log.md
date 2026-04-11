# Append-Only Audit Log Enforcement

**Date:** 2026-04-10
**HIPAA reference:** Section 164.312(b) — Audit Controls
**Retention requirement:** 6 years minimum

## Three-Layer Enforcement Model

### Layer 1: Application Code

`app/src/lib/audit.ts` contains the sole interface to `audit_logs`. It executes only `INSERT` and `SELECT` queries. No `UPDATE` or `DELETE` query exists anywhere in the application codebase.

The account deletion cascade (`app/src/app/api/account/delete/route.ts`) explicitly excludes `audit_logs` from the 11-table deletion sequence. Audit rows survive account deletion.

**Status:** Enforced in production.

### Layer 2: TypeScript Type System

`app/src/types/database.ts` defines the `audit_logs` table types. The `Update` type is set to `Record<string, never>`, which makes any attempt to construct an UPDATE payload a compile-time error.

```typescript
// No Update type — audit_logs is append-only
// (enforced by REVOKE at the database layer, see scripts/migrate-audit-logs-baseline.sql)
Update: Record<string, never>;
```

**Status:** Enforced in production (commit `3307903`).

### Layer 3: Database Permissions

`scripts/migrate-audit-logs-baseline.sql` contains:

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM denali_admin;
GRANT INSERT, SELECT ON audit_logs TO denali_admin;
```

This restricts the application database user (`denali_admin`) to INSERT and SELECT only. Only a DBA with superuser privileges can modify audit rows.

**Status:** Applied to production on 2026-04-10. Verified via `information_schema.role_table_grants` — UPDATE, DELETE, TRUNCATE confirmed revoked for `denali_admin`.

## Foreign Key Behavior

```
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
```

When a user is deleted, their audit log rows are preserved with `user_id` set to NULL. No audit data is lost on account deletion.

**Verified:** Production query on 2026-04-10 confirmed `ON DELETE SET NULL` (not CASCADE).

## Production Baseline

- 100 audit log rows as of 2026-04-10
- 6 distinct users
- Oldest entry: 2026-02-27
- Newest entry: 2026-03-25
- No evidence of cascade-deleted rows

## References

- Baseline migration: `scripts/migrate-audit-logs-baseline.sql` (commit `3307903`)
- Audit utility: `app/src/lib/audit.ts`
- Account deletion: `app/src/app/api/account/delete/route.ts`
- Type definition: `app/src/types/database.ts`
