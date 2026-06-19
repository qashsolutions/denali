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

## D16 — Zero-knowledge backup (2026-06-14)

**Decision:** Add an opt-in, zero-knowledge cloud backup of the on-device health
record. **Supersedes the "no cloud backup" half of Invariant 6** (Venkata
ratified 2026-06-14). The server stores only client-side-encrypted ciphertext it
cannot decrypt; the recovery key is generated on-device and never leaves the
user's devices/keychain. Full design + threat model: `docs/design/zk-backup-v1.md`.

**Why:** device loss = total loss of the multi-year record today (the SQLCipher
key is device-only — invariant 3). For an app whose value is the longitudinal
record, that's the biggest UX risk. ZK backup fixes device-loss + migration
without making the server a custodian of *readable* PHI, preserving invariant 1's
spirit.

**Key decisions (Venkata):**
- **Recovery model:** on-device recovery key (256-bit, CSPRNG, never derived
  from login — invariant 3), recovered via **device keychain (iCloud / Google
  Password Manager) + a printable recovery kit**. The server can never hold,
  derive, or email the key. Server-generated / emailed codes were explicitly
  rejected (would break ZK; an 8-digit code is also only ~26 bits).
- **Recovery-kit rendering:** **BIP39** mnemonic (checksum + mature tooling).
- **Backup trigger:** **manual + automatic** (a "Back up now" action plus a
  scheduled auto-backup, e.g. Wi-Fi + charging).
- **Crypto:** envelope — RK → HKDF-SHA256 KEK → wraps a per-backup DEK →
  AES-256-GCM over the payload, manifest bound as AEAD AAD. Primitives from
  @noble (audited, pure-JS, Hermes-safe; chosen via an AEAD spike, RFC-5869
  verified). No hand-rolled crypto.
- **Storage:** v1 stores ciphertext in RDS (`backup_blobs`, BAA-covered,
  `WHERE user_id = $1`), S3 as the scale path. Chat + report file blobs excluded.

**Staged build (each its own reviewed step):** crypto core (shipped, `ba899e8`)
→ export/import (shipped, `8503781`) → wire codec → server (`backup_blobs` +
`PUT/GET/DELETE /api/backup`) under hipaa-security-reviewer +
mobile-privacy-invariant-guard + a ciphertext-only guard test → recovery UX
(keychain + BIP39 kit + Settings opt-in) → flag-gated, opt-in, staging-first.

**Shipped — all stages (2026-06-14):**
- On-device: `mobile/src/backup/*` — crypto core → export/import → wire codec →
  mobile client (`remoteBackup`) → recovery UX (`recoveryKey` BIP39 via
  @scure/bip39; `recoveryKeyStore` via expo-secure-store; `backupController`;
  `ui/{RecoveryKitModal,BackupSettingsCard}`; `RestoreBackupScreen`).
- Server: `app/src/app/api/backup/route.ts` (PUT/POST/GET/DELETE) +
  `scripts/migrate-backup-blobs-2026-06-14.sql` + account-delete cascade.
  Reviews: hipaa-security + mobile-privacy-invariant + db-migration-guard — PASS.
- Crypto deps: @noble/ciphers + @noble/hashes (AES-GCM/HKDF, pure-JS). Android
  `allowBackup=false` so Google auto-backup can't leak the secure-store keys.
