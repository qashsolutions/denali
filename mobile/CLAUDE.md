# Phase 1 Mobile — Rules & Contracts (auto-loaded under `mobile/`)

This file is loaded automatically whenever Claude Code operates under `mobile/`, concatenated with the root `CLAUDE.md`. Keep edits to it minimal — these rules are load-bearing.

**MANDATORY FIRST READ for every fresh task:** `mobile/docs/review.md` — the
pre-task gate (branch check, OBJECTIVE.md anchor, PLAN-FIRST trigger scan) and
the step Definition of Done (acceptance matrix, on-device evidence,
Confidence/Assumptions/Deviations). Read it in full and run section A before
writing any plan or code; run section C before delivering any step report.
`mobile/docs/OBJECTIVE.md` is the canonical objective doc — if missing,
creating it (then STOPPING for approval) is the first task of the session.

Spec: @docs/design/phase-1-45plus.md (read it before implementing).

---

## Non-negotiable invariants

1. **Local-first.** No health data persisted server-side in Phase 1 — chat included.
2. **Encrypted at rest.** SQLCipher DB; uploaded files stored as encrypted on-device blobs.
3. **Login ≠ encryption key.** The SQLCipher key is generated on-device, stored in Keychain/Keystore, never transmitted, never derived from any Cognito/server secret.
4. **Append-only time-series.** `UNIQUE(user_id, code, effective_at)` + `ON CONFLICT DO NOTHING`; corrections add a superseding row, never UPDATE/DELETE values.
5. **Transient analysis only.** Decrypt → send over TLS → infer → return → store on-device. Nothing persisted server-side. Bedrock invocation logging must be OFF (manual AWS check).
6. **No longitudinal model in Phase 1.** **Cloud backup is permitted only as zero-knowledge backup** — superseded the original "no cloud backup" clause 2026-06-14 (Venkata-ratified; decision D16). The server stores client-side-encrypted ciphertext it cannot decrypt; the decryption key is generated on-device and never leaves the user's devices/keychain. Invariant 1's spirit — no *readable* server-side health data — is preserved. See `docs/design/zk-backup-v1.md` §8.

---

## Engineering rules (durable, learned the hard way)

Operational rules earned from concrete defects in this codebase. CI / lint / hooks enforce where possible; the rest is on the agent. Each rule cites the artifact that backs it.

### Stale-closure class — pure helpers with explicit live state, never via suppression

Auto-advance handlers, modal-acknowledged effects, and any persist-on-last-tap path MUST keep their decision logic in **pure helpers that take live state as explicit arguments**, not in `useCallback` / `useEffect` bodies that close over component state. The closure-stale-on-last-tap class produced the cohort gender dead-end + silent persist losses in PHQ-2 / PHQ-9 + Intake lifestyle.

Enforcement:

- `react-hooks/exhaustive-deps` is **error** in `mobile/eslint.config.js`. CI fails on any violation.
- `eslint-comments/no-restricted-disable` forbids `eslint-disable-next-line react-hooks/exhaustive-deps` (and `rules-of-hooks`) so the exact suppression that hid the original defect cannot return.
- When concurrent paths both call the same persist (modal-ack + line-380 effect both firing `persistInstrument(PHQ9, …)` is the canonical case), wrap with `runOnceInFlight(ref, () => persist(…))` from `src/lib/runOnceInFlight.ts`. Unit-test the once-only invariant; trust the structure, not the gate-by-convention.

### Verification layering — match the assertion to the layer

- **vitest** proves pure logic. It does NOT prove a screen renders, a handler fires, or a tap lands. The Cohort gender dead-end passed every unit test on the helpers it called; the screen still froze.
- **Maestro** is the screen gate. testIDs + accessibilityLabels enumerated in `mobile/maestro/README.md` are the selector contract. Flows under `mobile/maestro/flows/` (Phase-3 work) drive the real surface and are the proof a UI path is end-to-end live.
- **A manual on-device check** proves only the bundle on that device works. Maestro on a CI emulator widens the proof to "every PR".

Pick the assertion that matches the bug's layer. A once-only DB-row invariant belongs in unit tests; a "user can complete onboarding" assertion belongs in Maestro.

### Build freshness — "live" ≠ "fixed code running"

A fast Metro re-bundle (~500–1000 ms) is suspicious. It can be a 304 cache hit, a stale APK with embedded JS, a Fast-Refresh partial graph, or a different Metro instance entirely. Before trusting an on-device check after editing JS:

1. Re-bundle log should read like `Android Bundled 4258ms node_modules/expo/AppEntry.js (1081 modules)` — slow + many modules = cold cache.
2. Grep the served bundle: `curl 'http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=android&dev=true' | grep <new-symbol>` returns matches.
3. If still in doubt: `adb uninstall <pkg>` → `npx expo start --clear` → `npx expo run:android` for a fully clean install.

Stale-build trust cost ~90 minutes of back-and-forth on the cohort dead-end before the clean reinstall surfaced the truth.

### Display + clinical boundary — explain, never recommend

Information-layer rules (load-bearing for HIPAA + clinical safety):

- **Storage is source of truth; display is read-only.** LOINC codes, ICD-10 codes, instrument metadata, `source` provenance all stay in the DAL untouched. Display layers translate codes → plain language; they NEVER strip storage or alter exports.
- **Interpretation strings come from a versioned table, never from render-time code.** `src/screens/timeline/interpretation/tableV1.ts` (and successors) hold every band headline, explanation, pill, and trend statement. Render code looks them up; it never synthesizes wording.
- **Every shipped clinical string carries `provisional: true`** until a named clinical reviewer signs off (`lastClinicallyReviewedBy` non-null). The renderer surfaces `‡` + "Interpretation pending clinical review." until then.
- **Standing disclaimer on every card:** "Information only — not a diagnosis or medical advice."
- **Explain, never recommend.** Strings describe the user's score / value; they do NOT recommend tests, treatments, or actions. "Get tested for X" is forbidden; "talking with your doctor could help" is the referral-verb placeholder, pending an operator-locked final verb.
- **Clinical key is `sex_at_birth`, not `gender_identity`.** All analysis branches on `sex_at_birth`. `gender_identity` is a respect/display field — never an analysis key. Gender-affirming hormone therapy is a clinical-reviewer-note concern carried on the affected entries (`clinicalReviewerNotes`); never auto-applied at render.
- **Age + sex condition analysis where evidence supports it.** Labs / vitals / fitness use age+sex reference ranges via the `age-sex-specific` strategy. Symptom screeners (PHQ-2 / PHQ-9, GAD-7, Epworth) stay UNIFORM — they have validated adult bands; adjusting them invents clinical content. AUDIT-C is sex-specific per Bradley 2007. **NEVER apply an age-specific range when `ageYears` is null** — return null + a `gentleNudge` instead.

### Accessibility & app-lock — don't-undo rules (2026-06-15, D19/D20)

