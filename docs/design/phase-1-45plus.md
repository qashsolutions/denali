# Denali — Phase 1 Build Prompt v2 (local-first mobile, reconciled to actual codebase)

You are building **Phase 1** of the Denali mobile app: a privacy-first, **local-first** native app for the 45+ U.S. audience that integrates with Denali's existing Next.js/ECS/Cognito/RDS/Bedrock backend. This prompt is reconciled against the real codebase — match existing patterns, do not invent parallels.

The device is the system of record. Health data is encrypted on-device. Analysis is transient (no server-side persistence of health data). The longitudinal prediction model and cloud backup are **out of scope** for Phase 1, but the local data must be stored in longitudinal-ready (append-only time-series) form from day one.

Repo context you can rely on: single repo, Next.js 16 App Router under `app/`, raw SQL + `pg` (no ORM), 56 API routes under `app/src/app/api/`, Cognito auth via `app/src/lib/auth-server.ts`, Bedrock via `app/src/lib/claude.ts`, model routing in `app/src/app/api/chat/route.ts`. Read `CLAUDE.md` and `docs/reference/` before building.

---

## Goals & objectives (why this build exists)

Denali's existing product serves the 65+ Medicare cohort via Blue Button. This build extends it to the **45+ non-Medicare** audience as a privacy-first, longitudinal personal health app. Use this intent to guide judgment calls the spec doesn't cover:

- **Privacy is the trust mechanism, not a feature.** Users will only build a multi-year health record if they trust where it lives. Local-first storage and transient, non-retained analysis *are* the core promise. When a choice trades privacy for convenience, default to privacy and flag the trade-off rather than silently taking it.
- **Phase 1 earns trust and lays the longitudinal substrate.** The user signs up, completes an intake, uploads reports, and accumulates their own data on-device, getting analysis without their data being retained. The long-term prediction model and cloud backup arrive in Phase 2 as an explicit opt-in once trust is established. Phase 1's job is therefore a clean, private, longitudinal-ready foundation — not the prediction itself.
- **The longitudinal model is the user's own.** The future 0–6 month foresight is a personal model built from the individual's data, not a population cohort. Build for per-user longitudinal value.
- **Consumer-facing, US-first.** Plain-language UX for a non-clinical 45+ audience; clinical accuracy underneath, accessible presentation on top.

Phase 1 success: a user can privately build and view their own longitudinal health record on-device, receive transient analysis with nothing retained server-side, and trust the app enough to later opt into the long-term model.

---

## Decisions baked in (flip any of these before running)

- **Mobile framework:** React Native + Expo, TypeScript. Native is required — the existing PWA cannot hold a device-bound encryption key, which the privacy model depends on. (Reinforced by the existing React 19 + TS stack.)
- **Auth:** reuse the existing **email-OTP** flow, not Cognito hosted UI / PKCE. Mobile calls `/api/auth/send-otp` then `/api/auth/verify-otp`; the backend is extended to return Cognito JWTs in the JSON body for mobile clients (see Auth section). *(Alternative: second Cognito app client + hosted UI/PKCE — splits the auth UX, not chosen.)*
- **Chat:** local-first, **no server-side persistence** — messages stored on-device, each turn sent transiently for inference, nothing written to `conversations`/`messages`. Requires a no-persist mode on `/api/chat` for mobile. *(Alternative: use `/api/chat` as-is with server-side history — weaker privacy claim.)*
- **Upload + parse:** in scope, net-new. On-device encrypted file storage + on-device text/OCR + a transient parse endpoint. No S3.
- **Local data model:** generalize the existing `diabetes_snapshots` / `user_conditions` patterns into the device-local store; align column semantics and the `source` enum. Do not build a parallel model. (Server-side generalization is a separate, later decision.)

---

## Non-negotiable invariants

