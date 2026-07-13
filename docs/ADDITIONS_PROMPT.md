# Claude Code — denali.health mobile: gender-specific PROM & marker additions
### (evaluate → verified clinical content → build) — dev/staging only

**How to use:** save as `docs/ADDITIONS_PROMPT.md`, open Claude Code at the repo root, tell
it *"Read docs/ADDITIONS_PROMPT.md in full and execute Phase A only; stop for my review
before Phase B."* Runs in the `mobile/` app. Web app is out of scope. This prompt has a hard
rule that separates safe engineering (which you build) from clinical content (which is
sourced + verified before it can reach a user).

---

## 0. OBJECTIVE
Add a bounded set of sex-/population-specific check-ins and markers that the code-verified
inventory shows are missing, **without duplicating** what exists, and **without fabricating
any clinical content**. Sequence: (A) confirm the gaps and the code patterns, read-only;
(B) assemble the clinical content into a versioned config with per-item provenance and a
`verified` flag, nothing surfaced to users while `verified:false`; (C) build the feature
plumbing in dev/staging, wired to that config.

---

## 1. STANDING CONSTRAINTS & GUARDRAILS
**Environment.** All work targets **dev/staging only**. Production (iOS/Android store release)
is a later, separately-gated milestone. During Phase A: read-only — no code edits, no
migrations, no CI/infra changes, no secret reads. Phases B–C write code/config **only in
dev/staging**, never touching prod pipelines or secrets.

**Code is ground truth.** Every finding cites `path:line`. No feature/behavior inferred from a
filename or a prose doc. Prose/markdown docs are not evidence; `CLAUDE.md` readable for
build/run facts but verify against config. Anything unverifiable → `UNCERTAIN` with the
evidence that would resolve it. Attach `HIGH/MEDIUM/LOW` confidence to judgment calls.

**CLINICAL-CONTENT GATE (the load-bearing rule — do not violate).**
- You may build the *plumbing* freely (tiles, gating, storage, history/trend, UI, tests).
- You may **NOT** hardcode clinical content from your own knowledge. This includes: the item
  wording/scoring of any instrument, and any marker **reference range / interpretation
  threshold**.
- Every clinical item must carry a **citation to a primary source** and default to
  `verified: false`. Content with `verified:false` **must not be surfaced to users as
  authoritative** — gate it exactly like the existing empty tables (`CURATED_PANELS = []`,
  `PREVENTIVE_RECOMMENDATIONS = []`) which render a generic prompt until a reviewer supplies
  content. A human reviewer (the product owner) flips `verified:true` after checking each item
  against its cited source.
- **Instrument items** (e.g. 3IQ, IIEF-5) must be transcribed from the cited published
  instrument, not paraphrased from memory. If you cannot obtain the authoritative source text,
  stop and say so — do not approximate it.
- **Reference ranges are the highest fabrication risk.** Ranges are assay- and often
  age/sex/menopausal-status-specific. Rule: prefer the range **printed on the user's own
  uploaded report** (deterministic); any stored interpretation range must carry a cited
  guideline/source and `verified:false`. **Cautionary example:** estradiol differs ~10× between
  pre- and post-menopause — never emit a single "normal estradiol" range from recall.
- **Licensing check is part of this gate.** Before implementing ANY instrument, verify its
  copyright/commercial-use status. Implement only instruments that are free for commercial use
  or already licensed. If an instrument needs a licence (this includes the existing **Epworth/
  ESS** and **MRS** you already ship), STOP and report it as a decision — do not implement or
  keep shipping it unresolved.

---

## 2. THE TARGET ADDITIONS (what to build — subject to Phase A confirmation)
This is the intended set, from the gap analysis. Treat it as the spec to confirm and refine,
not as content to copy verbatim. Per-item confidence is the product owner's, pending your
code + source verification.

**Women (largest current gap — 0 female markers, 1 female PROM):**
- **3IQ** — 3 Incontinence Questions (female urinary/incontinence PROM). *Verify: free for
  commercial use (believed yes); authoritative item text.*
- **FSH** and **estradiol** markers — framed **optional / "log if your clinician ordered it,"
  not prompted** (menopause is symptom-diagnosed; these are noisy in perimenopause). *Verify:
  menopausal-status-specific reference ranges from a cited source — do NOT hardcode from
  recall.*
- **PCOS-history flag** — a single self-reported profile flag; adjusts framing only. Not a
  diagnostic feature (PCOS is a reproductive-age Rotterdam-criteria diagnosis, uninterpretable
  post-menopause).

**Men (already well-covered — one genuine gap):**
- **IIEF-5 / SHIM** — erectile-function PROM (also an early CVD-risk signal). *Verify:
  free/public-use status (believed yes); authoritative item text.*

**Both sexes (shared adds, not gendered):**
- **Androgen panel: free testosterone + SHBG (+ DHEA-S)** — improves male androgen assessment
  AND provides the female PCOS androgen panel. *Verify: sex-specific reference ranges, cited.*
- **CBC/CMP marker coverage** — hemoglobin, hematocrit, WBC, platelets, sodium, potassium,
  calcium; plus B12, folate, urine ACR — so an uploaded standard panel doesn't lose data.
  *First confirm in Phase A what `parse-report` does with an unmapped analyte; if it already
  handles arbitrary analytes, scope this down.*
