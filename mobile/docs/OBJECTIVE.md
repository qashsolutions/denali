# OBJECTIVE.md — what we set out to do (mobile, 45+ Phase 1 + redesign)

Canonical objective anchor per SELF-PROMPTING RULES v2. **Only Venkata edits
the intent of this file.** CC may propose changes in step reports but never
applies them to intent. Every step prompt names which O-items it serves;
every step report states which O-items advanced / are untouched / regressed.

Derived from the approved specs:
`docs/design/phase-1-45plus.md` (Phase 1 build prompt v2) ·
`docs/design/denali-redesign-mockups.html` ("Alpine clarity", accepted at
step-1 visual review) · the approved step-2 Part D trend-layer plan ·
`mobile/CLAUDE.md` (invariants + clinical boundary rules) ·
`docs/history/phase-1-mobile-decisions.md` (decision record).

---

## 1. Mission

Extend Denali from the 65+ Medicare/Blue Button product to the **45+
non-Medicare** audience as a **privacy-first, longitudinal personal health
app**. Privacy is the trust mechanism, not a feature: the user builds their
own multi-year health record **on-device**, receives **transient** analysis
with nothing retained server-side, and — once trust is earned — later opts
into the Phase-2 personal longitudinal model and cloud backup. Consumer
plain-language UX on top; clinical accuracy underneath.

**Phase 1 success:** a user can privately build and view their own
longitudinal health record on-device, receive transient analysis with
nothing retained server-side, and trust the app enough to later opt into the
long-term model.

## 2. Standing constraints (apply to every O-item; not restated per step)

Canonical text lives in `mobile/CLAUDE.md` — summarized here for anchoring:

- **The six invariants:** local-first (no server-side health data, chat
  included) · encrypted at rest (SQLCipher + encrypted blobs) · login ≠
  encryption key · append-only time-series with supersede-only corrections ·
  transient analysis only (Bedrock invocation logging OFF) · no longitudinal
  model / no cloud backup in Phase 1.
- **Clinical boundary:** explain, never recommend · interpretation strings
  only from versioned tables, never render-time/LLM-generated · ‡ +
  "pending clinical review" until a named human clears it (CC never clears
  it) · standing disclaimer on every clinical surface · `sex_at_birth` is
  the clinical key, `gender_identity` display-only · 988 surface on PHQ-9
  item 9 is mandatory and untouchable.
- **Frozen contracts** at `mobile/src/contracts/` — never modified.
- **Process:** SELF-PROMPTING RULES v2 via `mobile/docs/review.md`
  (pre-task gate, acceptance matrix, acceptance-auditor, STOP gates).

## 3. Objectives

### O1 — Phase-1 local-first foundation — **SHIPPED** (Waves 0–3)
Email-OTP auth returning body tokens for `X-Client-Type: mobile`
(Keychain/Keystore, silent refresh, 7-day cap) · SQLCipher DB with
device-generated key + typed append-only DAL · cohort onboarding
(birth_year, sex_at_birth, is_on_medicare, gender_identity) · intake +
validated instrument battery (PHQ-2/9, GAD-7, AUDIT-C, Epworth; MRS female;
ADAM + IPSS male) with the 988 crisis surface · upload → encrypted blob →
on-device text extraction → transient `/api/parse-report` → review/confirm →
local observations · local-only chat over `/api/chat` SSE no-persist ·
chronological timeline. Acceptance criteria: spec § Acceptance criteria.

### O2 — Health Hub domain organization — **Increment 1 SHIPPED**
Apple-Health-style reorganization of the timeline into 9 cohort-gated
domains (registry + pure rollup with round-trip invariant), dashboard
domain cards, per-domain detail pivot, versioned interpretation table
(v1.1.x) with uniform / sex-specific / age-sex-specific strategies and
published cutoff citations. Increments 2–3 (sparklines on cards, trend
statements) fold into O4.

### O3 — "Alpine clarity" redesign — **steps 1–2 SHIPPED, accepted**
Single token source (`src/theme/tokens.ts`) carrying the mockup `:root`
palette exactly (paper/ink/glacier-teal; teal-deep for teal TEXT) + the
approved alarm/alarm-wash addition · fonts via expo-font (Inter body,
Inter Tight numbers, Bricolage Grotesque display — path (a)) with OS
system-font floor · Ridgeline signature · dashboard "Your health" frame ·
detail-screen reskin with shared pill construction · drift test pinned to
the mockup. **Approved supersession:** the original Phase-1 instruction to
mirror web `globals.css` tokens is superseded — mobile leads the redesign;
the web migrates later. Deferred (tracked in `mobile/CLAUDE.md`):
dark-mode variant; drift-test source-of-truth inversion. Remaining scope:
reskin of the non-dashboard surfaces (chat, upload, settings, onboarding)
in later steps.