1. **Local-first.** No health data persisted server-side in Phase 1. This includes chat (see Decisions). The device holds the canonical record.
2. **Encrypted at rest.** All health data in an encrypted SQLCipher DB; uploaded files stored as encrypted on-device blobs.
3. **Login ≠ encryption key.** Cognito JWTs (via `Authorization: Bearer`) grant identity/session only. The DB encryption key is generated on-device, stored in Keychain/Keystore, never transmitted, and never derived from any Cognito/server secret.
4. **Append-only time-series**, aligned to the existing snapshots pattern: `UNIQUE(user_id, code, effective_at)` with `ON CONFLICT DO NOTHING`; corrections add a superseding row, never UPDATE/DELETE values.
5. **Transient analysis only.** Decrypt relevant data on-device → send over TLS → Bedrock → return result → store on-device. Nothing persisted server-side. (Confirm AWS Bedrock model-invocation logging is OFF — Gap #3 in discovery; `aws bedrock get-model-invocation-logging-configuration`.)
6. **No longitudinal model and no cloud backup in Phase 1.**

---

## Design principles & UI (follow the existing system)

The mobile app must follow Denali's existing design language and standards — not invent its own look. Sources of truth in the repo:
- `docs/design/denali-design-v1.1.md` — the stated design source of truth.
- Design tokens in `app/src/app/globals.css` — CSS variables (`--bg-primary`, `--text-primary`, `--accent-primary`, `--font-sans`, the Tailwind v4 `@theme` color set).
- `docs/reference/ui.md`, `docs/reference/coding-standards.md`, and `COMPONENT_ARCHITECTURE.md`.
- The existing component library under `app/src/components/` (auth, dashboard, health, layout, payment, profile, ui, …) as the pattern reference.

**Web→native bridge (important):** the web system is CSS variables + Tailwind v4, which React Native cannot consume directly. Therefore:
- **Port the token *values*, not the CSS.** Extract the color, typography, and spacing values from `globals.css` into one shared, typed RN theme source so the mobile palette and type scale match the web exactly and stay in sync. Single token source of truth, mirrored from `globals.css`.
- If you want Tailwind-style authoring parity on RN, use **NativeWind** seeded from those same token values; otherwise a typed `StyleSheet` theme is fine. Either way, one token source matching the web.
- **Re-implement components natively** to match the visual language and patterns in `denali-design-v1.1.md` and the existing component library — same hierarchy, spacing, and accent usage, expressed in native widgets.
- Follow `coding-standards.md` conventions (TS strict, `@/*` path alias, the hooks + `fetch` data pattern adapted to mobile with Bearer auth).

Net: identical design language and tokens to the web, re-expressed in native primitives — not a visual fork, and not a literal CSS port.

---

## Preconditions — confirm before relying on this build (AWS CLI / console)

Run these first. If AWS access isn't available in this environment, surface them as required manual checks rather than skipping them.

- **Bedrock model-invocation logging is OFF** — otherwise the transient-analysis privacy promise has a hole: `aws bedrock get-model-invocation-logging-configuration --region us-east-1`. If it is on and sinking prompts/completions to S3/CloudWatch, disable it or the "nothing is retained" claim is false. (Discovery Gap #3.)
- **Cognito refresh-token validity matches the 30-day cookie** the app sets: `aws cognito-idp describe-user-pool-client --user-pool-id <POOL_ID> --client-id <CLIENT_ID> --query 'UserPoolClient.RefreshTokenValidity'`. If Cognito's `RefreshTokenValidity` is shorter than 30 days, both mobile and web sessions die before the cookie expires and silent refresh fails. Align them. (Discovery Gap #11.)

---

## Auth (reconciled to actual flow)

The web app authenticates via a custom email-OTP layer over Cognito Admin APIs (`app/src/lib/auth-server.ts`), issuing Cognito JWTs into httpOnly cookies. Mobile reuses this flow but must receive tokens in the response body.

**Backend change (small, web-safe):** in `/api/auth/verify-otp` and `/api/auth/refresh`, when the request carries `X-Client-Type: mobile`, return `{ access_token, refresh_token, expires_in }` in the JSON body **in addition to / instead of** the `Set-Cookie` headers. Web behavior (cookies) must be unchanged when the header is absent.

**Mobile auth flow:**
- Sign-in: `POST /api/auth/send-otp { email }` → user enters the 6-digit code → `POST /api/auth/verify-otp { email, code }` with `X-Client-Type: mobile` → receive tokens → store `access_token` + `refresh_token` in `expo-secure-store`.
- All API calls send `Authorization: Bearer <access_token>` (the API already prefers the header over the cookie — `auth-server.ts:58-61`).
- Silent refresh: on 401, `POST /api/auth/refresh` with `X-Client-Type: mobile` and the refresh token → update stored tokens.
- Respect the existing **7-day hard session cap** (`session_issued_at`, NIST 800-63B) and 30-day refresh window — after the cap, re-run the OTP sign-in. *(Decision flag: this means weekly re-OTP on mobile; confirm acceptable for the 45+ audience or extend for mobile.)*
- **No TOTP** in the consumer mobile app — TOTP is admin-only; email OTP is the auth-and-MFA step for normal users.

Identity: `users.id` = Cognito `sub`. Use `GET /api/profile` to bootstrap profile, cohort fields, and plan on launch.

---

## Cohort capture (already exists — replicate, don't reinvent)

These fields gate features via middleware cookies (`medicare_status`, `sex_at_birth_status`). Mobile must capture them and keep them in sync via `GET/PATCH /api/profile`:
- `birth_year` (INTEGER)
- `is_on_medicare` (BOOLEAN NULL; null = not asked, true = Medicare, false = non-Medicare). **Target audience for this build is the null/false path (45+ non-Medicare).**
- `sex_at_birth` (TEXT; USCDI value set `male|female|intersex|unknown`; existing v1 picker presents 3 options, omitting intersex)
- `gender_identity` (TEXT, optional, USCDI value set)

Replicate the existing onboarding interstitials (Medicare question, then the 3-question demographics step). The Blue Button / FHIR / Medicare data path is the existing **65+** cohort and is **out of scope** here — 45+ analysis runs on the local observation store, not `fhir_cache`.

---

## Local data model (SQLCipher; generalize the existing pattern)

Mirror the proven `diabetes_snapshots` semantics, generalized to all observation types.

**`profile`** — local mirror of the authenticated user: `id` (Cognito sub), `email`, `plan`, `birth_year`, `is_on_medicare`, `sex_at_birth`, `gender_identity`, `created_at`, `updated_at`.

**`observations`** — append-only time series (generalizes `diabetes_snapshots`):
- `id` TEXT PK
- `category` TEXT — `anthropometric|vital|biomarker|symptom|questionnaire|screening|lifestyle|family_history|condition`
- `code_system` TEXT — `LOINC|SNOMED|ICD10|internal` (use **LOINC** for labs from day one — matches `diabetes_snapshots.loinc_code`, e.g. HbA1c `4548-4`/`59261-8`)
- `code` TEXT, `display` TEXT
- `value_num` REAL (nullable), `value_text` TEXT (nullable), `unit` TEXT (canonical, always stored)
- `source` TEXT — `fhir|log|self_reported|uploaded_report|derived` (extends the existing `fhir|log|self_reported` enum)
- `effective_at` TEXT (ISO8601; equals `observed_date` semantics), `recorded_at` TEXT (ISO8601)
- `report_id` TEXT (nullable), `supersedes_id` TEXT (nullable), `metadata_json` TEXT
- Constraint: `UNIQUE(user_id, code, effective_at) ON CONFLICT DO NOTHING` (append-only, matching existing).

**`conditions`** — local mirror of `user_conditions`: `condition_code`, `condition_category` (CHECK: `prediabetes|type1|type2|obesity|hypertension|dyslipidemia|ckd|cvd|depression`), `source` (`claims|self_reported|ehr|uploaded_report`), `started_at`, `ended_at`, `confidence`.

**`reports`** — `id`, `type` (`lab|ehr|visit`), `file_blob_ref` (encrypted on-device blob), `original_filename`, `uploaded_at`, `parsed_at`, `parse_status`, `summary_text`.

**`analyses`** — `id`, `requested_at`, `input_observation_ids_json`, `model_used`, `result_text`, `result_structured_json`.

**`chat_messages`** (local-first chat) — `id`, `role`, `content`, `created_at`, plus any local session grouping. Stored on-device only.

---

## Onboarding content

1. **Cohort capture** (above) — required, gates features.
2. **Reason for visit / symptoms** — structured chief complaint + symptom observations (onset, duration, severity).
3. **Medical history, family history (with age of onset), lifestyle** — stored as observations/conditions.
4. **Validated instruments (net-new, stored locally as `questionnaire` observations):** PHQ-9, GAD-7, AUDIT-C, Epworth; Menopause Rating Scale (women); ADAM + IPSS (men). Store item responses and computed scores.
5. **Privacy/limitation notice:** local-only data in Phase 1, no backup yet — device loss means data loss until Phase 2.

**Safety requirement (mandatory):** PHQ-9 item 9 covers self-harm thoughts. A positive response must immediately surface U.S. crisis resources (988 Suicide & Crisis Lifeline) within the flow, not silently record the answer. If deferring, gate behind PHQ-2 (no self-harm item) until the crisis flow exists.

**Consent:** honor the existing `consent_preferences` toggles (`health_data_ai`, `health_data_storage`, `analytics`) and their multi-layer enforcement (see `CLAUDE.md § Consent Toggle Enforcement`). `health_data_ai` gates transient analysis. Reconcile `health_data_storage` for local-first — it most likely gates Phase 2 cloud backup rather than on-device storage; confirm the intended meaning before wiring.

---

## Endpoints mobile consumes (real)

- `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/refresh`, `POST /api/auth/signout` — with `X-Client-Type: mobile` for body-returned tokens.
- `GET /api/profile`, `PATCH /api/profile` — bootstrap profile, cohort fields, plan.
- `POST /api/chat` — primary inference, **SSE streaming** (`event: delta` + `event: done`); 330s timeout. Mobile needs an SSE client. Use the **no-persist mode** (Decisions) so nothing is written to `conversations`/`messages`.
- `POST /api/diabetes/log` — existing self-reported biomarker ingest (glucose/weight); the established offline-queueable POST. Use for self-report logging; expect this to generalize as the product broadens.
- **NEW `POST /api/parse-report`** — transient parse: accepts extracted document text, returns LOINC-coded structured observations, persists nothing. (Net-new; design consistent with invariant 5.)
- 45+ insight generation runs from the **local observation store** (net-new path), not `fhir_cache` (which is the Medicare/FHIR cohort).

Do not use the Blue Button / FHIR endpoints in this build (Medicare cohort).

---

## Upload + parse flow (net-new)

1. User picks a PDF or image (lab / EHR / doctor-visit).
2. Store the file as an encrypted on-device blob (`reports`). **No S3.**
3. Extract text on-device — PDF text layer, or OCR (ML Kit / Vision) for scanned images.
4. `POST /api/parse-report` with the extracted text → receive structured, LOINC-coded observations.
5. User reviews/confirms the extracted values before they are committed to local `observations` (linked via `report_id`).

---

## Explicitly out of scope for Phase 1

Longitudinal prediction/trend models; zero-knowledge cloud backup, sync, multi-device; population cohort; any server-side persistence of health data (including chat); Blue Button / FHIR / Medicare path; web app changes.

---

## Build order

1. Expo + TS scaffold, env config, navigation shell, SSE client utility.
2. SQLCipher + encrypted DB init + `crypto/keystore` module (device key) + recovery code.
3. Local data model: migrations, typed DAL, append-only/supersede helpers (mirror snapshots semantics).
4. Auth: email-OTP sign-in against `/api/auth/*` with `X-Client-Type: mobile`, token storage, Bearer client, silent refresh, 7-day cap handling. (Coordinate the small backend change to return tokens in body.)
5. Profile bootstrap + cohort interstitials (Medicare, then demographics) via `GET/PATCH /api/profile`.
6. Onboarding intake + validated instruments + 988 crisis flow; wire consent toggles.
7. Upload + on-device blob storage + on-device text/OCR + `/api/parse-report` + review/confirm.
8. Chat (local-first, no-persist) against `/api/chat` SSE.
9. Data timeline view over local observations.
10. Tests: append-only/supersede correctness, key isolation from login, no-network-persistence path, token refresh + 7-day cap.

---

## Build sequencing & ownership

The 10-step Build order above is the chronological substrate. This section maps those steps to agents and runs them as **dependency-ordered waves**.

**Why waves matter.** The six mobile build agents are file-disjoint by design (no merge conflicts when run in parallel) but they are NOT dependency-disjoint — onboarding and upload both depend on theme tokens, the local DAL, and the auth-wired API client. Running all five build agents at once means consumers code against placeholder interfaces and re-do work when contracts shift. Waves prevent that.

**The frozen contracts** at `mobile/src/contracts/` are the seam:
- `LocalDataDAL` (implemented by `mobile-local-data-modeler`).
- `Theme` (implemented by `mobile-theme-bridge`).
- `ApiClient` (implemented by `mobile-auth-wirer`).

All agents import these interfaces; **no agent redefines them locally**. The main thread writes the contract files in Wave 0 before any build agent runs. Once Wave 1 begins, contracts are frozen — additive changes only, never breaking.

### Dependency rule (load-bearing)

> File-disjointness prevents merge conflicts. It does NOT prevent dependency conflicts. Wave 2 MUST NOT begin until Wave 1's contracts are implemented — `mobile-onboarding-builder` and `mobile-upload-parse-builder` import `LocalDataDAL`, `Theme`, and `ApiClient` and need real implementations, not stubs.

### Wave 0 — contracts + scaffold

- **Main thread** writes `mobile/src/contracts/{LocalDataDAL,Theme,ApiClient}.ts` plus an `index.ts` barrel.
- **`mobile-app-shell` Pass 1** scaffolds the Expo + TS project, sets up navigation, and creates placeholder screens for every surface so Wave 1 builders can mount into known paths.
- Acceptance: `mobile/` compiles; navigation skeleton renders placeholders; contracts type-check.

### Wave 1 — foundation (parallel)

Run all three in parallel — they are mutually independent:
- **`mobile-theme-bridge`** → implements `Theme` (token values mirrored from `app/src/app/globals.css`).
- **`mobile-local-data-modeler`** → implements `LocalDataDAL` (SQLCipher schema + DAL with append-only / supersede semantics).
- **`mobile-auth-wirer`** → implements `ApiClient` (Bearer client, silent refresh, 7-day cap) AND ships the additive backend `X-Client-Type: mobile` branch in `verify-otp` and `refresh` (web path byte-identical when the header is absent, enforced by regression test).

Acceptance: each contract has a passing implementation; auth-wirer's web-path regression test passes; local-data-modeler's append-only invariants are covered by unit tests.

### Wave 2 — consumers (parallel)

Run both in parallel — they share dependencies but write to disjoint files:
- **`mobile-onboarding-builder`** → cohort interstitials, intake, validated instruments, 988 safety surface. Imports `LocalDataDAL`, `ApiClient`, `Theme` from `src/contracts/`.
- **`mobile-upload-parse-builder`** → file pick → encrypted blob → on-device OCR → transient `POST /api/parse-report` (net-new backend route this agent ships) → review/confirm. Imports `LocalDataDAL`, `ApiClient`, `Theme` from `src/contracts/`.

Acceptance: each surface's screens are functional in isolation; tests pass; the parse-report endpoint's zero-RDS-insert spy assertion is green.

### Wave 3 — integration

- **`mobile-app-shell` Pass 2** → builds the timeline view over `LocalDataDAL`, wires every surface into the navigation graph, runs the end-to-end smoke test.

Acceptance: every Phase 1 acceptance criterion below is verifiable in the running app.

### After every wave — privacy review

- **`mobile-privacy-invariant-guard`** runs after each of Waves 0, 1, 2, and a full review at Wave 3. The guard is read-only and reports Critical / High / Medium / Low findings. It always surfaces the two AWS manual checks (Bedrock invocation logging OFF, Cognito `RefreshTokenValidity` ≥ 30 days) even when no code findings exist.

### Why not fan out all five at once?

File-disjointness is necessary but insufficient. Without contracts and waves:
- Wave 2 consumers would write against placeholder interfaces, re-doing work when foundation agents finish.
- Drift between `Theme` shape and the components that consume it would be caught at runtime, not at type-check.
- The auth wire's `X-Client-Type` branch would be wired by guesswork until `verify-otp`'s body shape is known.
- The privacy guard would have nothing to review until everything was done at once — a long feedback loop that catches violations late.

With contracts + waves: every agent codes against a frozen interface; type-checking enforces consistency; the privacy guard reviews at every wave; integration in Wave 3 is mechanical because the seam was right from the start.

### Ownership map (build-order step → agent)

| Build-order step | Agent | Wave |
|---|---|---|
| 1. Expo scaffold, navigation, SSE client utility | `mobile-app-shell` (Pass 1) + `mobile-auth-wirer` (SSE in `ApiClient.chat`) | 0 + 1 |
| 2. SQLCipher + DB init + keystore + recovery code | `mobile-local-data-modeler` (DB) + crypto/keystore module owned by `mobile-auth-wirer` (key isolation invariant) | 1 |
| 3. Local data model: migrations, DAL, append-only helpers | `mobile-local-data-modeler` | 1 |
| 4. Auth: email-OTP, token storage, Bearer client, silent refresh, 7-day cap + backend additive change | `mobile-auth-wirer` | 1 |
| 5. Profile bootstrap + cohort interstitials | `mobile-onboarding-builder` | 2 |
| 6. Onboarding intake + validated instruments + 988 + consent toggles | `mobile-onboarding-builder` | 2 |
| 7. Upload + on-device blob + OCR + `/api/parse-report` + review/confirm | `mobile-upload-parse-builder` | 2 |
| 8. Chat (local-first, no-persist) against `/api/chat` SSE | `mobile-app-shell` (Pass 2; consumes `ApiClient.chat`) | 3 |
| 9. Data timeline view over local observations | `mobile-app-shell` (Pass 2) | 3 |
| 10. Tests (per-surface + integration smoke) | Each builder writes its own; `mobile-app-shell` Pass 2 owns the integration smoke | 1–3 |

---

## Acceptance criteria

- Mobile signs in via email OTP against the existing Cognito-backed `/api/auth/*` (tokens in body, stored in Keychain/Keystore); calls use `Authorization: Bearer`; silent refresh works; 7-day cap re-prompts.
- `users.id` = Cognito sub; profile, cohort fields, and plan bootstrap from `GET /api/profile`; cohort interstitials persist via `PATCH /api/profile`.
- Health data is stored in an encrypted SQLCipher DB; the DB key lives in Keystore/Keychain and is never sent to or derivable by the server.
- Observations are append-only, LOINC-coded for labs, with `effective_at` + `recorded_at`; semantics match the existing snapshots pattern.
- Onboarding completes; a positive self-harm response surfaces 988; consent toggles are honored.
- A user can upload a lab/EHR/visit doc; it is stored encrypted on-device, parsed via `/api/parse-report`, and confirmed observations land locally — nothing persisted server-side.
- Chat works against `/api/chat` SSE in no-persist mode; no rows written to `conversations`/`messages`.
- The data timeline renders local observations chronologically.
- No code path persists health data to a server, and no Blue Button/FHIR path is invoked.
