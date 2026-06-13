# Phase 1 mobile — settled decisions (decision record)

Captures the *why* behind the load-bearing Phase 1 mobile choices so they aren't re-litigated or quietly drifted from in later sessions. Each decision lists the choice taken, the alternatives considered, and the trade-off accepted. **Read this before proposing a deviation** — if a fresh constraint changes the calculus, update the relevant decision rather than silently choosing differently in code.

Spec: `docs/design/phase-1-45plus.md`. Path-scoped rules: `mobile/CLAUDE.md`. Agents: `.claude/agents/mobile-*.md`.

---

## D1 — Local-first + on-device encryption

**Decision:** the device is the system of record. All health data lives in an encrypted SQLCipher DB; uploaded files are encrypted on-device blobs. Server stores nothing health-related in Phase 1.

**Alternatives considered:**
- Server-side store with strong access controls — rejected; the 45+ audience's trust hinges on data being on their device, not on our promises.
- Hybrid (encrypted-at-rest server store with on-device key) — rejected for Phase 1; adds complexity (cloud KMS choice, sync semantics) without the trust win, and pulls the longitudinal model decision into Phase 1.

**Trade-off accepted:** device loss = data loss until Phase 2 adds opt-in zero-knowledge backup. Disclosed in the onboarding privacy notice.

---

## D2 — Transient analysis (non-retention, not non-transmission)

**Decision:** when the user requests an analysis, decrypt relevant observations on-device, send over TLS to Bedrock, return the result, and store the result on-device. **Nothing persisted server-side.** The privacy claim is "**nothing is retained**" — not "nothing is transmitted" — and the onboarding privacy notice communicates this transparently.

**Alternatives considered:**
- On-device inference only — rejected; Bedrock-class models exceed mobile compute budget and the product depends on Claude-quality reasoning.
- Server-side inference with a 24-hour retention window — rejected; "retained for less than a day" still violates the trust mechanism the product is built on.

**Trade-off accepted:** Bedrock model-invocation logging **must be OFF** for the privacy claim to hold (`aws bedrock get-model-invocation-logging-configuration`). This is a manual AWS check the privacy guard surfaces on every audit; if it ever flips ON, the privacy claim is silently broken.

---

## D3 — Email-OTP for mobile auth (not hosted UI / PKCE)

**Decision:** mobile reuses the existing email-OTP flow at `/api/auth/{send,verify}-otp`. The backend is extended with an additive `X-Client-Type: mobile` branch in `verify-otp` and `refresh` that returns Cognito JWTs in the JSON body instead of `Set-Cookie` headers.

**Alternatives considered:**
- Second Cognito app client + hosted UI + OAuth code+PKCE — rejected; splits the auth UX between web and mobile users, requires a second Cognito client config, and complicates the operator's mental model.
- Custom mobile auth (not Cognito-backed) — rejected; would require a parallel session model.

**Trade-off accepted:** mobile sees the 7-day NIST 800-63B session cap and re-OTPs weekly. Acceptable for the 45+ audience (implicit by reuse of the web policy). The backend change must keep the web path byte-identical when the header is absent — enforced by a regression test that `mobile-auth-wirer` ships as part of its deliverables.

---

## D4 — Generalize `diabetes_snapshots` into the device-local observation store

**Decision:** the on-device `observations` table mirrors the server-side `diabetes_snapshots` semantics — `UNIQUE(user_id, code, effective_at)` + `ON CONFLICT DO NOTHING`, append-only, corrections via `supersedes_id`. The shape is generalized to all observation categories (anthropometric, vital, biomarker, symptom, questionnaire, screening, lifestyle, family_history, condition).

**Alternatives considered:**
- A parallel data model designed from scratch for mobile — rejected; would mean two divergent longitudinal schemas to maintain when Phase 2 adds opt-in sync.
- Direct mirror of FHIR Observation resources — rejected for Phase 1; FHIR's resource model is expensive on-device and overkill for the 45+ local path.

