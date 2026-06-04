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

## See also

- Spec: `docs/design/phase-1-45plus.md` (the full Phase 1 build prompt v2).
- Path-scoped rules: `mobile/CLAUDE.md` (auto-loaded under `mobile/`).
- Agent definitions: `.claude/agents/mobile-*.md`.
- Frozen contracts: `mobile/src/contracts/{LocalDataDAL,Theme,ApiClient,index}.ts`.
