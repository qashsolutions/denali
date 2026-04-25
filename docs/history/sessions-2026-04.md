# Session History — April 2026

This file archives session summaries that were originally in
CLAUDE.md. They document the development trajectory through
mid-April 2026 (demo prep, fixes, framework integrations).

The fixes referenced here are reflected in code/git history;
this file preserves the narrative context.

For more recent infrastructure work see:
- `docs/incidents/2026-04-23-ecr-eviction.md` (prod outage postmortem)
- `docs/runbooks/ecr-eviction-recovery.md` (recovery procedure)

---

## Session Summary — 2026-04-12

CMS Blue Button production access demo prep. All findings from prior hardening sessions verified. Additional compliance fixes:

- Privacy policy readability improved: prose sections grade 9-13 (from grade 13-18). Aggregate 15.4 due to bullet-list tool inflation.
- CMS attribution notice: exact verbatim text now in 6 locations (Terms §14, site footer, ConnectMedicare, CmsPledge, ReportView, health page)
- "Blue Button" removed from all user-facing strings (email footer, PDF footer, AI system prompt). Only remains in CMS-mandated attribution text and code comments.
- Disconnect confirmation dialog added (matches account deletion pattern)
- REVOKE UPDATE/DELETE/TRUNCATE on audit_logs applied to production (2026-04-10). All 3 append-only layers live.

Current status:

- Legal cross-audit: 29/29
- Unit tests: 575/575
- CloudWatch errors: 0/5min
- ECS: denali:124 running
- CMS evidence PDFs: 7 files in docs/cms-demo-evidence/

Commits this session: `a81cd0c` (readability), `2b7826a` (CMS compliance fixes)

Open items:

- UI-2 (signup checkbox): deferred — OTP is affirmative action, defensible per Terms §2. Add checkbox post-demo if CMS requests.
- Privacy policy aggregate readability score (15.4): inflated by bullet-list sections. Prose sections are grade 9-13. Prepared answer for CMS if asked.
- REVOKE/GRANT migration not yet run via migration script — applied manually on 2026-04-10, migration file committed for future environments.

## Session Summary — 2026-04-13

CMS Blue Button production demo rehearsal + P0 bug fixes.

### P0 Bugs Found & Fixed

1. **Chat rate limiter blocking all non-admin users** (commit `077f1e8` + SQL)
   - Root cause: `check_and_increment_chat` SQL returned jsonb, TypeScript read flat row. `row.allowed` was always `undefined` → every non-admin rate-limited on every message.
   - Fix: SQL `RETURNS jsonb` → `RETURNS TABLE (allowed boolean, count integer)`. Applied to production RDS. Error messages now distinguish weekly day limit from daily message limit.

2. **Account deletion "Invalid or expired session"** (commit `4f2b7bf`)
   - Root cause: `settings/page.tsx` sent `Authorization: "Bearer session"` (hardcoded literal) instead of using httpOnly cookie.
   - Fix: Removed fake header. Cookie sent automatically.

3. **Account deletion cascade failure + data corruption** (commit `1085008`)
   - Root cause: `DELETE FROM user_events WHERE user_id` — but `user_events` has no `user_id` column. Cascade was NOT transactional — partial deletion committed (conversations, messages, subscriptions deleted but user record survived).
   - Fix: Transaction wrapper using existing `transaction()` helper. `user_events` delete changed to `conversation_id` subquery. Stripe cancel moved outside transaction.
   - Orphan user (`ceeveear@yahoo.com`) cleaned up manually.

4. **Disconnect confirmation on wrong component** (commit `e661b79`)
   - Root cause: `ConnectionStatus.tsx` had the dialog but wasn't used on `/app/health`. `AccountSection.tsx` was the actual component.
   - Fix: Added confirmation dialog to `AccountSection.tsx`.

### CMS Compliance Fixes
- Appeal letter: CMS attribution added to `AppealLetterModal` (2 locations) and appeal PDF page 2 (commit `eb4f5f6`)
- Appeal outcome: email → userId in CloudWatch log
- Error log sanitization: `route.ts:692` and `conversation-server.ts:104` log `err.message` only

### Demo Walkthrough Results (all verified in production browser)
- Landing page, signup, Terms/Privacy links
- Connect Medicare (sandbox), consent screen
- Health data display, consent toggles (3, all OFF default)
- AI chat with Medicare data (personalized diabetes response)
- Appeal letter generation (paywall working, tool chain verified)
- Disconnect confirmation dialog + clean post-disconnect state
- Account deletion confirmation + redirect + data verification