**Trade-off accepted:** the mobile schema is shaped against `diabetes_snapshots` (LOINC-keyed labs) — non-lab observations use `code_system = "internal"` until / unless they map cleanly to LOINC or another standard. **Server-side generalization is a separate decision, intentionally not in Phase 1's scope.**

---

## D5 — Wave-sequenced builds via frozen seam contracts

**Decision:** the build runs in 4 dependency-ordered waves with `LocalDataDAL`, `Theme`, `ApiClient` as frozen contracts at `mobile/src/contracts/`. The main thread writes contracts in Wave 0. Foundation agents (theme-bridge, local-data-modeler, auth-wirer) implement them in Wave 1. Consumer agents (onboarding-builder, upload-parse-builder) build against the implementations in Wave 2. Integration in Wave 3 via `mobile-app-shell` Pass 2.

**Alternatives considered:**
- Fan out all five build agents in parallel — rejected; file-disjointness prevents merge conflicts but not dependency conflicts. Wave 2 consumers would code against placeholder interfaces and re-do work when Wave 1 finishes.
- Single linear build (one agent at a time) — rejected; slower, and the foundation agents are genuinely mutually independent.

**Trade-off accepted:** Wave N+1 cannot start before Wave N's contracts are implemented. The privacy-invariant-guard reviews after each wave, not just at the end. This is encoded as a non-negotiable rule in `mobile/CLAUDE.md`.

---

## D6 — `mobile-app-shell` owns scaffold + timeline + integration

**Decision:** a 7th agent owns the Expo scaffold (Pass 1, Wave 0), the data timeline view, and the final assembly stitching all surfaces into a running app (Pass 2, Wave 3). It is a build agent, not an orchestrator — the main thread invokes wave sequencing.

**Alternatives considered:**
- Have each surface agent contribute its own bit of the scaffold — rejected; nobody owned the integration, the navigation graph, or the timeline view.
- Make the main thread also handle scaffolding — rejected; would mean ad-hoc scaffolding per session rather than a documented agent with a clear scope.

**Trade-off accepted:** `mobile-app-shell` is the only agent that runs in two non-contiguous waves, which creates a small handoff cliff between Pass 1 and Pass 2. Documented explicitly in its definition.

---

## D7 — 45+ non-Medicare target; Blue Button / FHIR is out of scope

**Decision:** Phase 1 targets the 45+ non-Medicare audience. The Blue Button / FHIR / Medicare data path that drives the 65+ web experience is **not invoked from mobile**. 45+ analysis runs from the local `observations` store, not `fhir_cache`.

**Alternatives considered:**
- Bring Blue Button to mobile as well — rejected; Phase 1 is the 45+ scope, and the Medicare cohort already has the web app. Adding FHIR to mobile would also pull in CMS production credentials, the prod RDS `fhir_cache` write path, and the existing 24h TTL semantics — none of which fit the local-first invariant.
- Build a unified 45+/65+ mobile app — deferred to Phase 2+.

**Trade-off accepted:** mobile users on Medicare see the same onboarding interstitials as 45+ users (because the cohort capture is unified) but the mobile app intentionally does not offer the Blue Button connect flow. Settings should surface a "you are on Medicare — use the web app for Blue Button" pointer (built in Wave 3 by `mobile-app-shell`).

---

## D8 — Theme contract Wave-1 amendment (controlled thaw, 2026-06-04)

**Decision:** the `Theme` contract was extended during a controlled thaw (per `mobile/CLAUDE.md` § Hooks) to fully mirror `app/src/app/globals.css`. No further theme thaws should be needed in Phase 1.

**Why:** the original Wave 0 freeze covered backgrounds + text + accents + borders + 3 semantic colors. The privacy audit's open question surfaced 5 categories of CSS tokens present in `globals.css` but absent from the contract — chat-bubble colors, condition-domain accents (auth/check/appeal/health/diabetes), brand purple, the tertiary background, and the 12px / 20px spacing intermediates. Wave 2 surfaces will need these (onboarding uses the condition accents; chat uses the bubble colors). Adding them all in one thaw is cheaper and lower-risk than five separate amendments.