- **Font-scale cap is CHROME-ONLY, never global.** `MAX_FONT_SCALE` (`src/theme/fonts.tsx`) caps OS font scaling on fixed-geometry, non-wrapping labels only — segmented controls, chips, severity pills. Body/content text scales freely (low-vision / 45+ users set large fonts on purpose; content wraps). Never add a global cap; never strip the chrome caps. (React 19 dropped `Text.defaultProps`, so a global cap isn't clean anyway.)
- **Haptics honor Reduce Motion.** `src/feedback/haptics.ts` gates on a `reduceMotion` flag synced from `useReducedMotion()` in `App.tsx` `NavRoot`. Keep `haptics.ts` free of `react-native` imports so it stays node-test-safe.
- **Biometric app-lock is always-on; NO enable/disable toggle.** The Settings "App lock" row is READ-ONLY (reflects device enrollment via `isBiometricAvailable`). A disable toggle would regress the 30-day OTP cap (`src/auth/sessionPolicy.ts`) that the always-on gate justifies — don't add one without revisiting the cap (D15).

### Reminders & marker capture — don't-undo rules (2026-06-15, D21)

- **Reminders are LOCAL-only, no PHI in the payload.** `src/notifications/*` uses `expo-notifications` DATE triggers only — never push tokens, a server, or network. A push/server reminder would violate invariant 1. Notification title/body stay generic nudges ("Check in with Denali") — never a marker name, score, or value (lock-screen leakage). Keep `cadenceHelpers.ts` node-safe (no `react-native` import).
- **Bone density is a UNIVERSAL marker, not sex-gated.** Men get osteoporosis/DEXA too; the women's relevance is delivered via reviewer-gated interpretation + the preventive cadence layer, not by hiding the capture field. Only biologically sex-exclusive markers (PSA, testosterone) carry a `cohort` gate.
- **Marker entry HARD-BLOCKS implausible values with live validation (D24).** Save is disabled (no haptic/press-scale) until every field is non-empty, numeric, and within `field.plausible`. `validateField` / `deriveCanSave` (`markerEntry.ts`) are the single source of truth — `onSave` re-checks with the SAME helper, never a weaker one. `PressableScale` is `disabled`-aware so a blocked CTA gives no feedback.
- **The detail surface shows PLAIN LANGUAGE — never the LOINC code (D25).** `SingleRowCard` renders the marker name + value + "Source:"; the LOINC code is storage/export-only (the "Reference: LOINC …" line was removed). Values render via `formatMarkerValue(code, value)` — display rounding per `displayDecimals` (height 0, weight 1, creatinine/TSH 2, default 1; strips IEEE float noise from unit conversions). Rounding is **DISPLAY-ONLY** — `value_num` keeps full precision in the DAL/export.
- **Height uses a feet/inches two-field DEFAULT; every other field's entry default is its CANONICAL unit (D24).** `defaultUnitForField` → ft/in for height, kg for weight, mg/dL for labs. NEVER default a field to a non-canonical unit — a past bug defaulted weight to `lb` and silently stored pounds-as-kg (BMI 11.8). The ft/in→cm conversion (`feetInchesToCm`) stores canonical cm.
- **New markers need NLM-verified LOINC + `provisional: true`. Interpretation bands must be SOURCED (cited), `provisional: true`, and shown behind ‡ until a NAMED clinician clears it — never invented/unsourced in code; CC never clears the ‡.** WHO BMI categories + bone-density T-score bands now ship exactly this way (D23, 2026-06-15 — supersedes D21's "value only" deferral): WHO-cited, provisional, rendered with ‡. Adding more biomarker bands follows the same rule — cite the standard (WHO/ADA/KDIGO/…), ship provisional, defer the ‡-clear to the clinician.
- **Trend charts share ONE renderer; band geometry lives in `layoutBandScores`, not in the SVG (D26).** `TrendChartSvg` (`trend/TrendChart.tsx`) takes `bands` + `scoreRange` as props — instruments pass `chartBandsFor(id, sex)`, BMI passes the WHO uniform bands. Band tiling is the pure `layoutBandScores(bands, scoreRange)` in `sessions.ts`: it pads the domain by ±0.5 and places interior boundaries at adjacent-band MIDPOINTS. This is **identical** to the legacy ±0.5 tiling for integer instrument bands — a pinned regression test (`sessions.test.ts`) asserts PHQ-9 → edges -0.5/27.5, boundaries 4.5/… — so NEVER drop the half-step padding or the geometry shifts and dots clip. **Adult BMI is UNIFORM** — no age/sex BMI branching (WHO has no validated adult age/sex standard; pediatric BMI-for-age is out of scope). The chart's `scoreRange` is **display chrome only** (data-aware so an out-of-range value never renders outside the plot); it is NOT a clinical cutoff and must NOT be added to `tableV1.ts`.

### Repo hygiene — `mobile/` is its own project root

`mobile/` has its own `package.json`, `node_modules`, `eslint.config.js`, `vitest.config.ts`, `tsconfig.json`. Tooling must be invoked from `mobile/` cwd:

- `cd mobile && npx tsc --noEmit` — not from the repo root (`npx` finds a different `tsc` binary outside the project).
- `cd mobile && npx vitest run` — same; outside `mobile/` it picks up the web app's vitest config + 100 unrelated suites.
- `cd mobile && npx expo run:android` — Expo's project-root detection has misfired when invoked from a parent containing a stray `.env.local` (the web app's secrets file). Cwd matters.

Repo-root `.env.local` belongs to the Next.js `app/` and carries web-only secrets (Stripe, Anthropic, AMA, etc.). It must not leak into a mobile build. A mobile-scoped `.envrc` blocking parent inheritance is a documented follow-up; until then, verify cwd before running any mobile tool.

The root `.mcp.json` IS committed (SELF-PROMPTING RULES v2): it carries the project-scoped terminology connectors (icd10 / pubmed / npi) every session needs. Other `.mcp` artifacts (`.mcp/`, `*.mcp.json` elsewhere) stay gitignored. Local-only servers (e.g. `claude mcp add maestro --scope project -- maestro mcp`) still get re-registered per checkout. The Maestro CLI works without MCP — MCP is only useful for interactive Maestro use from inside a Claude Code session.

### Test-only auth paths — fail closed in prod, full stop

Any auth bypass for E2E automation MUST:

1. **Live in its own isolated module** (e.g. `app/src/lib/e2e-test-otp.ts`), named obviously, invoked from exactly one route, never imported elsewhere.
2. **Run a five-guard stack of independent signals:** explicit env flag (exact string match — `=== "true"`, NOT truthy), AND `NODE_ENV !== "production"`, AND request `host` not in `PROD_HOST_ALLOWLIST` (exact set membership — not substring; `staging.denali.health` must not match `denali.health`), AND email on an allowlist env var, AND constant-time code compare against a fixed env value, AND a static test password from AWS Secrets Manager (env-injected by ECS).
3. **Run a module-load startup assertion** that throws if the flag + `NODE_ENV=production` are both set. The contradiction is impossible to ship — the ECS container fails its health check, the deploy rolls back — not merely impossible to use.
4. **Have a CI deploy-gate** (`.github/workflows/deploy.yml`) that fails the prod deploy if any task-def env key starts with `E2E_TEST_OTP*`. Belt-and-braces alongside the in-process startup assertion.
5. **Log on G3+ denials and on success only.** G1 / G2 denials are silent (would otherwise page in prod). Log prefix `[E2E_TEST_OTP]` so CloudWatch metric filters can alarm if anything tagged ever lands in prod logs.
6. **NEVER fabricate tokens.** The bypass completes a REAL Cognito session via `ADMIN_USER_PASSWORD_AUTH` with the static test password. Token signing stays with Cognito; the bypass only short-circuits the OTP verification, never the cryptographic trust path.

If you can't satisfy every line above, the bypass is too dangerous to ship.

---

## Contract rule

Import `LocalDataDAL`, `Theme`, `ApiClient` (and their auxiliary types) from `mobile/src/contracts`. **Never redefine these shapes locally** in any consumer module. The frozen contracts are the seam between the foundation agents (Wave 1) and the consumer agents (Wave 2 + Pass 2). After Wave 0, changes to `mobile/src/contracts/**` should be additive only — never breaking.

---

## Wave & ownership map

| Wave | Who | What | Depends on |
|---|---|---|---|
| 0 | main thread + `mobile-app-shell` Pass 1 | contracts at `mobile/src/contracts/`; Expo scaffold + navigation + placeholder screens | — |
| 1 (parallel) | `mobile-theme-bridge` | `Theme` implementation at `mobile/src/theme/tokens.ts` | Wave 0 contracts |
| 1 (parallel) | `mobile-local-data-modeler` | `LocalDataDAL` impl at `mobile/src/db/dal/` + migrations | Wave 0 contracts |
| 1 (parallel) | `mobile-auth-wirer` | `ApiClient` impl at `mobile/src/auth/` + additive `X-Client-Type: mobile` branch in `app/src/app/api/auth/{verify-otp,refresh}/route.ts` | Wave 0 contracts |
| 2 (parallel) | `mobile-onboarding-builder` | cohort interstitials + intake + validated instruments + 988 surface | Wave 1 complete |
| 2 (parallel) | `mobile-upload-parse-builder` | upload pipeline + net-new `/api/parse-report` route | Wave 1 complete |
| 3 | `mobile-app-shell` Pass 2 | timeline view + navigation wiring + e2e smoke | Waves 1+2 complete |
| after each wave | `mobile-privacy-invariant-guard` | read-only audit against 6 invariants + conformance checklist | the wave's diffs |

**Wave N+1 must NOT begin before Wave N's contracts are implemented.** File-disjointness prevents merge conflicts; it does not prevent dependency conflicts.

---

## Step discipline

**Before implementing in any agent:**
- Re-read `@docs/design/phase-1-45plus.md`.
- Re-read this file (`mobile/CLAUDE.md`).
- Re-read your contract at `mobile/src/contracts/<your-contract>.ts`.
- Re-read your agent definition at `.claude/agents/<your-agent>.md`.

**Before declaring done:**
- Self-check against the Conformance checklist below and report each item as PASS / FAIL / N/A.

---

## Conformance checklist (every wave must pass)

- [ ] All 6 invariants hold (top of this file).
- [ ] **No contract redefinition.** `LocalDataDAL` / `Theme` / `ApiClient` exist only in `mobile/src/contracts/`. Consumers import; nobody copies the shapes.
- [ ] **UI uses `Theme` tokens via `useTheme()`** (or NativeWind seeded from the same values). No hardcoded colors / spacing / radii in components.
- [ ] **Wave order respected.** Wave N+1 work did not begin before Wave N's contracts were implemented.
- [ ] **Acting agent stayed within its defined scope** (no scope creep into another agent's surface).
- [ ] **No-server-persistence assertions pass:** the `query()` spy on `POST /api/parse-report` shows zero RDS inserts; the chat path writes nothing to `conversations`/`messages` under `X-Client-Type: mobile`; the byte-identical-web-path regression test for `verify-otp` / `refresh` is green.

The `mobile-privacy-invariant-guard` runs this checklist after every wave. The two AWS manual checks (**Bedrock invocation logging OFF**, **Cognito `RefreshTokenValidity` ≥ 30 days**) are reported on every audit output even on clean reviews.

---

## Hooks (drift enforcement, not just guidance)

Two of the load-bearing invariants are hard-gated by hooks. They run regardless of what the agent decides.

- **Contract protection (wired now).** `.claude/hooks/guard-contracts.sh` is a `PreToolUse` hook on `Write` / `Edit` that blocks any modification to `mobile/src/contracts/**` **after Wave 0 is marked complete**. Wave 0 completion is signaled by the operator creating `mobile/.wave-0-complete` (e.g., `touch mobile/.wave-0-complete`). To intentionally change a contract afterwards: `rm` the marker, make the additive-only edit, `touch` the marker again, and update `docs/history/phase-1-mobile-decisions.md`. Breaking-change edits should not happen — surface a deviation instead.
- **No-server-persistence (wired in Wave 1).** `.claude/hooks/guard-persistence.sh` is registered under `PostToolUse` `Write|Edit` in `.claude/settings.json` and runs fail-closed on every Edit/Write to a `.ts` / `.tsx` file under `app/` or `mobile/`. The Wave 1 baseline covers the byte-identical web-path regression for `verify-otp` and `refresh`. Wave 2 (`mobile-upload-parse-builder`'s `query()`-spy on `/api/parse-report`) and Wave 3 (Pass 2's chat no-persist assertion) extend the suite by appending file paths to the `TEST_TARGETS` list inside the hook.

## What lives where

- Spec: `docs/design/phase-1-45plus.md`
- Contracts: `mobile/src/contracts/{LocalDataDAL,Theme,ApiClient,index}.ts`
- Decision record: `docs/history/phase-1-mobile-decisions.md`
- Agents: `.claude/agents/mobile-*.md`
- Hooks: `.claude/hooks/guard-contracts.sh` (wired), `.claude/hooks/guard-persistence.sh` (Wave-1 deliverable, deferred)

## Deferred items (redesign)

Tracked here until resolved; each is a deliberate deferral, not an oversight.

- **Dark-mode variant — ✅ SHIPPED (2026-06-14, decision D17).** A dark companion
  palette (`redesignDark`, "Alpine night") + a 3-way Light/Dark/System control in
  Settings. `useTheme()` switches both `active` and the `redesign` vocabulary by
  resolved scheme. No longer deferred.
- **Motion + Reanimated — now IN (decision D18).** Tiers 1–4 of the motion layer
  shipped: haptics (`expo-haptics`), skeletons, micro-interactions
  (`Animated`/native-driver), and gestures via
  **react-native-reanimated@4 + react-native-worklets + react-native-gesture-handler**.
  The earlier caution ("Reanimated's New-Arch story on RN 0.85 not validated",
  `tokens.ts` header) is **lifted** — verified on-device. Reanimated needs a
  native rebuild + the `react-native-worklets/plugin` babel plugin (last) + a
  Metro cache clear. All motion honors OS Reduce Motion; clinical surfaces (bands,
  scores, 988 path) stay motion/haptic-silent.
- **Token-drift test source-of-truth inversion.** While the redesign is in
  flux, `src/theme/__tests__/tokens.test.ts` treats the mockup HTML as the
  color source of truth and asserts `tokens.ts` matches it. Once the
  redesign stabilizes, invert: `tokens.ts` becomes canonical and the
  mockup (or its successor doc) is checked against it.