- **Staging RDS migration APPLIED 2026-06-14** via ECS exec (RDS is private —
  ran through the container's own pg). **Prod migration + flag flip still pending.**
- **Rollout:** UI flag-gated by `EXPO_PUBLIC_BACKUP_ENABLED` (off by default) —
  opt-in, staging-first.
- `docs/design/zk-backup-v1.md` — full design + threat model + §8 supersession.
  Invariant 6 reworded in `mobile/CLAUDE.md`; non-goals updated in
  `mobile/docs/OBJECTIVE.md` §4.

---

## D17 — Dark mode ("Alpine night") (2026-06-14)

**Decision:** Resolve the deferred dark-mode variant. A dark companion palette
(`redesignDark`) was derived from the light "Alpine clarity" tokens — same
cool / glacier-teal identity inverted for low-light. A 3-way **Light / Dark /
System** control in Settings (persisted in expo-secure-store) selects it.

**Why:** dark mode is table-stakes comfort/accessibility (eye strain, low-light,
light-sensitivity) for the 45+ audience; the `useColorScheme()` plumbing was
already intact — only the palette + control were missing.

**Key points:**
- `useTheme()` switches BOTH the active ThemeColors AND the richer `redesign`
  vocabulary by resolved scheme, so every wash/teal/ink consumer flips.
- Severity-band washes keep semantic hue separation and pass WCAG AA for pill
  text + disclaimer copy in dark (asserted in `tokens.test.ts`).
  clinical-boundary review PASS.
- Trend-chart bands were also brightened (chart-only `band*` tokens, light +
  dark) for legibility — separate clinical-boundary review PASS.
- Nav-theme bridge (no white flash between screens) + scheme-aware font splash.

**Encoded in code:** `mobile/src/theme/{tokens,useTheme,ThemeMode,themeScheme,
fonts}`; `SettingsScreen` (Appearance control); `timeline/trend/TrendChart`.

---

## D18 — Motion design system, tiers 1–4 (2026-06-14)

**Decision:** Add a tasteful, calm motion + haptics layer across the app, and
**lift the prior Reanimated caution** — Reanimated 4 is now verified + in use.

**Why:** the app had zero intentional motion. For a 45+ clinical app the goal is
calm, purposeful micro-motion + tactile feedback that reinforces trust, not
spectacle. Every animation is native-driver + honors OS Reduce Motion; clinical
surfaces (severity bands, scores, the 988/crisis path) are deliberately left
silent — clinical-boundary reviews PASS.

**Tiers (ROI order):**
- **T1 Haptics** — `expo-haptics` via a defensive wrapper (`src/feedback/haptics.ts`):
  selection ticks on neutral controls, success on completed actions. Mood / PHQ /
  988 handlers stay silent by design.
- **T2 Skeletons** — `src/components/Skeleton.tsx` (Animated pulse) replaces bare
  ActivityIndicator loading states.
- **T3 Micro-interactions** — `PressableScale` (press-scale) + `FadeInView`
  (entrance); `src/theme/motion.ts` tokens; `src/a11y/useReducedMotion.ts` gate.
- **T4 Gestures** — **react-native-reanimated@4.3.1 + react-native-worklets@0.8.3
  + react-native-gesture-handler@2.31.1** (Reanimated 4 is New-Arch-only; the
  app is on New Arch). Drag-to-dismiss QuickAdd sheet + pull-to-refresh. Babel
  `react-native-worklets/plugin` (last) + `GestureHandlerRootView` at the root.

**Engineering note (supersedes the old caution):** the `tokens.ts` rationale that
"Reanimated's New-Arch story on RN 0.85 is not broadly validated" is now LIFTED —
Reanimated 4 builds, links, and runs cleanly on Expo 56 / RN 0.85 / New Arch
(`libreanimated.so` + `libworklets.so` load ok; verified on-device 2026-06-14).
The NativeWind-vs-typed-StyleSheet decision is unchanged. Reanimated requires a
native rebuild + the worklets babel plugin + a Metro cache clear.

---

## D19 — Settings "App lock" status row; gate stays always-on (2026-06-15)

**Decision:** Surface the D15 biometric launch gate in Settings as a READ-ONLY
status row (under Privacy & Data), reflecting device capability via
`isBiometricAvailable()` — enrolled → "On — unlocks with Face ID / Touch ID /
passcode" (iOS) or fingerprint / face unlock / PIN (Android); not enrolled →
"Off — set up … in your device settings to lock Denali" (a nudge). **NOT an
enable/disable toggle.**

**Why:** the gate is load-bearing — `sessionPolicy.ts` stretches the OTP
re-prompt cap to 30 days *because* the gate gives daily presence assurance. A
user-facing "turn off Face ID" toggle would create a 30-day single-factor
session with no continuous presence control — a NIST 800-63B regression. To
safely allow "off" you'd have to drop the cap back to 7 days when disabled and
track per-user policy. Out of scope.

**Rule for future sessions:** do not add a biometric enable/disable toggle
without revisiting the 30-day cap (D15). The row is informational only and never
touches the gate, tokens, or the SQLCipher key. `isBiometricAvailable` is now
exported from the `@/auth` barrel.

**Encoded in code:** `SettingsScreen` (App lock card); `src/auth/biometricGate.ts`
(`isBiometricAvailable`); `src/auth/index.ts` (barrel export).

---

## D20 — Accessibility hardening pass (external review-driven) (2026-06-15)

**Decision:** Act on five accessibility findings from an external read-only code
review (45+ audience). Shipped:

1. **Dark-mode consent toggles fixed.** The OFF `Switch` collapsed into the card
   (thumb == `surface`; track ~3% off `surface`). Switch colors are now
   mode-aware: dark uses a near-white `ink` thumb + the `line` hairline
   off-track; light is unchanged. (Bug fix.)
2. **Haptics honor Reduce Motion (extends D18).** `haptics.ts` gains
   `setHapticsReduceMotion` + a gate in `safe()`; `App.tsx` `NavRoot` mirrors
   `useReducedMotion()` into it. Previously haptics fired regardless of the OS
   setting; now all confirmation haptics fall silent under Reduce Motion, like
   animations. `haptics.ts` stays free of react-native imports (node-test-safe).
3. **44px touch targets.** Chat "Show details" toggle (32→44), dashboard "+"
   (40→44), DomainCard "New check-in" chip (40→44) — WCAG 2.5.5 / iOS HIG.
4. **Streaming chat announced to screen readers.** `ChatScreen` announces the
   markdown-stripped summary once on `done` (not per-delta, to avoid speech
   spam) via `AccessibilityInfo.announceForAccessibility` — cross-platform. New
   pure helper `plainSummaryForSpeech` in `chat/markdown.ts`.
5. **InstrumentsScreen skeleton.** `profileLoading` shows content-shaped
   skeletons (matching `SettingsScreen`) instead of a spinner; `submitting`
   ("Saving…") stays a spinner — action feedback, not content load.

**Font-scale cap — policy (load-bearing):** `MAX_FONT_SCALE = 1.6`
(`theme/fonts.tsx`) is applied ONLY to fixed-geometry, non-wrapping CHROME — the
appearance segmented control, the chip/toggle labels, and the timeline severity
pills — where extreme OS text sizes overflow single-line labels. It is
DELIBERATELY NOT global: low-vision / 45+ users set large system fonts on
purpose, and content wraps in flexible-height containers, so capping body text
would hurt the audience. (A global cap is also impractical — React 19 dropped
`Text.defaultProps`.) **Future sessions: never add a global font cap; never
strip the chrome caps.**

**Why:** these were the gaps between the codebase and "unambiguously
best-in-class for older adults" — font-scale clipping, haptic gating, and
screen-reader announcement. The foundations (contrast-tested tokens,
reduce-motion plumbing, semantic roles) were already in place; this completes
them.

**Clinical note:** the pill font-cap touches the clinical timeline surface;
`clinical-boundary-reviewer` ran on the diff and returned PASS (pure
layout-geometry — no string, band, ‡ mark, disclaimer, provenance, or crisis
path touched).

**Reviewer correction (relayed):** the review's InstrumentsScreen evidence
("renders UI while `sexAtBirth` null") was imprecise — the screen gates with a
spinner; the real (Low) nit was spinner-vs-skeleton, now fixed.

**Encoded in code:** `src/feedback/haptics.ts`, `App.tsx` (`NavRoot`);
`src/theme/fonts.tsx` (`MAX_FONT_SCALE`); `SettingsScreen`, `ChatScreen`,
`chat/{ChatAssistantBody,markdown}`, `InstrumentsScreen`,
`timeline/{DomainCard,TimelineCardView}`.

---

## D21 — Marker expansion (height, BMI, bone density) + local reminders / O7 (2026-06-15)

**Decision:** Two operator-approved additions — capture coverage + a re-engagement layer — built in parallel by `mobile-local-data-modeler` + `mobile-app-shell`.

**Marker capture (O2/O5 surface; all `provisional: true`, LOINC NLM-verified 2026-06-15):**
- **Height** (8302-2) in the Body group — universal; enables BMI.
- **Bone density (DXA hip T-score)** (38264-8) in a NEW universal **"Bone health"** group. Deliberately **NOT sex-gated**: men get osteoporosis/DEXA too, so hiding a value a man already has would be wrong; women's relevance is delivered via reviewer-gated interpretation + the preventive cadence layer, per `docs/design/biomarkers-longitudinal-v1.md` §3. Required **signed-number entry** (T-scores are negative): a `signed?: boolean` field flag read by `LogMarkerScreen` (numbers-and-punctuation keyboard, "-1.5" placeholder); unsigned fields still reject negatives (unit-tested).
- **BMI** — derived (kg/m²) from latest height + weight, displayed as a **NUMBER ONLY**. WHO BMI categories and WHO T-score bands (osteopenia/osteoporosis) are interpretation — reviewer-gated, deferred, NOT added. Estradiol / FSH / hemoglobin were considered but **held as reviewer proposals** (clinical-SET expansions, never CC-invented).

**Local reminders (new scope O7 — Venkata-ratified 2026-06-15):** `expo-notifications` **LOCAL scheduling only** (DATE triggers). NO push tokens, NO server, NO network — nothing leaves the device (invariant 1). NO PHI in any notification title/body — generic nudges only. Opt-in, OFF by default, persisted in `expo-secure-store`; cadence (idle nudge + monthly) computed on-device from the last local log date; quiet-hours clamp. "Check-in reminders" toggle in a new Settings "Reminders" section.

**Verification:** tsc 0, eslint 0 errors, 927 unit tests green. `clinical-boundary-reviewer` PASS (one WARN fixed: a bone-density entryHint that asserted normalcy → reworded to data-quality only). `mobile-privacy-invariant-guard` PASS on all six invariants. `acceptance-auditor`: REPORT MAY SHIP (9/9). On-device (emulator, native rebuild for the new native module): Reminders toggle ON → OS channel created + a local `RTC_WAKEUP` alarm scheduled; bone-density entry accepts a negative T-score (−2.3); Height + Bone-health groups render. On-device caught + fixed a `sound: "default"` channel bug (a sound string is read as a missing custom-sound file → omit it / use `true`).

**Future-session rules:** reminders stay **LOCAL-only + no-PHI-in-payload** (a push/server reminder would violate invariant 1); **bone density stays universal** (not sex-gated); new markers need NLM-verified LOINC + `provisional: true`; interpretation (BMI category, T-score bands) is reviewer-gated — never invented in code.

**Encoded in code:** `src/screens/markers/{markerCatalog,bmi,LogMarkerScreen}`, `src/screens/timeline/{DomainCard,displayMapping}`, `src/notifications/{scheduler,cadenceHelpers,useReminders}`, `SettingsScreen`, `app.config.ts`.

---

## D22 — "Due for…" preventive-cadence card scaffold (2026-06-15)

**Decision:** Wire the already-shipped (empty) USPSTF preventive engine to a dashboard surface — the "Due for…" card — so it lights up the moment a recommendation set lands, with the governance baked in now.

**Built:**
- **`DueForCard`** (dashboard card): renders each due screening's title + summary (from the rec, never invented) + a factual cadence/last-logged meta line + the operator-locked referral verb "Talking with your doctor could help." EXPLAINS, never directs. Renders NOTHING when nothing is due.
- **Dashboard wiring**: a "Due for" section computed via `dueScreenings({sexAtBirth, ageYears, lastDoneByRecId, now})`, shown only when `due.length > 0`. `lastDone` resolves from LOCAL observations via the new pure `deriveLastDoneByRecId` + an additive `observationCodes?` link on `PreventiveRecommendation` (no PHI leaves the device).

**Governance baked in (clinical-boundary-reviewer WARNs, fixed now):**
- `provisional` is now a **REQUIRED** field on `PreventiveRecommendation` — no rec can be merged into `PREVENTIVE_RECOMMENDATIONS` without the governance marker.
- `DueForCard` renders `‡` adjacent to each title while `rec.provisional`, matching the per-item pattern on DomainCard/TimelineCardView; the dashboard's standing "‡ Interpretation pending clinical review." footnote is the legend.

**Still gated:** `PREVENTIVE_RECOMMENDATIONS` ships **EMPTY** — the recommendation SET + cadences are clinical content sourced from the USPSTF API / a named clinical reviewer (USPSTF access AHRQ-pending). The card is invisible in production until that lands. CC never hand-authors recs.

**Verification:** tsc 0, eslint 0 errors, 940 unit tests (incl. `deriveLastDoneByRecId` + `dueForFormat`). clinical-boundary-reviewer PASS (two forward-looking WARNs fixed). acceptance-auditor: REPORT MAY SHIP (6/6). On-device: dashboard renders, "Due for" section correctly ABSENT (empty recs).

**Encoded in code:** `src/preventive/{uspstf,DueForCard,dueForFormat}`, `src/screens/HealthDashboardScreen`.

---

## D23 — WHO BMI + bone-density T-score interpretation bands (2026-06-15)

**Decision:** Supersede D21's "value only" deferral — ship WHO-sourced interpretation bands for BMI and the bone-density hip T-score, **provisional, behind ‡**, pending a named clinician's sign-off. Operator-approved (use WHO where it fits).

**What landed (in the versioned `tableV1.ts` `biomarkers` map — the first biomarker interpretation entries):**
- **BMI (LOINC 39156-5)** — WHO adult classification: underweight `<18.5` / healthy `18.5–24.9` / overweight `25.0–29.9` / obesity `≥30`. Uniform strategy. Cited to WHO TRS 894.
- **Bone-density hip T-score (LOINC 38264-8)** — WHO 1994: osteoporosis `≤-2.5` / low bone mass `-2.5…-1.0` / normal `≥-1.0`. Cited to WHO TRS 843. A `clinicalReviewerNote` flags that WHO T-score criteria are validated for postmenopausal women + men ≥50 (younger uses Z-scores) — the reviewer decides an age/sex gate before clearing ‡.
- Bands are contiguous for **1-decimal** values (BMI rounds to 1 dp; T-scores reported to 1 dp); an off-decimal value falls between bands → renders raw (no wrong band). New `BandId`s + calm "watch" tints (osteoporosis stays "watch", not "alarm" — clinical surfaces stay calm; reviewer escalates via the per-band `tint` override).
- **Display:** the dashboard health-markers card renders the BMI category pill + `‡`. (T-score band content + lookup are in place + tested; its per-marker detail display is the next small step.)

**Governance (load-bearing):** every band ships `provisional: true`; the entry provenance is `pending_clinical_review`; `lastClinicallyReviewedBy` stays `null`. **CC never clears the ‡** — a named clinician flips provisional→reviewed. This decision lifts only the *deferral* (the bands may now be authored + displayed provisionally), not the sign-off requirement.

**Verification:** tsc 0, eslint 0 errors, 946 unit tests (incl. boundary tests for every WHO cut-off). clinical-boundary-reviewer **verified all WHO cut-off values are correct** and PASSed string sourcing / register / provisional mechanics; its lone BLOCKER was this very governance update (the CLAUDE.md D21 rule + stale comments), now resolved here.

**Encoded in code:** `src/screens/timeline/interpretation/tableV1.ts` (bands + biomarkers map), `src/screens/timeline/pill.ts` (BandId tints), `src/screens/timeline/DomainCard.tsx` (BMI pill).

---

## D24 — Marker-entry guardrails + feet/inches height input (2026-06-16)

**Decision:** Harden the manual marker-entry surface — operator-flagged on-device: a 555 cm height was only *soft-warned* ("looks unusual — double-check it") with Save still enabled, and cm/total-inches is not how a US 45+ user enters height.

**Guardrails (all markers):** validation is now **LIVE** (per keystroke) via pure helpers (`validateField`, `deriveCanSave` in `markerEntry.ts`); the **Save button is DISABLED** (dimmed + no haptic/press-scale) whenever any field is empty, non-numeric, or outside the field's physical `plausible` range; the error states the **valid range in the active unit** ("Enter a value between 50 and 250 cm."). The `plausible` bound is the hard gate — implausible values cannot be saved. `PressableScale` gained `disabled`-awareness so a blocked CTA never feels tappable.

**Feet/inches:** height offers a two-field **`[ft] [in]` input as the DEFAULT** (cm secondary), converting `cm = (feet*12 + inches)*2.54` (`feetInchesToCm`, unit-tested; 5′9″ = 175.26 cm), inches bounded 0–11, stored canonical cm. **Only height changed**: `defaultUnitForField` makes the entry default the ft/in composite for height and the **canonical** unit for everything else (weight→kg, labs→mg/dL).

**Process:** built by an orchestrated implement→adversarial-verify workflow (5 verifier lenses — conversion math / block logic / edge cases / regression / privacy, all PASS — + completeness critic). **On-device caught two issues the verifiers missed:** (1) the disabled Save still buzzed/animated (`PressableScale` not `disabled`-aware) — FIXED; (2) weight silently defaulted to **lb** after the default-unit change (stored pounds-as-kg → BMI 11.8) — FIXED (canonical default for non-ft/in fields, + regression test). `onSave` now re-validates with the same `validateField` as the gate (no weaker fallback); `rangeErrorMessage` carries a rounded 12 in into the next foot.

**Verification:** tsc 0, eslint 0, 1024 tests pass (the lone failure is a **pre-existing flaky** `backup/recoveryKey` BIP39-checksum test — unrelated; passes 5/5 on re-run). On-device: ft/in default + two-field input; 9 ft blocked with "between 1 ft 8 in and 8 ft 2 in" + disabled Save; 5 ft 9 in enables Save + saves; weight defaults to kg; dashboard shows **BMI 26.0 / "Overweight‡"** (also confirms D23's pill).

**Encoded in code:** `src/screens/markers/{LogMarkerScreen,markerEntry,markerCatalog}`, `src/components/PressableScale`.

---

## D25 — Marker display: plain language (no LOINC) + value rounding (2026-06-16)

**Decision:** Operator-flagged on the timeline detail surface (`SingleRowCard`): it showed internal jargon + float noise. Display-layer fix only — storage untouched.

- **No LOINC shown to the user.** Removed the "Reference: LOINC `<code>`" line from the details reveal — LOINC is internal jargon (repo rule: *never show codes to the user*). The plain-language name is the card title; the "Source:" and (for unmapped codes) "Clinical name:" lines remain. The LOINC code stays in the DAL / export.
- **Display rounding.** Values render via `formatMarkerValue(code, value)`: per-marker `displayDecimals` (height 0 → "175 cm", weight 1 → "36.3 kg", creatinine/TSH 2, default 1), trailing zeros stripped. Kills IEEE float noise from unit conversions ("36.287389600000004" → "36.3"). **DISPLAY-ONLY** — `value_num` keeps full precision in storage.

**Verification:** tsc 0, eslint 0, 418 marker+timeline tests (incl. `formatMarkerValue`). clinical-boundary-reviewer run on the diff. On-device: detail shows "80 kg" / "36.3 kg" / "175 cm"; the details reveal shows only "Source: User input" (no LOINC line).

**Encoded in code:** `src/screens/markers/markerCatalog` (`displayDecimals` + `formatMarkerValue`), `src/screens/timeline/TimelineCardView` (SingleRowCard).

---

## D26 — BMI trend chart + generalized band-line renderer (2026-06-16)

**Decision:** Operator asked whether the Health-markers detail should be a graphical trend (like the Mood chart) rather than a wall of value cards, and whether BMI bands segregate by age/gender. Answer recorded: **adult BMI is uniform** — WHO defines no validated age/sex-specific adult BMI standard (pediatric BMI-for-age is the only age/sex BMI, out of scope). So the BMI chart reuses the same uniform-band line chart as the instruments, with no cohort branching.

**Renderer generalized (no regression).** `ChartSvg` → exported **`TrendChartSvg({ width, points, scoreRange, bands, redesign, fontsLoaded })`** — band set is now a prop, not instrument-derived. The instrument `TrendChart` resolves `chartBandsFor(instrumentId, sex)` and passes it; geometry is unchanged. Band tiling moved into a pure, unit-tested **`layoutBandScores(bands, scoreRange)`** (`sessions.ts`): bands fill the **half-step-padded** domain `[min-0.5, max+0.5]` with interior boundaries at adjacent-band **midpoints**. For integer instrument bands this is **identical** to the legacy ±0.5 tiling (PHQ-9 `[0,4][5,9]…` → edges -0.5/27.5, boundaries 4.5/9.5/… — pinned by a regression test); for decimal BMI bands (18.4/18.5, 24.9/25.0, 29.9/30.0) it tiles with no gap/overlap.

**BMI chart.** `BmiTrendChart.tsx`: `deriveBmiTrend(rows)` (DERIVED BMI, score = bmi) → range-filtered via the same `rangeStartIso` UTC math → `TrendChartSvg`. Bands from `INTERPRETATION_TABLE_V1.biomarkers["39156-5"]` (WHO, uniform, **provisional**, ‡ via the standing disclaimer — D23). Delta from the versioned `formatBmiTrendDelta` (1 dp). n<2 → quiet state. Wired in `DomainDetailScreen` ABOVE the value cards, only for the `health_markers` single-domain with ≥1 BMI point; instrument `trend` item untouched.

**Line-inside-the-plot fix (operator-reported).** The fixed `[15, 40]` axis clipped any BMI outside it (e.g. a stale 11.8 from the lb-as-kg bug, or severe obesity >40) OUTSIDE the chart. Axis is now **data-aware**: `scoreRange` = union of the WHO band range `[15,40]` and the plotted data min/max (±1-unit margin) — every band still shows AND no dot ever renders outside the plot. The axis is **display chrome only** — defined in `BmiTrendChart.tsx`, never added to the clinical interpretation table.

**Process:** built by an implement→adversarial-verify workflow. The #1 verifier caught a real **instrument-chart geometry regression** the generalization introduced (the half-step Y-padding was dropped) — FIXED by restoring `lo=min-0.5/hi=max+0.5` and pinning it with the `layoutBandScores` integer-band test. Final acceptance-auditor: **REPORT MAY SHIP** (R1–R6 all PASS, clinical invariants intact). On-device: BMI line sits INSIDE the plot (11.8 dot in Underweight, rising to 26.0 in Overweight); the Mood/instrument chart renders **pixel-identical** to before (no regression).

**Verification:** tsc 0, eslint 0 errors, **1044 tests** pass.

**Encoded in code:** `src/screens/timeline/trend/{TrendChart,BmiTrendChart,sessions}.ts(x)`, `src/screens/timeline/interpretation/trendStrings.ts` (`formatBmiTrendDelta`), `src/screens/DomainDetailScreen.tsx`.

---

## D27 — Health-markers detail: latest-per-marker cards, not card-per-entry (2026-06-16)

**Decision:** Operator: *"when a user adds BMI data — every day/week/month — we should not create one card for every day but instead create a chart alone and show the latest data in the cards … multiple data dots in the chart. agree?"* Agreed. The markers detail previously emitted **one card per observation** (logging weight daily → a wall of weight cards). It now shows **one card per marker (the latest reading)** under a single "Latest readings" label; the **trend chart carries the full history** (every dot).

- **Chart = history; cards = latest snapshot.** New pure helper `latestPerCode(rows)` (`src/screens/markers/latestPerCode.ts`, unit-tested) collapses to one row per LOINC code, newest-first, deterministic tie-break (`effective_at → recorded_at → id`). It feeds **only the card list** — `BmiTrendChart` is still passed the FULL unfiltered `mine.rows`, so every reading still plots as a dot. On-device: two weights (80 kg + the stale 36.3 kg) → one "Weight 80 kg" card + a 2-dot BMI line (11.8→26.0).
- **Scope: `health_markers` only.** `health_history` (diagnoses — each a distinct fact, not a "latest value") and instrument domains (each session meaningful) KEEP the date-bucketed, all-entries view. Date-bucketing is dropped for markers on purpose — each marker's latest reading has its own date (shown on the card), so buckets would fragment to one card each. A flat "Latest readings" label replaces the date headers.
- **Not a clinical-display change.** Touches no interpretation string, band, pill, headline, disclaimer, ‡, or 988 path — the only new string is the navigation label "Latest readings". TimelineCardView/SingleRowCard rendering is unchanged. So the clinical-boundary-reviewer trigger is not met; this is display organization, not clinical content. Storage is untouched (append-only DAL + export keep every reading) — the helper selects by recency, never mutates or drops a stored row.
- **Disclosed tradeoff + follow-up.** For markers WITHOUT a trend chart yet (labs other than BMI), older readings no longer show as cards — they remain in storage/export and will surface when those markers get their own charts, or via a future **"show all readings" expander**. BMI/weight history is already fully visible (the chart's dots).

**Verification:** tsc 0, eslint 0 errors, **1050 tests** (1044 + 6 new `latestPerCode` pins). On-device (clean relaunch, served-bundle grep confirmed fresh): markers detail shows BMI chart → "LATEST READINGS" → one Weight card (80 kg) + one Height card (175 cm); no duplicate weight card; disclaimer + ‡ intact.

**Encoded in code:** `src/screens/markers/latestPerCode.ts` (+ test), `src/screens/DomainDetailScreen.tsx` (`isMarkers` branch + `label` list item).

---

## D28 — Per-marker history drill-down + generic/band-less marker chart (2026-06-16)

**Decision:** Follow-up to D27 (latest-only marker cards). D27 hid the older readings of non-charted markers; operator approved a drill-down (chosen over inline-expander / stacked-charts via a previewed decision) where tapping a "Latest readings" card opens a per-marker history screen. This both gives every marker its own chart (the open "weight chart" follow-up) AND surfaces the hidden history (the open "show all readings" follow-up) in one robust capability.

- **Generic per-marker chart, band-aware.** `MarkerTrendChart` plots one LOINC code's stored readings, reusing the shared `TrendChartSvg`. Bands come from `INTERPRETATION_TABLE_V1.biomarkers[code]` when present (BMI, bone-density); otherwise the chart is **band-less** — a plain factual line with value gridlines, the clinically honest default for a raw value (weight, waist) that has **no validated cutoffs** (never an invented band).
- **Band-less support is additive + regression-safe.** `TrendChartSvg` gained an OPTIONAL `yRefs` prop (dashed value gridlines + left labels). Banded charts (instruments, BMI) omit it → `(yRefs ?? []).map` is empty → their render is **byte-identical** (re-verified on-device: Mood chart pixel-identical). `layoutBandScores([])` already returns `[]`, so band-less needed no band-path change.
- **Axis math is a pure, pinned helper.** `deriveMarkerChartModel` (`markerChartModel.ts`, unit-tested) computes the data-aware axis (the BMI "line outside the chart" bug class, D26): band-less → data extent; banded → union with the bands' finite bounds so every band shows and an out-of-band value is never clipped. `yRefValues` = data min/max for band-less, null for banded.
- **Drill-down navigation.** New `MarkerDetail: { code }` route. `TimelineCardView`/`SingleRowCard` gained an OPTIONAL `onPress` — when set the whole card navigates with a "View history ›" cue instead of the inline expander; absent → byte-identical expand behavior (every existing caller unchanged). `DomainDetailScreen` passes it ONLY for `health_markers` single cards.
- **MarkerDetailScreen.** Header + range control + `MarkerTrendChart` + "All readings" (every reading: date + value+unit via `formatMarkerValue` + source) + standing disclaimer/‡. Read-only (loads via DAL, filters to user + code); storage/export untouched. This is where D27's collapsed history lives.
- **Clinical strings versioned.** New `formatMarkerTrendDelta` in `trendStrings.ts` — factual ("Your Weight moved from 36.3 kg to 80 kg since …"), no advice/comparison verb, "unchanged" decided by the displayed labels matching the card.

**Verification:** tsc 0, eslint 0 errors, 1071 tests (markerChartModel + generic-delta pins). On-device (clean relaunch, fresh bundle): tap Weight → band-less weight chart (line inside plot, 80/36.3 kg gridlines) + "ALL READINGS" (both entries dated+sourced); Mood instrument chart pixel-identical. Adversarial workflow (clinical-boundary / acceptance / privacy / regression) run on the diff.

**Encoded in code:** `src/screens/MarkerDetailScreen.tsx`, `src/screens/timeline/trend/{MarkerTrendChart,markerChartModel}.ts(x)` (+ tests), `src/screens/timeline/trend/TrendChart.tsx` (`yRefs`), `src/screens/timeline/TimelineCardView.tsx` (`onPress`), `src/screens/DomainDetailScreen.tsx`, `src/navigation/{types,RootNavigator}.tsx`, `src/screens/timeline/interpretation/trendStrings.ts`.

---

## D29 — BMI obesity split: WHO class III (severe obesity ≥40) (2026-06-16)

**Decision:** The single "Obesity range" band (≥30) collapsed WHO's three obesity classes into one. WHO TRS 894 defines obese class I (30.0–34.9), II (35.0–39.9), **III ≥40.0**. Split the band into **Obesity (30.0–39.9)** + new **Severe obesity (≥40.0)** so the chart is WHO-accurate and flags the Class-III / highest-risk threshold instead of hiding it inside "obesity."

- `tableV1.ts`: `obesity` band `maxScore` → 39.9 (explanation "30.0 to 39.9 … classes I and II"); new `severe-obesity` band ≥40.0 (pill "Severe obesity", explanation "40.0 or higher … class III"), `provisional: true`. `BMI_SOURCE` updated to cite the class breakdown. New `"severe-obesity"` `BandId`.
- `pill.ts`: `severe-obesity` → `"watch"` tint, consistent with the documented "WHO out-of-range bands stay calm (watch), reviewer may escalate via per-band `tint` before sign-off" rule.
- **No ‡ cleared.** Every BMI band stays `provisional: true`; `lastClinicallyReviewedBy` still null. CC never clears the ‡ (mobile/CLAUDE.md). Bands remain contiguous for 1-dp values (39.9 / 40.0).

**Verification:** tsc 0 (exhaustive `BandId`/pill switch), 1071 tests incl. lookup pins (BMI 35→obesity, 42→severe-obesity, boundary 39.9/40.0, provisional + WHO pill, age/sex-uniform). On-device: BMI chart renders the 5-band set cleanly (obesity 30–39.9; severe-obesity a thin top sliver when no data approaches 40). clinical-boundary-reviewer run on the diff.

**Encoded in code:** `src/screens/timeline/interpretation/tableV1.ts` (BMI bands + `BandId`), `src/screens/timeline/pill.ts` (tint).

---

## D30 — Instrument domain detail consolidation + check-in history drill-down (2026-06-16)

**Decision:** Operator asked whether the consolidation (D27/D28) held across ALL cards. Audit (code + on-device) found it did NOT: instrument domain details (Mood, Anxiety, Sleep, Alcohol, Urinary, Menopause, Hormonal) still rendered **every check-in as a card** (date-bucketed) on top of the trend chart's dots — the same wall-of-cards redundancy D27 removed for markers (D27 had scoped itself to `health_markers`). Aligned instruments to the markers pattern.

- **Latest-card + chart + drill-down.** The instrument detail now shows the trend chart (every check-in as a dot) + a single **"Latest check-in"** card; the full date-bucketed session list moved to a new **`InstrumentHistory`** screen, reached by tapping the card ("View past check-ins ›"). Mirrors markers → `MarkerDetail` (D28). `health_history` still lists every diagnosis (distinct facts, not a "latest value") — unchanged.
- **Load-bearing: chart from ALL sessions, not the rendered card.** The chartable-instrument set is computed from every session, not the (now single) latest card — so a Mood domain whose LATEST session is the non-chartable PHQ-2 gate still charts PHQ-9. Pinned by `instrumentDomainView` (pure helper) + its test. PHQ-2 stays gate-only (never charted, per 2026-06-12).
- **Navigable card is additive.** `InstrumentSessionCard` (and `SingleRowCard`, D28) take an OPTIONAL `onPress`: when set the whole card navigates with a "View …›" cue and no inline expander; absent → byte-identical expand behavior. `InstrumentHistory`'s cards omit `onPress` → expandable (per-item breakdown preserved there). Single-session domains pass no drill-down (`hasHistory` false).
- **No clinical-content change.** Reuses `TimelineCardView`'s existing rendering; no new bands/strings/pills/disclaimers/‡/988. Read-only; storage/export untouched.

**Verification:** tsc 0, eslint 0 errors, **1076 tests** (5 new `instrumentDomainView` pins incl. the latest-PHQ-2-still-charts-PHQ-9 invariant). On-device: Mood detail → chart + one "Latest check-in" card + "View past check-ins" → `InstrumentHistory` (all sessions, expandable); chart renders PHQ-9 despite the latest being PHQ-2. **Maestro** `consolidation.yaml` (new): full drill-down path on both instruments + markers — all assertions pass.

**Encoded in code:** `src/screens/timeline/instrumentDomainView.ts` (+ test), `src/screens/InstrumentHistoryScreen.tsx`, `src/screens/DomainDetailScreen.tsx`, `src/screens/timeline/TimelineCardView.tsx` (`onPress` on `InstrumentSessionCard`), `src/navigation/{types,RootNavigator}.tsx`, `mobile/maestro/flows/consolidation.yaml`.

---

## D31 — Settings "Your details": read-only demographics (2026-06-16)

**Decision:** Operator: the mobile Settings had no age / sex / year-of-birth fields, and asked to "add them and grey them out if a user has added them." Added a read-only **"Your details"** section to `SettingsScreen` showing Year of birth (+ derived age), Sex at birth, Gender identity, and Medicare — values pulled from the local profile (`getProfile`), displayed greyed (`ink2`), with a "Set during sign-up." note. Labels via a pure, unit-tested `demographicsDisplay` helper (mirrors the cohort-onboarding option labels so Settings and onboarding never disagree). Display-only — storage untouched.

**Premise correction (editing is safe — recorded for the deferred edit feature):** the operator worried that *changing* demographics would force a sign-out + re-login and risk losing data. It does NOT: `upsertProfile` is a purely local write, and `signOut()` only clears auth tokens — the encrypted on-device SQLCipher DB persists (verified on-device: logging out then back in with the same account preserved all observations). So read-only is a deliberate v1 choice, not a constraint.

**Deferred — in-place editing (planned):** safe to add whenever. Clinical nuance to honor when it lands: `sex_at_birth` and `birth_year` are clinical interpretation keys — changing them re-interprets existing results (AUDIT-C sex bands, age-sex ranges) and re-gates cohort markers/instruments (PSA/menopause/ADAM), so edits to those must be deliberate (a confirm/warning). `gender_identity` is display-only (non-clinical) and free to edit. `is_on_medicare` drives cohort gating.

**Verification:** tsc 0, eslint 0 errors, **1095 tests** (19 new `demographicsDisplay` pins). On-device: Settings → "Your details" shows the profile demographics read-only/greyed with derived age.

**Encoded in code:** `src/screens/demographicsDisplay.ts` (+ test), `src/screens/SettingsScreen.tsx`.

---

## D32 — Settings demographics: editable gender + Medicare; permanent year + sex (2026-06-16)

**Decision:** Operator's rule for the D31 "Your details" section: **gender identity + Medicare are editable** in Settings; **year of birth + sex at birth are permanent** (locked) because they're clinical interpretation keys — changing them would re-interpret all existing results. Permanence is communicated at sign-up (the confirmation is D33).

- **Editable (in-place, local):** Gender identity (a tap-to-expand inline picker of the 7 options) and Medicare (Yes/No). On select → `upsertProfile({ id, email, ...patch })` (merges by id) + local state update. No sign-out, no data loss. Gender identity is display-only (non-clinical); Medicare drives cohort gating, not clinical interpretation — both safe to change.
- **Locked:** Year of birth + sex at birth render greyed with a lock icon and no edit affordance. Section note: "Year of birth and sex at birth are set at sign-up and can't be changed. Gender identity and Medicare can be updated anytime."
- The editable values render in full `ink` (look active) vs the locked fields' greyed `ink2`; a chevron signals the picker.

**Verification:** tsc 0, eslint 0 errors, **1096 tests** (`GENDER_IDENTITY_VALUES` completeness pin added). On-device: gender round-trips Male→Female→Male (persists via `upsertProfile`); year/sex stay locked (lock icon, no picker); Medicare uses the same verified path.

**Encoded in code:** `src/screens/demographicsDisplay.ts` (`GENDER_IDENTITY_VALUES`), `src/screens/SettingsScreen.tsx` (editable rows + inline pickers + `onEditDemographic`).

---

## D33 — Onboarding confirmation: year-of-birth + sex-at-birth are permanent (2026-06-16)

**Decision:** Pairs with D32 (those two fields are locked in Settings). At sign-up the user must now **explicitly confirm** year of birth + sex at birth are correct and acknowledge they can't be changed later — they're clinical interpretation keys, so an after-the-fact change would re-interpret all existing results (the operator's framing: "to change, they'd have to start over and lose their data").

- **New step 5 (confirm).** `CohortOnboardingScreen` goes 4 → 5 steps. Gender selection (and Skip) now ADVANCE to the confirm step instead of submitting; `confirmAndSubmit` writes the profile only after the user taps Continue on the confirm screen. The confirm screen (a `OneItemScreen`) shows a summary of the two permanent fields + the warning copy; Back returns to fix them. Gender + Medicare are NOT part of the gate (editable later, D32).
- **Closure-safe.** Gender handlers reduced to stable `setState` dispatchers (`[]` deps); `confirmAndSubmit` takes live state via deps + `decideCohortSubmission` (unchanged). No new submit path — just deferred behind the acknowledgement.
- **Maestro flows updated.** `signin_onboarding.yaml` + `crisis_988.yaml` add the `cohort_confirm_summary` assertion + the confirm `oneitem_continue_button` tap between gender and Intake.

**Verification:** tsc 0, eslint 0 errors, **1096 tests** (cohort/decision tests unchanged + green). On-device confirm-step check is deferred to the next FRESH onboarding (re-triggering it requires clearing state, since the current account is already onboarded) — covered by the test-OTP CI sweep, or a deliberate re-onboard.

**Encoded in code:** `src/screens/CohortOnboardingScreen.tsx` (step 5 + `confirmAndSubmit` + gender handlers advance), `maestro/flows/{signin_onboarding,crisis_988}.yaml`.

---

## D34 — Confirm-step polish: crisp copy + editable-until-Continue (2026-06-16)

**Decision:** Operator review of the D33 confirm screen: the warning read as one dense paragraph, and the permanent fields were only correctable via Back. Two fixes:

- **Crisper, split copy.** The single paragraph became four short, scannable lines: "These guide how we read your results." / "Fix them now — after Continue they can't be changed." / "Changing them later means starting over and losing your data." / "Gender and Medicare stay editable anytime in Settings." (Two lead lines `ink2`, two muted `ink3`.)
- **Editable until Continue.** Year of birth + sex at birth are now **tap-to-edit inline** on the confirm screen (the fields aren't locked until Continue, so they should be correctable there, not only via Back). Tapping the year row reveals an inline number input; tapping the sex row reveals the 3 sex options; selecting/blurring collapses back to the summary. `Continue` is gated on a valid year (1900–current) + a chosen sex. The edit writes the same `birthYearStr`/`sexLikert` state the earlier steps use, so it's consistent and `confirmAndSubmit` reads the corrected values.

**Verification:** tsc 0, eslint 0 errors, 232 cohort/onboarding tests pass. On-device visual of the polished confirm + tap-to-edit is at the next fresh onboarding (re-triggering needs a clear-state; the current account is onboarded).

**Encoded in code:** `src/screens/CohortOnboardingScreen.tsx` (confirm step `confirmEdit` state + inline editors + `birthYearValid` gate + crisp copy/styles).

---

## D35 — A11y 45+ floor + one-attention-item (design reconciliation) (2026-06-17)

**Decision:** Operator handed a longitudinal-health design proposal; we reconciled it against the codebase (Phases 1–3) and adopted only the measured wins. Most principles were already satisfied (≤5 tabs, status text+color via pills, plain-language readouts, AA contrast tested, one primary action). Three adopted, on branch `feat/mobile-a11y-45plus`:

- **Touch targets → ≥48px (principle 8).** Audited every interactive `minHeight`/`minWidth` and bumped the ~25 remaining `44`s to `48` across 14 files (back chips, CTAs, list rows, cards). Non-interactive dims (14/50/52) untouched. Guarded by a source-scan test (`a11y.test.ts`).
- **Body base 16 → 17px (principle 8).** One token (`tokens.ts` `sizes.base`). Dynamic Type still respected (MAX_FONT_SCALE caps chrome only). Does NOT touch the colors-only token-drift test. On-device visual pass: no layout breakage.
- **One attention card on Today (principle 7).** A single compact callout (one row, fixed area) at the top: a **light-grey (`pillSoft`) card with a thin red (`alarm`) border, no icon** (the red border alone signals severity — operator review iterated off earlier left-accent-bar / alarm-wash / alert-icon versions) holding up to **4 severe domain names as borderless, individually-tappable red text chips**, with a "+N" (a11y-labelled "N more in the severe range") when more than 4 are severe. The row **never wraps to a second line** — `attentionChips` is `flexWrap: "nowrap"`, each chip is `numberOfLines={1}` + `flexShrink: 1`, so names truncate (they never do at 4 short domain names) rather than spill. It NEVER stacks N cards (the pile-up principle 7 forbids); the other severe domains stay in the grid with their own pills. `severeDomains` returns ALL `alarm`-tint domains and the render `slice(0, 4)`s them, reusing the cards' own `lookupInterpretation` + `tintClassForBand` so callout and card can never disagree. NO new clinical copy (the chip is the versioned domain name; the band pill is read via lookup); each chip → its domain detail where the full reading + any 988 path live. Chips use vertical `hitSlop` to reach the 48px tap floor without horizontal overlap. Grid NOT reordered. Markers (watch tint) never trigger it. **On-device (Maestro):** verified at 2/3/4 severe domains (Mood/Anxiety/Sleep/Alcohol via all-max check-ins) — all one row, no wrap; chip-tap routes to the domain detail.
- **Refactor:** `tintClassForBand` extracted to RN-free `bandTint.ts` (pill.ts re-exports it) so the node-only attention helper + test don't drag in react-native. Byte-identical logic; all callers unchanged.

**Rejected (with rationale):** dedicated Trends tab (our sparkline-glance + per-domain drill-down already cover it for a many-domain IA); Meds archetype (Phase 1 isn't a med manager); trend event-annotations (sparse self-reported events; defer).

**Verification:** tsc 0, eslint 0 errors, **1103 tests** (new `a11y` acceptance + `dashboardAttention` pins). On-device: severe check-in → the callout surfaces at the top; body bump renders without breakage.

**Encoded in code:** `src/theme/tokens.ts` (base 17), ~14 screens (targets 48), `src/screens/timeline/{dashboardAttention,bandTint}.ts` (+ tests), `src/screens/HealthDashboardScreen.tsx` (callout), `src/screens/timeline/pill.ts` (re-export), `src/theme/__tests__/a11y.test.ts`.

## D36 — Upload analysis: report-only interpretation + free-form + post-parse naming (2026-06-17)

**Decision:** Reworked the upload→parse→review surface around "interpret only what the report prints; never diagnose," plus free-form upload and post-parse naming.

- **No-diagnosis summary.** `/api/parse-report` summary prompt forbids diagnosis; the review screen shows a deterministic report-only `summarizeReport()` and the model's free-text summary is sealed off the client wire type. Stored report summary is a factual count.
- **Sourced RAG chips.** New `reference_range` + `abnormal_flag` parse fields the model COPIES from the report (never infers); `ragForObservation` (`src/upload/reportInterpretation.ts`) maps the report's own flag → ok/watch/alarm chip via the band `tintByClass`, with a source_text flag-word fallback; no flag stated → no chip. Caveat composed from `STANDING_DISCLAIMER`.
- **Free-form upload.** Removed the lab/ehr/visit picker — the per-observation `category` already classifies each value; report-level `type` is invisible metadata, defaulted.
- **Post-parse naming (additive contract change).** Naming moved to the review screen, pre-filled from the report's own dominant date (`suggestNameFromObservations`), persisted via a NEW DAL method **`renameReport(id, name)`** — report METADATA only (same mutation surface as `updateReportParseStatus`; observations stay append-only). Contract edited via the documented rm-marker → additive-edit → re-touch procedure; test fakes (`smoke.test.ts`, `backupService.test.ts`) updated.
- **Post-save results summary.** After Save the review screen shows a "✓ Saved to your record" recap (kept values + RAG chips + the name) instead of silently popping back.

**Reviewed:** clinical-boundary-reviewer PASS (no blockers) on the analysis diff; two WARNs (latent model-summary field; bespoke caveat) fixed.

**Open follow-up:** the parser still extracts narrative DIAGNOSES as `condition` observations (e.g. "Unspecified liver disease due to alcohol") — a backend extraction-prompt fix that needs a staging deploy. Users can Skip such rows in review meanwhile.

**Verification:** app tsc 0 + 21 parse-report tests; mobile tsc 0, eslint 0, **1117 tests**. On-device: upload → report-only summary + sourced chips → name → Save → saved recap.

---

## D37 — Settings account deletion + legal links (2026-06-18)

**Decision:** Add the App Store / Play Store-required **account deletion** flow and the three legal links to mobile Settings. Tapping "Delete account" raises a destructive-confirm `Alert` ("Delete your account?" / body "This permanently deletes your account and all your health data — on this device and on our servers. This can't be undone." / Cancel + destructive Delete). On confirm: `DELETE /api/account/delete` (server cascade + Cognito `AdminDeleteUser`) runs FIRST, then the full local wipe (D38), then `navigation.reset` to `SignIn`. Server-first ordering means a failed server delete never silently wipes the device while the account still exists upstream.

**Admin self-delete is blocked server-side.** The route does `SELECT is_admin FROM users WHERE id = $1` and returns 403 `{error:'Admin accounts cannot be deleted through the app.'}` for admins — mirroring the web app's "admins can't self-delete" rule (CLAUDE.md § Privacy). Surfaced in-app as **"This account can't be deleted from the app."** (the 403 is caught and mapped to that copy; the local wipe does NOT run on a 403).

**Legal section** — three links, all pinned to the PROD host `https://denali.health` regardless of the API base (the API base may be staging, but the legal pages are prod-canonical and all three return 200 on prod):
- Terms → `https://denali.health/terms`
- Privacy → `https://denali.health/privacy`
- Notice of Privacy Practices → `https://denali.health/hipaa`

**Why:** account deletion is a hard App Store / Play Store submission requirement; the legal links are the standard store-review compliance set. Both are net-new mobile-only surfaces — the web app already had the delete cascade route.

**Encoded in code:** `src/screens/SettingsScreen.tsx` (Delete-account row + confirm Alert + legal links), `src/db/wipe.ts` (`wipeAllLocalData`, D38). Commit `e717540`.

---

## D38 — Local account-delete wipe: best-effort, and the WAL-checkpoint finding (2026-06-18)

**Decision:** `mobile/src/db/wipe.ts` `wipeAllLocalData()` performs the on-device side of account deletion (D37). It is **FULLY best-effort / never-throws** — every step is try/catch-guarded so a transient on-device failure can't strand the user *after the server account is already gone* (D37 runs the server delete first). Commits `e717540` + `051deaf`; unit-tested in `8640315`.

**Steps, in order:**
1. `PRAGMA secure_delete = ON` — overwrite freed pages rather than just unlink.
2. `DELETE FROM "<table>"` for **every user table** (quoted identifier; the table list excludes `sqlite_%` internal tables and `schema_migrations`).
3. `VACUUM` — rebuild the DB to physically reclaim/overwrite the deleted pages.
4. `PRAGMA wal_checkpoint(TRUNCATE)` — flush the WAL into the main DB and truncate the `-wal` file to 0 (the load-bearing step, below).
5. `clearAllReportBlobs` — delete the entire encrypted reports blob directory.
6. `clearBlobKeyCache` — clear the in-memory derived blob key.
7. `clearTokens` — clear the auth tokens from SecureStore.

**What is intentionally KEPT:** the DB file, the SQLCipher key, and `schema_migrations`. The live connection stays valid for a clean re-onboard, and an **empty encrypted DB holds no PHI** — so retaining the file + key is safe and avoids tearing down / re-deriving the connection.

**Load-bearing finding (verified on-device; the reason `051deaf` exists):** in **WAL mode** the `DELETE`s and the `VACUUM`'s rebuild all land in the `-wal` file — the main DB stayed at a single 4 KB page. SQLite only **auto-checkpoints once the WAL passes ~1000 pages**, and a small DB never reaches that, so **without an explicit checkpoint the `-wal` sat at ~1.4 MB of pre-wipe encrypted frames EVEN AFTER a cold app restart**. Because the SQLCipher key is retained by design (above), those leftover WAL frames are recoverable residue — a real PHI-remanence hole. `PRAGMA wal_checkpoint(TRUNCATE)` flushes the WAL into the main DB and truncates the `-wal` to 0. **Verified on-device: `-wal` 1,466,752 B → 0 B**, report blobs gone, SecureStore tokens cleared (5665 B → 826 B).

**Takeaway for any future wipe path:** `secure_delete` + `VACUUM` alone are **INSUFFICIENT** in WAL mode — the `wal_checkpoint(TRUNCATE)` is **mandatory** to evict pre-wipe frames from the `-wal`.

**Test-account note (verification evidence):** `ceeveear@yahoo.com` was the sacrificial **non-admin** account used to prove the wipe end-to-end on **staging**, and is now **DELETED** there. Both operator test accounts (ramanac, ceeveear) were found to be `is_admin = TRUE` on **STAGING** — staging's flags had diverged from the prod values documented in the root CLAUDE.md, and the on-device **403** (D37's admin block) confirmed it. ceeveear's staging `is_admin` was set **FALSE** (via a one-off `denali-staging-dbinit` Fargate task) to reach the server-200 → wipe path, then the account was deleted. (Prod flags are unchanged; this note is staging-only.)

**Encoded in code:** `src/db/wipe.ts` (`wipeAllLocalData`), `src/db/__tests__/wipe.test.ts`. Commits `e717540` + `051deaf`; tests `8640315`.

---

## D39 — Sign-in OTP UX polish (2026-06-18)

**Decision:** Five sign-in OTP improvements, all verified on-device via Maestro. Commits `820a0d3`, `45e200a`, `4b2f0e2`.

1. **Step-aware subtitle surfacing the 10-minute code expiry.** The OTP step shows "Enter the 6-digit code we just emailed you. It expires in 10 minutes." (the email step keeps its own subtitle).
2. **"Resend code" link on the OTP step.** Re-sends to the same email without leaving the step; confirms with "New code sent — check your email."
3. **"Use a different email" now CLEARS the email field.** It previously kept the old value, so re-entry **appended** onto the stale string — a bug fix.
4. **30-second cooldown on Resend.** "Resend code in Ns" countdown, link disabled during it, so rapid taps can't trip the server's send cap.
5. **429-specific message.** "Too many code requests. Please wait a few minutes, then try again." — because `app/src/app/api/auth/send-otp/route.ts` rate-limits to **3 sends per email / 15 min** (and 10 per IP), returning 429.

**Why:** the OTP step gave the user no expiry signal, no recovery if the code never arrived, and a stale-value bug on email re-entry; the cooldown + 429 copy keep the user from hammering (and being confused by) the server send cap.

**Encoded in code:** `src/screens/SignInScreen.tsx` (step subtitle, Resend link + cooldown, different-email clear, 429 mapping). Commits `820a0d3`, `45e200a`, `4b2f0e2`. Maestro-verified on-device.

---

## See also

- Spec: `docs/design/phase-1-45plus.md` (the full Phase 1 build prompt v2).
- Path-scoped rules: `mobile/CLAUDE.md` (auto-loaded under `mobile/`).
- Agent definitions: `.claude/agents/mobile-*.md`.
- Frozen contracts: `mobile/src/contracts/{LocalDataDAL,Theme,ApiClient,index}.ts`.