**Alternatives considered:**
- Skip the amendment; Wave 2 consumers extend the contract themselves as needed — rejected; defeats the seam-contract purpose and risks drift.
- Restructure the spacing scale to numeric (`space1..space12`) — rejected; would force `theme-bridge` to rewrite all consumers' spacing references for no functional gain. Kept the named scale (`xs`/`sm`/`md`/`lg`/`xl`/`2xl`/`3xl`) and added `space3` + `space5` as intermediates.

**What was added:**
- `ThemeColors.bgTertiary` — globals.css `--bg-tertiary`.
- New `ThemeChatColors` (user-bubble-from/to + assistant-bubble) — per-mode.
- New `ThemeAccentFamily` + `ThemeConditionAccents` (auth-blue / check-teal / appeal-coral / health-red / diabetes-violet, each `{base, light, bg}`) — per-mode.
- New `ThemeBrand.purple` — mode-agnostic.
- `ThemeSpacing.space3` + `ThemeSpacing.space5` — the 12px and 20px intermediates from web's `--space-3` and `--space-5`.

**Trade-off accepted:** the `colors` shape on `Theme` is now structurally larger (adds `chat`, `conditions`, `brand` nested objects alongside `light` and `dark`). The amendment is purely additive — existing consumers using `colors.light` or `colors.dark` see no change. The drift test was extended from 22 to 43 `it()` blocks (+41 expects) so every new token is now drift-asserted against `globals.css`.

**Thaw protocol followed:**
1. `rm mobile/.wave-0-complete` (unfreeze).
2. Edit `mobile/src/contracts/Theme.ts` (additions only — no breaking changes).
3. `mobile-theme-bridge` implemented the new values in `tokens.ts` and extended the drift test.
4. `touch mobile/.wave-0-complete` (refreeze).
5. This decision record.

---

## D9 — Wave-3 hard gate: `/api/chat` no-persist backend branch before mobile chat surface (2026-06-04)

**Decision:** Wave 3 (`mobile-app-shell` Pass 2) MUST land the `X-Client-Type: mobile` + `noPersist: true` branch in `app/src/app/api/chat/route.ts`, plus a `query()`-spy regression test asserting **zero** RDS inserts to `conversations` / `messages` on the mobile path, **before** the mobile chat surface is wired into navigation or any test client invokes `ApiClient.chat()`.

**Why:** the privacy guard surfaced this in its Wave 1 audit (finding M2). `ApiClient.chat()` (`mobile/src/auth/chatStream.ts`) is already coded to send `{ noPersist: true }` in the body + `X-Client-Type: mobile` in the header. The backend route `app/src/app/api/chat/route.ts` does NOT recognize either signal yet — confirmed by `grep -n "X-Client-Type\|noPersist" app/src/app/api/chat/route.ts` returning zero matches. As soon as Pass 2 wires the mobile chat UI, every turn would write to `conversations` + `messages` for the mobile user — direct Invariant 1 violation.

**Alternatives considered:**
- Fix the backend branch as a Wave 1 add-on now — rejected; mixes auth-wirer scope with chat scope, and the `query()`-spy regression test belongs with the surface that consumes chat (Pass 2 / Wave 3).
- Add a runtime guard in `chatStream.ts` that throws unless an `ENABLED` env flag is set — rejected; adds a kill-switch that could be silently disabled in dev and shipped accidentally; the structural gate via Pass 2's blocking dependency is cleaner.

**Trade-off accepted:** the contract-shaped behavior of `ApiClient.chat()` is structurally present in Wave 1 but is a "tripwire" — it will work as soon as the backend honors the signals, but until then it's a forward-looking risk. `chatStream.ts` is unreachable from any Wave 1 surface (`SignInScreen` does not invoke chat, placeholder `ChatScreen.tsx` shows no UI). `guard-persistence.sh` already lists the chat no-persist test path as a planned `TEST_TARGETS` entry — when the test lands, the hook auto-covers it.

