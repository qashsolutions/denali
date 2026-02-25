# Privacy Policy Code Deltas

Gaps between what the privacy policy states and what the code currently does.
Found during CMS production access form prep audit (2026-02-24).
All items below must be fixed before the public launch / live CMS review.

---

## Delta 1 — `health_data_storage` consent not enforced in caching

**Privacy policy claim (§4):**
> "Health Data Storage: Choose whether your Medicare data is cached for faster access."

**What the code does (`src/hooks/useHealthData.ts`):**
After a successful `/api/fhir/data` fetch, `cacheSet(STORES.HEALTH_DATA, "snapshot", {...})` is called unconditionally — no check against `health_data_storage` consent before writing to IndexedDB.

**Fix required:**
Before the `cacheSet()` call in `useHealthData.ts`, check `consent.health_data_storage`. Only write to IndexedDB if it is `true`.

```typescript
// Pattern to add:
if (consentData?.health_data_storage === true) {
  cacheSet(STORES.HEALTH_DATA, "snapshot", { ... });
}
```

**Severity:** High — direct privacy policy violation.

---

## Delta 2 — `analytics` consent not enforced in event tracking

**Privacy policy claim (§3 + §4):**
> "Analytics: Choose whether anonymized usage data helps us improve the service."

**What the code does (`src/lib/conversation-service.ts` → `trackEvent()`):**
`trackEvent()` calls the `track_user_event` RPC unconditionally — no consent check anywhere in the call chain. `useChat.ts` calls `trackEvent("appeal_completed")` and `trackEvent("outcome_reported")` without checking the analytics consent toggle.

**Fix required:**
Pass the user's analytics consent state into `trackEvent()` (or check it inside), and skip the RPC call if `analytics !== true`. Simplest pattern: add an optional `{ skipIfNoConsent: boolean }` guard, or check consent at call site in `useChat.ts`.

```typescript
// Pattern to add in trackEvent() or at each call site:
if (!analyticsConsent) return;
```

**Severity:** High — direct privacy policy violation.

---

## Delta 3 — `audit_logs` not deleted on account deletion

**Privacy policy claim (§7 Account Deletion):**
> "All audit log entries linked to your account" — listed as one of the items permanently deleted when an account is deleted.

**What the code does (`src/app/api/account/delete/route.ts`):**
The deletion cascade covers: `fhir_cache`, `ehr_connections`, `diabetes_snapshots`, `diabetes_log`, `diabetes_insights`, `chat_daily_usage`, `consent_preferences`, `messages`, `appeals`, `conversations`, `usage`, `subscriptions`, `user_events`, `user_verification`, and the `users` row. There is **no** `audit_logs` delete statement.

**Fix required:**
Add to the deletion cascade in `account/delete/route.ts`:
```typescript
await admin.from("audit_logs").delete().eq("user_id", userId);
```
Note: audit_logs are retained for HIPAA compliance (6 years minimum per §6). The policy lists them as deleted on account deletion — these two claims are in conflict. Resolution options:
- (a) Remove "audit log entries" from the §7 deletion list and explain in §6 that HIPAA requires 6-year retention even after account deletion, OR
- (b) Actually delete them in the cascade (weaker HIPAA posture)
**Recommended:** Option (a) — update §7 to exclude audit logs from the deletion list and clarify in §6 that HIPAA retention overrides.

**Severity:** Medium — policy conflict, not a data safety risk.

---

## Delta 4 — Inactive account 24-month deletion not implemented

**Privacy policy claim (§6 Data Retention):**
> "Inactive accounts: Accounts with no sign-in activity for 24 months will receive a 30-day email notice before data is archived. You can reactivate by signing in during the notice period."

**What the code does:**
No scheduled job, background worker, Supabase `pg_cron` task, or edge function exists that:
- Queries for accounts with no sign-in in 24 months
- Sends the 30-day notice email
- Archives or deletes the account after the notice period

**Fix required:**
Either implement via Supabase `pg_cron` (query `users` for `last_sign_in_at < NOW() - INTERVAL '24 months'`, trigger `send-checklist-email` edge function) or acknowledge this is a future process item and soften the privacy policy language from "will receive" to "may receive" until implemented.

**Severity:** Low for pre-launch, Medium post-launch — dormant accounts will accumulate.

---

## Non-Code Delta — Audit log retention vs. deletion conflict (see Delta 3)

The privacy policy makes two conflicting statements:
- §6: "Audit logs: Retained for compliance purposes (minimum 6 years per HIPAA requirements)"
- §7: "All audit log entries linked to your account" [are deleted on account deletion]

These cannot both be true. Recommended resolution: update §7 to note that audit logs are governed by §6's HIPAA retention requirement and are not deleted on account deletion.

---

*Last updated: 2026-02-24*
*Audited by: Claude Code during CMS production access form prep*
