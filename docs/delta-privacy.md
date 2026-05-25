# Privacy Policy Code Deltas

Gaps between what the privacy policy states and what the code currently does.
Found during CMS production access form prep audit (2026-02-24).

**Status as of 2026-02-24: All 4 deltas resolved.**

> **Update — May 24, 2026:** Vercel and Supabase are no longer in use. All infrastructure (staging and production) now runs on AWS exclusively (ECS Fargate, RDS Postgres, Cognito, Bedrock, SES; AWS BAA executed 2026-02-25). Row-Level Security has been replaced by explicit `WHERE user_id = $1` clauses in application code. Strikethroughs below preserve the original text as historical record.

---

## Delta 1 — `health_data_storage` consent not enforced in caching ✅ FIXED

**Privacy policy claim (§4):**
> "Health Data Storage: Choose whether your Medicare data is cached for faster access."

**What the code did (`src/hooks/useHealthData.ts`):**
After a successful `/api/fhir/data` fetch, `cacheSet(STORES.HEALTH_DATA, "snapshot", {...})` was called unconditionally — no check against `health_data_storage` consent before writing to IndexedDB.

**Fix applied:**
Added `useConsent()` hook to `useHealthData.ts`. Consent value stored in a `useRef` (so `fetchData`'s stable `useCallback` dep array is not disturbed). `cacheSet()` is now gated:

```typescript
if (healthDataStorageRef.current === true) {
  cacheSet(STORES.HEALTH_DATA, "snapshot", { ... });
}
```

**Severity:** High — direct privacy policy violation.

---

## Delta 2 — `analytics` consent not enforced in event tracking ✅ FIXED

**Privacy policy claim (§3 + §4):**
> "Analytics: Choose whether anonymized usage data helps us improve the service."

**What the code did (`src/lib/conversation-service.ts` → `trackEvent()`):**
`trackEvent()` called the `track_user_event` RPC unconditionally — no consent check anywhere in the call chain.

**Fix applied:**
Added `analyticsConsent?: boolean` parameter to `trackEvent()` options. Check added after event type validation:

```typescript
// Respect analytics consent — only track if user has explicitly opted in
if (options.analyticsConsent !== true) return;
```

In `useChat.ts`: imported `useConsent`, added `const { consent } = useConsent()`, and passed `analyticsConsent: consent.analytics` to all 3 `trackEvent` call sites (`appeal_completed`, `feedback_positive`/`feedback_negative`, `outcome_reported`).

**Severity:** High — direct privacy policy violation.

---

## Delta 3 — `audit_logs` not deleted on account deletion ✅ RESOLVED (policy fix)

**Privacy policy claim conflict:**
- §6: "Audit logs: Retained for compliance purposes (minimum 6 years per HIPAA requirements)"
- §7: "All audit log entries linked to your account" [were listed as deleted on account deletion]

**Resolution:**
Updated privacy policy `src/app/privacy/page.tsx`:
- Removed "All audit log entries linked to your account" from §7 deletion list
- Added note to §7 afterItems: "Note: audit logs are subject to a minimum 6-year HIPAA retention requirement that applies even after account deletion."
- Updated §6 audit log item to clarify HIPAA retention supersedes account deletion

**No code change needed** — the account deletion cascade correctly does NOT delete audit logs (the policy was wrong, not the code).

**Severity:** Medium — policy conflict resolved.

---

## Delta 4 — Inactive account 24-month deletion not implemented ✅ RESOLVED (policy fix)

**Privacy policy claim (§6 Data Retention):**
Previously stated: "Accounts with no sign-in activity for 24 months **will receive** a 30-day email notice before data is archived."

**What the code does:**
No scheduled job, background worker, ~~Supabase `pg_cron` task, or edge function~~ AWS EventBridge rule + Lambda exists to implement this.

**Resolution:**
Softened policy language from "will receive" to "may receive" pending full implementation:
> "Accounts with no sign-in activity for 24 months **may receive** a 30-day email notice before data is archived."

**Future implementation** (post-launch): ~~Supabase `pg_cron` job querying `users` for `last_sign_in_at < NOW() - INTERVAL '24 months'` → trigger `send-checklist-email` edge function.~~ AWS EventBridge scheduled rule → Lambda querying RDS `users` for `last_sign_in_at < NOW() - INTERVAL '24 months'` → SES email send.

**Severity:** Low pre-launch, Medium post-launch.

---

*Last updated: 2026-02-24*
*All 4 deltas resolved during CMS production access form prep*