### O4 — Apple-Health-style trend layer — **SHIPPED** (steps 3–4,
operator visual pass on-device 2026-06-09)
Per-instrument score-over-time dots+line over shaded severity bands read
from the SAME versioned interpretation table (+ additive `scoreRange`),
plain-language band labels, 3M/6M/Y/All range control (no Day/Week),
n=1 quiet state, factual template-only delta line from stored scores —
no population comparisons, no advice phrasing, nothing model-generated at
render. Built with existing react-native-svg; **no new dependencies**.
Open owner decisions before build: IPSS lowest-band tint; ADAM excluded
from line charts; chart per instrument (not per domain); the
"score unchanged" delta string.
**Done when:** a user with ≥2 sessions on an instrument sees the chart
(bands + dots + range control + factual delta) on that instrument's
detail; n=1 shows the quiet state; every label/band/delta string comes
from the versioned tables; gates + acceptance audit green; Venkata's
visual review accepted.

### O5 — Curated clinical-content pipeline — **PLANNED / gated on people**
Curated biomarker panels + per-biomarker education (schemas shipped empty
in O2) populated only with sourced ranges; provenance records
`{ source, pmid_or_code_system_version, retrieved_at, review_status }` on
every band/string/vocabulary entry; terminology-verifier + MCP connectors
(pubmed/icd10/npi) as authoring/CI tools only — never runtime, never PHI;
ICD-10 annual drift job; ‡ marks clear ONLY via named clinical review.
**Done when:** every shipped band, interpretation string, and vocabulary
code carries a complete provenance record verified by the
terminology-verifier (unsourceable entries FLAGGED, not invented); the
curated biomarker panels + education ship with sourced ranges; at least
one named clinical review has cleared its entries' ‡ marks.

### O6 — Verification & governance harness — **IN PROGRESS**
`mobile/docs/review.md` pre-task gate + Definition of Done (shipped) ·
`acceptance-auditor` subagent (shipped) · remaining v2 setup: reviewer
subagents (clinical-boundary, security, terminology-verifier), skills
(clinical-strings, band-config, mcp-verification, step-verification),
project-scoped `.mcp.json`, SessionStart hook decision · Maestro E2E flows
(testID inventory shipped; flows gated on an E2E test-OTP backend running
NODE_ENV ≠ production — the bypass code is committed but does NOT run on
the deployed staging service, which is NODE_ENV=production; see
STAGING-LOCKDOWN.md).
**Done when:** all four v2 review/verification subagents, the four skills,
and the `.mcp.json` connectors exist and each has been exercised on at
least one real step; Maestro flows run in CI against an E2E test-OTP
backend (NODE_ENV ≠ production).

## 4. Non-goals (Phase 1 — verbatim from the spec)

Longitudinal prediction/trend models *(the O4 trend layer displays stored
scores; it predicts nothing)*; zero-knowledge cloud backup, sync,
multi-device; population cohort; any server-side persistence of health data
(including chat); Blue Button / FHIR / Medicare path; web app changes
*(except the named additive mobile branches: verify-otp/refresh token-in-body,
chat no-persist, `/api/parse-report`)*.

## 5. Changelog

- 2026-06-09 — v1 drafted by CC from the approved specs (rule 0);
  **pending Venkata review — intent not yet ratified.**
- 2026-06-09 — "Done when" lines added to O4/O5/O6 per Venkata's review
  direction ("go ahead").
- 2026-06-09 — **Intent RATIFIED by Venkata** (answer "1. yes"). Status
  labels and changelog may be updated by CC in step reports; intent text
  only by Venkata from here on.
- 2026-06-09 — O6 note: MCP connectors — pubmed reachable; icd10 / npi
  (and clinical-trials / CMS candidates) not connecting; Venkata is
  checking endpoints. Terminology work proceeds via the claude.ai PubMed
  connector meanwhile.
- 2026-06-09 — O4 status → SHIPPED, Venkata visual pass on-device (trend
  chart with band washes/labels, dots + teal latest, delta line, range
  control, n=1 quiet state, working collapse, single pinned disclaimer).
  O1 advanced: repeat check-ins live via "Start a check-in" focus mode —
  the longitudinal record can now accumulate. Residual device checks:
  IPSS ok-tint and ADAM "No signs" pills (test-pinned; visible after an
  IPSS/ADAM check-in).