**Enforcement:**
- This decision record (D9).
- The `mobile-app-shell` agent's Pass 2 deliverables explicitly list the `/api/chat` no-persist backend branch + the `query()`-spy regression test as **blocking prerequisites** for wiring the mobile chat surface.
- The privacy guard's conformance checklist includes "chat path writes nothing to `conversations`/`messages` under `X-Client-Type: mobile`" — at Wave 3 review time, this becomes a CRITICAL-severity item if not satisfied.

---

## D10 — `health_data_storage` consent gates Phase 2 cloud backup (not on-device SQLCipher)

**Decision:** the existing `consent_preferences.health_data_storage` toggle (one of the three consent toggles the web app surfaces — see `CLAUDE.md` § Consent Toggle Enforcement) has an ambiguous meaning in a local-first build. Phase 1 mobile adopts the following reading: **`health_data_storage` gates Phase 2 cloud backup. It does NOT gate Phase 1 on-device SQLCipher storage.**

**Why:** on-device encrypted SQLCipher storage is **intrinsic** to Phase 1 — toggling it off would mean "wipe my device" or "refuse to install", which is destructive and incompatible with the device-is-system-of-record invariant. The toggle therefore has no meaningful Phase 1 enforcement target. The natural Phase 2 mapping (when zero-knowledge cloud backup arrives as an explicit opt-in) is that this toggle controls whether the backup runs. Until Phase 2 ships, the toggle is recorded but inert.

**Alternatives considered:**
- Interpret as "gate all SQLCipher writes" — rejected; destructive, breaks the local-first invariant, prevents the app from functioning if turned off.
- Re-purpose for something else (e.g., gate analytics) — rejected; `analytics` is its own consent toggle.
- Remove the toggle from the mobile UI entirely — rejected; the toggle exists in the shared `consent_preferences` table and is honored by the web app; removing it on mobile would create cross-platform inconsistency.

**Trade-off accepted:** the toggle has no functional effect in Phase 1 mobile. Settings UI (Wave 3) will surface it with explanatory copy: *"Cloud backup is not available in this version. This setting will apply when a backup option is added in a future release."* The `health_data_ai` and `analytics` toggles ARE enforced in Phase 1 (see `mobile/src/onboarding/consent.ts` — `canCallAi` and `canEmitAnalytics` helpers; client-side `UploadScreen.tsx:87-96, 218-226` and server-side `app/src/app/api/parse-report/route.ts:319-333` for the `health_data_ai` enforcement).

**Encoded in code:** the interpretation is documented at `mobile/src/onboarding/consent.ts:9-29` so future agents read it as part of their pre-flight.

---

## D11 — Phase 1 mobile chat is EPHEMERAL (session-scoped, no persistence)

**Decision:** Phase 1 mobile chat lives entirely in component state. Conversation context is held in `useState<ChatTurn[]>` inside `mobile/src/screens/ChatScreen.tsx` and **persisted nowhere** — not server-side, not on-device. On sign-out (or app close), the chat history is gone.

**Why:** the device-as-system-of-record invariant is about HEALTH DATA — observations, conditions, reports, instrument scores. Conversational ephemera does not need the same persistence guarantees, and adding persistent chat introduces UI questions (search, archive, delete, multi-session history) that don't fit Phase 1's tight scope. The 45+ audience's trust hinges on understanding what the app keeps; "your conversation isn't saved" is a clearer story than "your conversation is saved on-device but not on our servers."

**Alternatives considered:**
- Persist on-device only in the existing `chat_messages` SQLCipher table (the table exists in the schema — see `mobile/src/db/migrations/001-init.sql`). Rejected for Phase 1; opens the search/archive/delete UI scope. The table stays in the schema for future use.
- Persist server-side with the 65+ web's existing `conversations`/`messages` rows. **Rejected** as a direct invariant violation — see D9 (which forbids server-side persistence on the mobile chat path) and Invariant 1.