### Current Status
- Legal cross-audit: 29/29
- Unit tests: 575/575
- CloudWatch errors: 0/5min
- CMS attribution: 9 locations with verbatim text
- Account deletion: transactional, verified zero rows post-deletion
- Audit logs: survive deletion with `user_id = NULL` (HIPAA 6yr)

### Open Items
- Post-demo: hashed email approach for preventing trial abuse
- Cognito orphan cleanup for deleted test users

### Evening Session — Appeal Letter + Final Fixes

- Full appeal letter verified with admin account (ramanac@gmail.com): Opus 4.6 tool chain (denial lookup → ICD-10 → CPT → PubMed → NPI → coverage policy → letter generation) working end-to-end
- Provider NPI verification: Dr. Daniel Christopher Allison, MD, Orthopaedic Surgery, 444 S San Vicente Blvd, Los Angeles — confirmed via NPI Registry, "Accepts Medicare" badge in chat
- Appeal letter modal: Copy, Download PDF, Print, Close all functional
- Letter includes: Medical Necessity section, 3 PubMed citations, Medicare Coverage Criteria, blank lines for MBI/claim/DOS, AI disclaimer
- Letter correctly pulled Blue Button data: "Patient has Type 2 diabetes mellitus without complications (existing condition per Medicare records)"
- Modal CSS fix: sticky header so buttons always visible (commits `38ea83e`, `4f93175`, `5dc69ef`)
- Active opt-in checkbox added to signup flow: unchecked by default, Send Code disabled until checked, linked Terms + Privacy Policy (commit `e8134dc` — UI-2 closed)

### Final Demo-Ready Status

All 12 demo segments verified in production browser:
1. Landing page
2. Signup with opt-in checkbox
3. Connect Medicare + consent screen
4. Health data display
5. Consent toggles (3, all OFF default)
6. AI chat with Medicare data
7. Appeal letter + modal + PDF
8. Disconnect with confirmation
9. Account deletion with confirmation
10. CMS attribution (9 locations)
11. Privacy policy readability (prose grade 9-13)
12. Active opt-in checkbox

CMS Production Access Checklist: 100% — all requirements MET, zero deferrals.

Commits today: `077f1e8`, `4f2b7bf`, `1085008`, `e661b79`, `eb4f5f6`, `2b7826a`, `a81cd0c`, `8556cac`, `e8134dc`, `38ea83e`, `4f93175`, `5dc69ef`, `762d77a`

Demo materials: `docs/cms-demo-evidence/08-cms-demo-qa.pdf` (22 Q&As)

## Session Summary — 2026-04-15/16 (Pre-Demo Final Prep)

- Alert preferences default changed from opt-out to opt-in (engine.ts, preferences/route.ts, useAlertPreferences.ts) — commit `1e33970`
- Outcome followup emails now gated behind hasAnyAlertEnabled check
- Typecheck hook patched for macOS (missing timeout binary fallback)
- CMS demo Q&A PDF updated to v3: 25 Q&As across 4 sections, aligned to exact CMS email checklist (20 items + 5 additional)
- Email alerts UI verified across 3 tiers: admin (Unlimited badges), trial (Plus badges + upgrade CTA), Plus (interactive toggles)
- Token refresh behavior documented: silent refresh within 13-month window, graceful degradation to connect flow after expiry
- Stripe test mode: admin@myguide.health upgraded to Plus ($20) for demo purposes
- Active opt-in checkbox re-verified in production
- All 3 consent toggles (Privacy & Data) verified OFF by default

Demo accounts prepared:
- Admin account (Unlimited) — health data, appeals, full access
- Plus account ($20/month) — email alert toggles visible

Final checklist: 20/20 CMS items verified, 25 Q&As prepared, Q&A PDF at `docs/cms-demo-evidence/08-cms-demo-qa.pdf`

Commits this session: `1e33970` (alert opt-in), `c3d0b26` (Q&A restructure), `d310232` (arrow rendering fix), `8a67393` (5 additional Q&As), `0dd6eb8` (Section 1 Item 8 + demo opt-out Q&A), `d2ec188` (token refresh in Section 2 Item 7)