- **Optional: free T4 + TPO antibodies** (thyroid; women have higher autoimmune-thyroid rates,
  but the marker is universal). Lower priority.

**Do NOT add (avoid duplication / low value):** bone density, ferritin (already universal —
these need female *framing*, not new markers); reproductive-age markers (AMH, LH/ovulation).

---

## 3. PHASES

### PHASE A — Evaluate & confirm (READ-ONLY) → `audit/ADDITIONS_PLAN.md`
1. Confirm current state against code (anchors from prior review, re-verify): `instrumentsFor()`
   at `index.ts:88-102`, `markersFor()` at `markerCatalog.ts:569-576`, gating on `sex_at_birth`
   (`markerCatalog.ts:123-124`), interpretation-by-age (`markerCatalog.ts:19-20`), the empty
   tables (`registry.ts:52`, `uspstf.ts:69`).
2. For **each** target addition, classify: `MISSING` / `PARTIAL` / `already present (skip)`,
   with `path:line`. Produce the formal MISSING/PARTIAL/MIS-GATED cross-map for these items.
3. Extract the **"how to add" pattern** from existing instruments and markers: what files/
   registrations a new PROM touches (instrument module, `instrumentsFor`, scoring, history,
   UI/tile) and what a new marker touches (catalog entry, `markersFor`, interpretation, DAL,
   trend/rollup, upload/parse mapping). Cite the exemplar you're following (e.g. how IPSS or
   testosterone is wired).
4. Confirm the **upload/parse** behavior for an **unmapped analyte** (does adding markers
   require parser changes? does unmapped data drop silently?). Cite the parse path.
5. Determine where the **PCOS-history flag** and any new gating input live (profile/DAL,
   demographics capture) and whether adding a non-`sex_at_birth` gate is supported.
6. **Licensing pass:** state the copyright/commercial-use status (with source) for every
   instrument in play — existing (Epworth/ESS, MRS) and new (3IQ, IIEF-5). Flag any needing a
   licence decision. Do not proceed to build those.
7. Output `audit/ADDITIONS_PLAN.md`: the cross-map, the build pattern per item, the parser
   impact, the licensing flags, a dependency-ordered build sequence, and an explicit list of
   clinical-content items that will need sourced + `verified` content in Phase B. **Then STOP
   for product-owner review.**

### PHASE B — Clinical content config (sourced + verified) → extend the versioned config
- Do NOT begin until Phase A is reviewed. **Preferred input:** a product-owner-provided,
  source-cited clinical spec (same shape as `screening_rules.yaml`, per-item provenance +
  `verified`). If that spec is provided, use it as the single source of content — do not
  substitute your own recall.
- If no spec is provided, assemble content ONLY from primary sources you can cite, each item
  `verified:false`, following the CLINICAL-CONTENT GATE (§1): instrument item text transcribed
  from the cited instrument; marker interpretation ranges cited and menopausal-status/sex/age-
  specific where applicable; no fabricated ranges.
- Store this as a versioned config (extend the existing pattern — e.g. a
  `womens_mens_additions` config, or the marker/instrument catalogs' data layer) with fields:
  `source`, `source_url`, `verified`, `verified_date`, `confidence`, and (for markers) the
  reference-range provenance. Wire the render path so `verified:false` content shows the
  generic non-authoritative prompt, never as guidance.

### PHASE C — Build the plumbing (dev/staging) 
- Implement the new PROMs (3IQ, IIEF-5) and markers (FSH, estradiol, free testosterone, SHBG,
  DHEA-S, CBC/CMP set) following the exemplar pattern from Phase A, gating by `sex_at_birth`
  (and the PCOS-history flag where relevant), wired to the Phase-B config for all clinical
  content.
- Add the PCOS-history flag to the profile/demographics capture.
- Extend upload/parse mapping for the new analytes if Phase A showed it's required.
- Non-diagnostic framing throughout; no individualized generative interpretation of results in
  this scope — display against the report's own reference ranges.
- Tests for each addition (scoring, gating, storage, and that `verified:false` content does not
  surface as authoritative). Maestro flow updates if warranted.
- **dev/staging only.** No prod pipeline, no store submission, no secrets.

---

## 4. DEFINITION OF DONE (per phase)
- **A:** `audit/ADDITIONS_PLAN.md` exists; every target item classified with `path:line`; build
  pattern + parser impact + licensing flags documented; clinical-content items enumerated; a
  coverage manifest of files read; STOPPED for review.
- **B:** every new clinical item carries a citation + `verified:false`; instrument text is
  sourced, not paraphrased; no fabricated reference ranges; render path gates unverified
  content.
- **C:** additions implemented + gated + tested in dev/staging; nothing shipped to prod; a
  short summary of what a male vs female user now sees, with `path:line`.

---

## 5. GUARDRAILS RECAP
Dev/staging only; prod deferred and separately gated. Read-only in Phase A. Code/tests/config
are the only evidence; prose docs are not. Clinical content is sourced + `verified`, never
recalled; reference ranges prefer the user's own report; instruments transcribed from cited
sources. Copyrighted instruments (Epworth/ESS, MRS, or any new one) are not implemented/shipped
without a resolved licence. Every claim cites `path:line`; uncertainties stay `UNCERTAIN`.