**Enforcement:**
- **Server-side**: D9 gate at `app/src/app/api/chat/route.ts:144-153` — when `X-Client-Type: mobile`, route writes nothing to `conversations`/`messages`. Spy-verified by `app/src/app/api/chat/__tests__/no-persist.test.ts` (zero RDS inserts to the explicit forbidden-tables list).
- **On-device**: Pass 2 `ChatScreen.tsx` writes nothing to `LocalDataDAL.insertChatMessage`. The `chat_messages` table exists but is unpopulated in Phase 1.
- **Sign-out**: `apiClient.onSignInRequired` → `clearHistory()` in `ChatScreen` (pinned by `chatHistory.test.ts:74-78`).

**Trade-off accepted:** users can't return to a prior conversation. Acceptable for Phase 1's "private personal record" trust story; a Phase 2 release that adds persistent chat is a documented later-phase scope.

---

## D12 — On-device image OCR deferred; Phase 1 supports PDF text layer only (2026-06-05)

**Decision:** on-device image OCR is deferred to a later phase. Phase 1 supports **PDF text-layer extraction only** via the `expo-pdf-text-extract` native bridge. Scanned PDFs (no text layer) and image uploads (JPG / PNG / HEIC) are accepted by the picker, encrypted on-device, and surfaced with a clean "not yet supported" UX — they are NOT sent to a cloud OCR service.

**Why:** as of 2026-06-05, no on-device OCR library has a validated New-Arch + SDK 56 + RN 0.85 story (see the STEP 1 diagnosis for the survey). The local-first invariant (no health data persisted server-side, Invariant 1) forbids cloud OCR. Shipping PDF text-layer extraction now — which covers the bulk of "downloaded my lab report PDF from the patient portal" intake flows — earns the trust step the Phase 1 product depends on, without compromising the invariant.

**Alternatives considered:**
- Ship `@react-native-ml-kit/text-recognition` now, accepting unresolved New-Arch risk — rejected; latest release (2024-Q4) has no documented New-Arch support and would require turbo-module-only interop work outside Wave 2 scope.
- Server-side OCR on encrypted blobs — rejected; Invariant 1 violation (would require decrypting health data server-side, even briefly).
- Build a native VisionKit/MLKit bridge in this fix-up — rejected; out of scope for STEP 2, which is the PDF pivot.

**Trade-off accepted:** Phase 1 users must upload PDFs with selectable text. Scanned images / photos surface a clean "not yet supported" UX in `UploadScreen.tsx` — the encrypted blob is still persisted in the `reports` row so the file is preserved on-device, but the parse step is gated with a `reason` (`pdf_has_no_text_layer` or `ocr_not_supported_phase_1`) the UI renders as: *"This file looks like a scanned image or photo. For now, please upload a PDF with selectable text. Image and scan support is coming in a future release."*

**Encoded in code:**
- `mobile/src/upload/extract.ts` — capability matrix in the header doc, `ExtractResult.reason` union (`pdf_has_no_text_layer | ocr_not_supported_phase_1 | extract_failed`).
- `mobile/src/screens/UploadScreen.tsx:296-314` — the OCR-gap message string + `safeUpdateStatus(dal, reportId, "rejected", summary)` so the report row stays in a clean state.

---

## D13 — PDF text extraction via `expo-pdf-text-extract` (not pdfjs-dist) (2026-06-05)

**Decision:** PDF text extraction is implemented via **`expo-pdf-text-extract` (native iOS PDFKit + Android PDFBox bridge)**, not via `pdfjs-dist`.

