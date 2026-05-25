# CMS Blue Button Production Access — Readiness Checklist

Last updated: 2026-02-11

> **Update — May 24, 2026:** Vercel and Supabase are no longer in use. All infrastructure (staging and production) now runs on AWS exclusively (ECS Fargate, RDS Postgres, Cognito, Bedrock, SES; AWS BAA executed 2026-02-25). Row-Level Security has been replaced by explicit `WHERE user_id = $1` clauses in application code. Strikethroughs below preserve the original text as historical record.

## Engineering Readiness

| CMS Requirement | Status | Evidence |
|---|---|---|
| Privacy Policy (all 8 checklist items) | Done | `/privacy` — 16 sections, sharing scope, breach notification, dormant accounts, vendor commitments |
| Terms of Service (active opt-in, no contradictions) | Done | `/terms` — S2 "Acceptance of Terms" with affirmative OTP-based consent |
| "Medicare" not "Blue Button" in all user text | Done | Zero user-visible "Blue Button" strings (grep verified 2026-02-11) |
| OAuth PKCE flow (authorize → CMS → callback) | Done | `/api/fhir/authorize` + `/api/fhir/callback` — RFC 7636 S256, state cookie, token encryption |
| Data display (coverage, claims, conditions, meds) | Done | `/app/health` — 6 accordion cards: coverage, claims, conditions, medications, providers, hospitalizations |
| User consent controls (3 toggles, all enforced) | Done | Settings > Privacy & Data — health_data_ai, health_data_storage, analytics. Enforced in chat + FHIR |
| Medicare disconnect (revoke at any time) | Done | `/api/fhir/disconnect` — deletes tokens, cache, diabetes data. Audit logged |
| Account deletion (15-step cascade) | Done | `/api/account/delete` — GDPR/CCPA compliant, cancels Stripe, cascade deletes all user data |
| AI disclaimer on every response | Done | SparkleIcon + "AI-generated · Not medical advice" on every chat message + health page |
| Audit logging (6 action types + user viewer) | Done | `lib/audit.ts` — FHIR connect/disconnect/access, appeal, consent, account delete. User viewer in Settings |
| Breach notification (FTC rule cited) | Done | Privacy S10 — FTC 16 CFR 318 + HITECH, 60-day notification, HHS/FTC reporting |
| Incident response plan (NIST 800-61) | Done | HIPAA page — 5 phases: detection, containment, investigation, notification, post-incident review |

## Non-Code Items for Submission

| Item | Status | Notes |
|---|---|---|
| PDF of Privacy Policy | TODO | Print `/privacy` to PDF |
| PDF of Terms of Service | TODO | Print `/terms` to PDF |
| ~~BAA with Supabase~~ Closed | ~~TODO~~ Done | ~~Business Associate Agreement~~ Subsumed by AWS BAA (executed 2026-02-25); Supabase removed |
| ~~BAA with Vercel~~ Closed | ~~TODO~~ Done | ~~Business Associate Agreement~~ Subsumed by AWS BAA (executed 2026-02-25); Vercel removed |
| BAA with Anthropic | TODO | Business Associate Agreement |
| Production access form | TODO | Org name, app name, redirect URI, point of contact |
| CMS app directory listing | TODO | Screenshots, descriptions for Medicare.gov |

## Demo Flow (1-hour Zoom)

1. Account creation (email OTP → auto-trial)
2. Medicare OAuth (PKCE authorize → CMS login → callback → health page)
3. Health data display (coverage, claims, conditions, medications, screenings, providers)
4. Chat with health context (AI references user's Medicare data)
5. Consent toggles (toggle health_data_ai off → AI no longer references health data)
6. Appeal generation (denial code → appeal letter → paywall)
7. AI disclaimer visibility (SparkleIcon on every response)
8. Activity log (Settings > Activity Log)
9. Medicare disconnect (revoke connection, data deleted)
10. Account deletion (Settings > Danger Zone → cascade delete)
