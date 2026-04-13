# Operational Metrics — 2026-04-10

Post-hardening session metrics confirming system health.

## Test Results

| Suite                       | Result                | Details                                              |
| --------------------------- | --------------------- | ---------------------------------------------------- |
| Unit tests (Vitest)         | 575/575 passed (100%) | 25 test files, 5.4s                                  |
| E2E auth tests (Playwright) | 27/27 passed (100%)   | auth-api (15), auth-flows (5), spoofing-security (7) |

## CloudWatch Error Rate

| Metric                           | Before Session                                               | After Session                                                   |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| AppErrorCount (per 5-min window) | ~36 (pre-session baseline)                                   | 0-2 (post-session, measured over 30 minutes after final deploy) |
| Root cause of pre-session errors | `process.on("SIGTERM")` in Edge Runtime (instrumentation.ts) | Fixed in commit `e3bf340`                                       |

## ECS Deployment

| Attribute        | Value                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| Task definition  | denali:124                                                                     |
| Status           | ACTIVE, 1/1 running                                                            |
| Change           | Removed RESEND_API_KEY and RESEND_FROM_EMAIL secret references                 |
| Previous failure | Task def referenced deleted Secrets Manager keys (ResourceInitializationError) |

## Commits This Session

| SHA       | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `4237b8c` | Legal docs: Resend to SES reconciliation + checker fix + CLAUDE.md pricing  |
| `05ba516` | PWA hardening: cache clearing, queue auth, SW lifecycle, sync notifications |
| `636c473` | Build fix: missing config/messages.ts                                       |
| `293467b` | Build fix: missing clearAllCaches + metrics module + package deps           |
| `c955ee6` | Build fix: missing metrics module files                                     |
| `e3bf340` | Build fix: instrumentation.ts Edge Runtime guard                            |
| `d92fcb7` | HIPAA: strip PHI from logs, add audit entries, purge health_reports         |
| `6e93917` | Strip PHI from skill trigger logs                                           |
| `3307903` | audit_logs append-only hardening (baseline DDL, REVOKE, Update type)        |
| `abb3482` | FHIR audit log semantics: success vs failure, 5-min dedup                   |
| `2b7826a` | CMS compliance: Blue Button labeling, attribution, disconnect confirmation  |
| `a81cd0c` | Privacy policy readability improvements                                     |