**Why:** pdfjs-dist + Hermes + New Architecture + RN 0.85 has no documented working text-extraction reference as of 2026 (mozilla/pdf.js#18732 is still open). The Wave-2 `extract.ts` design used a `new Function("p","return import(p);")` lazy-load that is incompatible with Metro's static module resolution AND Hermes-fragile, so every PDF upload short-circuited to `extract_failed`. `expo-pdf-text-extract` v1.1.0 (zero npm deps, SDK 49+, published 2026-05-20) uses platform-standard text APIs (PDFKit on iOS, PDFBox on Android) with no JS-engine dependency, sidestepping both the Metro and Hermes problems.

**Alternatives considered:**
- Continue investing in pdfjs-dist — rejected; high risk, weeks of yak-shaving with no public success precedent on the New-Arch + Hermes + RN 0.85 stack.
- Defer PDF extraction to Phase 2 entirely — rejected; defeats the Wave-2 acceptance promise that a user can upload a lab/EHR/visit PDF and land observations locally after review.
- Write our own native PDFKit/PDFBox bridge in-house — rejected for this fix-up; package's source is small (one Swift file + one Kotlin file, zero deps) so audit is light. Kept as the fallback if STEP 3 fails.

**Trade-off accepted:** third-party module (`expo-pdf-text-extract` v1.1.0, sole maintainer `gr8pathik`, published 2026-05-20). Audit is light by virtue of zero declared dependencies + native code touching only PDFKit (Apple framework) and PDFBox (Apache, widely used). The package requires a custom dev build — Denali already ships one via `expo-sqlite` (SQLCipher) and `expo-secure-store`, so no new build-pipeline burden.

**Pending:** STEP 3 EAS / device dev-build smoke (iOS + Android simulators run by the main thread) confirms New-Arch + Hermes interop before this decision is fully validated. A boot-time self-test (`mobile/src/upload/extractSelfTest.ts`) logs `[EXTRACT-SELFTEST] ok: true|false …` to Metro / Logcat, so the main thread can grep for the result rather than driving UI. If STEP 3 fails on either platform, the team pivots to writing an own-wrapper native module.

**Encoded in code:**
- `mobile/package.json` — `expo-pdf-text-extract@^1.1.0` (installed via `npx expo install`).
- `mobile/src/upload/extract.ts` — static `import * as PdfTextExtract from "expo-pdf-text-extract"`. The `new Function`-based lazy-load is removed.
- `mobile/src/upload/extractSelfTest.ts` — dev-only boot-time self-test (`__DEV__` gated, fire-and-forget from `App.tsx`).
- `mobile/src/upload/__tests__/fixtures/sample-lab.pdf` + `sample-lab.base64.ts` — deterministic 720-byte text-layer PDF for both the wrapper-logic test (mocks the native module) and the dev-mode self-test (uses the real bridge).
- `mobile/src/upload/__tests__/extract.test.ts` — 12 wrapper-logic assertions proving the success / empty / throw / unavailable / image paths. Does NOT exercise the native module (node env can't load native code); STEP 3 covers that gap.

---

## D14 — Cold-launch session restore via additive `ApiClient.restoreSession` (2026-06-12)

**Decision:** A returning user with a valid stored session now skips the sign-in screen on app launch (no new OTP). Implemented by adding one **additive** method to the frozen `ApiClient` contract — `restoreSession(user): Promise<boolean>` — plus a launch gate in `RootNavigator`.

**Why:** A JS reload / cold start always landed on `SignIn` and forced re-OTP, even with non-expired tokens in SecureStore. `ApiClientProvider` never bootstrapped and `RootNavigator` was hardwired to `initialRouteName="SignIn"` — the intended launch restore (referenced in `ApiClientImpl` comments) was a Pass-2 gap. For a local-first app whose Cognito tokens + SQLCipher key live in the device keystore, a valid session must survive a restart. New sign-ins and sign-out still exercise OTP every time, so OTP coverage is unchanged.

**Security:** `restoreSession` enforces the same **7-day NIST 800-63B session cap** the web middleware and mobile `httpClient` already enforce — it reads `getSessionIssuedAt()` + `isSessionExpired()` and **clears stale tokens + returns false** past the cap. No network call; token validity is still proven on the first authed request (silent refresh on 401). Restore requires BOTH a stored token AND a local profile (the identity source); either missing → SignIn.

**Contract-guard process:** `.wave-0-complete` removed → additive interface edit → marker re-touched. Non-breaking (new capability; existing callers unaffected).

**Encoded in code:**
- `mobile/src/contracts/ApiClient.ts` — `restoreSession(user): Promise<boolean>` on the interface.
- `mobile/src/auth/ApiClientImpl.ts` — impl (token + 7-day-cap check + `hydrateUser`); imports `getSessionIssuedAt`, `isSessionExpired`.
- `mobile/src/navigation/RootNavigator.tsx` — launch gate: waits for `useDalState().ready`, reads `getProfile()`, calls `restoreSession({userId: profile.id, email})`, routes a restored user to `MainTabs`; renders a boot splash (`testID="root_boot_splash"`) while deciding.
- `mobile/src/auth/__tests__/ApiClientImpl.test.ts` — 4 `restoreSession` cases (no token / within cap / null issued-at / elapsed cap → cleared) + conformance-array entry.
- `mobile/src/__tests__/smoke.test.ts` — mock `ApiClient` gains `restoreSession`.

---

## D15 — Biometric launch gate + 30-day OTP cap (2026-06-12)

**Decision:** Add a biometric / device-credential gate at app launch (run after session restore) and extend the mobile OTP re-prompt cap from 7 to 30 days. The two are coupled: biometrics give daily presence assurance, which is what justifies the longer OTP interval.

**Why:** Forcing email OTP every 7 days is heavy friction for the 45+ cohort and stricter than the app's auth tier requires. Email OTP is a single factor (≈ AAL1, where NIST 800-63B permits up to 30-day reauth); HIPAA "automatic logoff" is already satisfied by the 30-min idle timeout, not the absolute cap. Mobile is local-first (no server-side PHI; the SQLCipher key is device-bound), so the backend session is the less-sensitive surface. A biometric launch gate is the mobile-native, low-friction continuous control; with it in place a 30-day OTP cap is appropriate.

**Behavior:**
- On cold launch, after `restoreSession` succeeds, `runBiometricGate()` (expo-local-authentication) asks the OS to confirm the owner (Face ID / Touch ID / fingerprint, device-passcode fallback). passed | unavailable → MainTabs; failed / cancelled → LockScreen (retry or sign out). New sign-ins are NOT gated — OTP just proved the email factor.
- "unavailable" (no enrolled biometric/credential) → proceed; never brick a user for a lock the device itself lacks.
- The gate touches NO token and NO SQLCipher key (invariant 3) — it only asks the OS "is the owner present?".
- OTP cap: `SESSION_MAX_MS` 7d → 30d in mobile `sessionPolicy.ts`. INTENTIONAL divergence from the web's 7-day cap (web keeps 7 for the server-PHI Medicare path). 30 days matches the Cognito refresh-token lifetime (verified 2026-06-04), so silent refresh stays viable for the whole window.

**Deferred (follow-ups):** resume-after-background gating (AppState + last-active threshold); a Settings opt-out toggle for the gate.

**Encoded in code:**
- `mobile/src/auth/biometricGate.ts` (+ `__tests__/biometricGate.test.ts`) — `runBiometricGate()` / `isBiometricAvailable()`, fail-safe to "unavailable".
- `mobile/src/screens/LockScreen.tsx` — locked-state UI (Unlock / sign in with a different email).
- `mobile/src/navigation/RootNavigator.tsx` — launch phase machine: deciding → locked → ready.
- `mobile/src/auth/sessionPolicy.ts` — `SESSION_MAX_MS` = 30 days (sessionPolicy / ApiClientImpl / httpClient tests bumped).
- `mobile/app.config.ts` — expo-local-authentication plugin (injects iOS NSFaceIDUsageDescription).
- `mobile/package.json` — expo-local-authentication ~56.0.4.

**Requires a native dev rebuild** (new native module) before on-device verification.

---

## See also

- Spec: `docs/design/phase-1-45plus.md` (the full Phase 1 build prompt v2).
- Path-scoped rules: `mobile/CLAUDE.md` (auto-loaded under `mobile/`).
- Agent definitions: `.claude/agents/mobile-*.md`.
- Frozen contracts: `mobile/src/contracts/{LocalDataDAL,Theme,ApiClient,index}.ts`.
