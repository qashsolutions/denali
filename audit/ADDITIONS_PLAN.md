# ADDITIONS_PLAN.md — Phase A (evaluate & confirm, READ-ONLY)

**Scope:** `docs/ADDITIONS_PROMPT.md` Phase A. Gender-specific PROM & marker additions for `mobile/` (Phase 1 45+ app). Dev/staging only.
**Date:** 2026-07-04 · **Branch:** `develop` · **Mode:** read-only (no code/config/migration/CI/secret changes; this file is the only write).
**Prior review consumed:** anchors from `docs/ADDITIONS_PROMPT.md §3.A.1` re-verified against code (see §7 manifest). `audit/CURRENT_STATE.md` exists as prior-review reference; not relied on — code is ground truth.

**Confidence legend:** HIGH = verified against code/primary source this pass · MEDIUM = strong evidence, one gap · LOW/UNCERTAIN = needs a named resolving artifact.

> ⛔ **CLINICAL-CONTENT GATE HONORED.** This pass enumerates *which* items need sourced + `verified` content. It authors **no** instrument item text, scoring, or reference range. Every clinical string is deferred to Phase B (sourced, `verified:false`, gated exactly like the empty `CURATED_PANELS`/`PREVENTIVE_RECOMMENDATIONS`/`biomarkers` tables).

---

## 0. Headline findings (read these first)

1. **The upload/parse path is analyte-agnostic — unmapped analytes are NOT dropped.** Adding markers requires **no parser change** to avoid data loss. The prompt's scope-down condition (§2, CBC/CMP) **is met**. (§4)
2. **Licensing is the binding constraint, and it is worse than the prompt assumed.** ESS *(Epworth)* and MRS — **both already shipping** — require commercial licences. IIEF-5/SHIM **likely requires a licence** (IQVIA), contradicting the prompt's "believed yes." Only 3IQ looks plausibly free, and that is **unverified**. No instrument may be built or kept shipping on an unresolved licence. (§5)
3. **Every target addition is MISSING or PARTIAL** — none is already fully present. Bone density + ferritin are confirmed already-universal (correctly on the "do NOT add" list). (§2)
4. **Markers are cheap; the PCOS flag is the only schema/contract change.** New markers and new PROMs touch registration + (Phase-B) content only. The PCOS-history flag is the sole item that touches the **frozen contract** + a **new migration**. (§3, §6)

---

## 1. Current-state anchors (re-verified against code — HIGH)

| Prompt anchor | Verified location | Status |
|---|---|---|
| `instrumentsFor()` | `mobile/src/onboarding/instruments/index.ts:88-102` | ✅ exact. Gates on `sex_at_birth`: unisex = PHQ-9/GAD-7/AUDIT-C/Epworth; `female` += MRS; `male` += ADAM, IPSS; intersex/unknown/null → unisex only. |
| `markersFor()` | `mobile/src/screens/markers/markerCatalog.ts:569-576` | ✅ exact. Universal markers always; `cohort.sex` markers only when sex matches; null/unknown/intersex → sex-specific excluded. |
| Marker cohort gate on `sex_at_birth` | `markerCatalog.ts:121-126` (field) + `:572-575` (filter) | ✅ `cohort?: { sex: ReadonlyArray<SexAtBirth> }`. Only PSA (`:515-529`) + total testosterone (`:499-514`) are gated `["male"]`. |
| Interpretation-by-age / no age gate on catalog | `markerCatalog.ts:18-24` (docblock) | ✅ "no age gate on the catalog … age drives INTERPRETATION ranges + PREVENTIVE cadence, not which marker is offered." |
| Empty table — preventive | `mobile/src/preventive/uspstf.ts:69-70` `PREVENTIVE_RECOMMENDATIONS = []` | ✅ empty; `dueScreenings()` returns `[]` until supplied. |
| Empty table — curated panels | `mobile/src/screens/timeline/biomarkers/registry.ts:52` `CURATED_PANELS = []` | ✅ empty; `getCuratedPanel()` returns null. |
| Interpretation biomarker map | `mobile/src/screens/timeline/interpretation/tableV1.ts:906-933` | ⚠️ NOT empty — ships **only** BMI `39156-5` + bone-density `38264-8`, both `provisional:true`. All other LOINCs render band-less (D28). |

---

## 2. MISSING / PARTIAL / MIS-GATED cross-map

Classification per target addition, with `path:line`. **None is "already present (skip)."**

### Women

| Item | Class | Evidence | Notes |
|---|---|---|---|
| **3IQ** (female incontinence PROM) | **MISSING** | No module in `instruments/` (dir list: adam/auditC/epworth/gad7/ipss/mrs/phq2/phq9 only); `InstrumentId` union has no 3IQ (`instruments/types.ts:18-26`). | Domain `urinary` exists (`domains/registry.ts:34,54`) but is reachable **only for males** today (mapped to IPSS, which `instrumentsFor` adds only for `male`). Adding a female incontinence PROM ⇒ **MIS-GATED domain**: `urinary`/incontinence must be made cohort-relevant for women (or a new domain). |
| **FSH** marker | **MISSING** | Not in `MARKER_CATALOG` (`markerCatalog.ts:146-530`); not in `LAB_FRIENDLY_NAME` (`displayMapping.ts:134-155`). | Prompt: framed optional / "log if ordered," not prompted. Female framing via education copy, not a hard gate. |
| **Estradiol** marker | **MISSING** | Same as FSH. | Highest fabrication risk (≈10× pre/post-menopause). Prefer report's own printed range; any stored range cited + `provisional`. |
| **PCOS-history flag** | **MISSING** | No `pcos` anywhere in `mobile/src` (grep, 0 hits). Profile columns = `id,email,plan,birth_year,is_on_medicare,sex_at_birth,gender_identity` (`profile.ts:44-45`; `001-init.sql:27-51`; contract `LocalDataDAL.ts:91-101`). | Net-new gating/framing input. See §6. |

### Men

| Item | Class | Evidence | Notes |
|---|---|---|---|
| **IIEF-5 / SHIM** (erectile PROM) | **MISSING** | No module; `InstrumentId` has no IIEF (`types.ts:18-26`). | Domain `hormonal` = ADAM only (`domains/registry.ts:37,48-57`). Folds into `hormonal` or a new "sexual health" domain (design decision). **Licence-gated** (§5). |

### Both sexes (shared)

| Item | Class | Evidence | Notes |
|---|---|---|---|
| **Free testosterone** | **PARTIAL** | Only **total** testosterone `2986-8` exists, male-gated (`markerCatalog.ts:499-514`). Free-T absent. | Improves male androgen + female PCOS androgen panel. Sex-specific ranges (Phase B). |
| **SHBG** | **MISSING** | Not in catalog / mappings. | Same androgen-panel rationale. |
| **DHEA-S** | **MISSING** | Not in catalog / mappings. | Same. |
| **CBC/CMP set** (Hgb, Hct, WBC, platelets, Na, K, Ca, B12, folate, urine ACR) | **PARTIAL — recommend SCOPE DOWN** | Parser already captures + stores these (§4). Several already have **display names**: Hemoglobin `718-7`, Potassium `2823-3`, Sodium `2951-2`, Calcium `2160-1`, Total protein `2885-2` (`displayMapping.ts:144-148`). **None** is a manual-entry marker. | No parser work. Add only manual-catalog entries + missing display names if manual logging / tracked-tiles are wanted. |
| **Free T4 + TPO antibodies** (optional) | **MISSING** | TSH `3016-3` exists (`markerCatalog.ts:364-378`); free-T4 + TPO absent. | Lower priority per prompt. |

### Confirmed "do NOT add" (already present — HIGH)

| Item | Evidence |
|---|---|
| **Bone density (DXA hip T-score)** | Present + universal, `markerCatalog.ts:473-496`; interpretation ships `38264-8` bands provisional (`tableV1.ts:920-932`). Needs female *framing*, not a new marker. ✅ matches prompt. |
| **Ferritin** | Present + universal, `markerCatalog.ts:380-392`. ✅ matches prompt. |

---

## 3. Build pattern per item (exemplar-cited)

### 3a. New PROM — exemplar: **IPSS** (`instruments/ipss.ts`)

Closest match to 3IQ/IIEF-5: `codeSystem:"internal"`, sex-gated, optional separately-stored sub-item (QoL). A new PROM touches, in order:

1. **New module** `instruments/<name>.ts` conforming to `InstrumentDefinition` (`instruments/types.ts:80-93`): verbatim `items[]`, `responseOptions`, pure `score()`, optional `interpret()`. *(Item text + scoring = CLINICAL CONTENT → Phase B.)*
2. **`instruments/types.ts:18-26`** — add id to `InstrumentId` union.
3. **`instruments/index.ts`** — barrel export (`:46-68`), `INSTRUMENTS_BY_ID` (`:111-121`), and the `instrumentsFor` branch (`:88-102`).
4. **`InstrumentsScreen.tsx`** — new `MenuKey`, the `startMenuItem` item-count switch (`:481-492`, hardcodes each instrument), the menu render + lead-in import (`:50-68`). Wire into the same `finishMenuItem`→`persistInstrument` path (`:504-532`).
5. **`displayMapping.ts`** — `INSTRUMENT_FRIENDLY_NAME` (`:46-55`) + `INSTRUMENT_ICON` (`:63-72`).
6. **`domains/registry.ts`** — `INSTRUMENT_TO_DOMAIN` (`:48-57`); if a new domain, also `DomainId` (`:29-39`), `DOMAIN_ORDER` (`:89-99`), and `DOMAIN_FRIENDLY_NAME`/`_ICON`/`_PROMPT` in `displayMapping.ts:239-280`. **Domain cohort-relevance is computed from `instrumentsFor` (`registry.ts:122-132`)** — so a female PROM only surfaces its domain once wired into the `female` branch.
7. **`interpretation/tableV1.ts`** — new `InstrumentInterpretation` entry with bands. *(CLINICAL → Phase B, `provisional:true`, `pendingReview(source)` per `:687-694`.)*
8. **Tests** — scoring, gating, persist, and that provisional strings surface the ‡ path.

**No DAL / migration change.** `persistInstrument` is generic over `InstrumentDefinition` — writes one `questionnaire` observation per item (`code:item.itemCode`) + one summary (`code:inst.loincCode`, `value_text:interpret(score)`), `InstrumentsScreen.tsx:235-299`.

### 3b. New marker — exemplar: **testosterone** (sex-gated, `markerCatalog.ts:499-514`) / **ferritin** (universal, `:380-392`)

1. **`MARKER_CATALOG`** entry (`markerCatalog.ts:146-530`): `key`, `display`, `category`, `group`, `provisional:true`, `fields:[{loinc, units, plausible}]`, optional `cohort:{sex}` / `entryHint`. *(LOINC must be NLM-verified per the provisional discipline `:25-32` → Phase B/C.)*
2. If a new picker group → `MarkerGroup` (`:44-51`) + `MARKER_GROUP_ORDER` (`:54-62`).
3. **`displayMapping.ts:134-155`** — `LAB_FRIENDLY_NAME` plain-language name.
4. **`interpretation/tableV1.ts:906-933`** — biomarker entry *(CLINICAL → Phase B; or leave band-less per D28 — a raw value with no validated cutoff makes no severity claim).*
5. **Automatic, no code:** `markersFor` (`:569-576`) + `trackedMarkers` (`:592-614`) pick it up; `LogMarkerScreen` renders it via `markersFor(sexAtBirth)` (`LogMarkerScreen.tsx:156`); save via generic `deriveCanSave`/`onSave` (`:165-184`).

**No DAL / migration / parser change.** `insertObservation` is generic + append-only (`observations.ts:35-72`).

### 3c. PCOS-history flag — new profile field (see §6 for the gating analysis)

1. **Contract additive** — `pcos_history: boolean | null` on `ProfileRow` + `ProfileUpsertInput` (`LocalDataDAL.ts:91-101,189-192`). ⚠️ `mobile/.wave-0-complete` exists → `guard-contracts.sh` blocks contract edits (`mobile/CLAUDE.md:177`); operator must `rm` marker → additive edit → re-`touch` → record decision.
2. **Migration 003** — `ALTER TABLE profile ADD COLUMN pcos_history INTEGER` + register in `migrations/index.ts` runner (`001-init.sql:184-188` schema_migrations pattern).
3. **Profile DAL** — `COLUMNS` + marshal (`profile.ts:44-45,71-131`), 0/1↔bool like `is_on_medicare` (`:31-42`).
4. **Capture UI** — `CohortOnboardingScreen` + `SettingsScreen` + `cohortPayload.ts` (`buildCohortPayload:50-65`, `decideCohortSubmission:97-128`). Additive PATCH semantics already supported.
5. **Consume as framing input**, not a hard gate (prompt §2: "adjusts framing only. Not a diagnostic feature").

---

## 4. Parser-impact finding — unmapped analytes (HIGH)

**Verdict: adding markers requires NO parser change. Unmapped analytes are captured and stored, not dropped.**

- **Extraction is LLM-driven and analyte-agnostic.** `POST /api/parse-report` (`app/src/app/api/parse-report/route.ts`) runs one-shot Claude with a schema prompt (`:87-139`) that assigns `code_system` + `code` per value. There is **no server-side analyte allow-list**. Uncodeable values get an explicit fallback: `code_system:'internal'` + a stable slug (`route.ts:122`).
- **Row survival is minimal.** The envelope parser keeps any row with string `code`, `display`, `effective_at` (`route.ts:280-281`); `value_num` may be null (`:287`). `category ∈ {biomarker,vital,anthropometric,condition,screening}` (`:59-64`) and `code_system ∈ {LOINC,ICD10,internal}` (`:65`) are subsets of the DAL enums (`LocalDataDAL.ts:33-44`) — no enum mismatch drops.
- **Commit is generic + append-only.** Accepted review rows → `buildObservationInsert` (`source:"uploaded_report"`, `reviewCommit.ts:34-60`) → `insertObservation` `ON CONFLICT DO NOTHING` (`observations.ts:35-72`).

**Display-layer nuances (NOT parser, NOT data loss):**

- `LAB_FRIENDLY_NAME` (`displayMapping.ts:134-155`) is curated; an unmapped LOINC falls back to model `display` → `code` (`resolveSingleRowDisplay:210-226`). Value shows; name may be less polished. **Several CBC/CMP codes already have names** (`:144-148`).
- `trackedMarkers()` (`markerCatalog.ts:592`) lists only catalog codes → an uploaded-but-uncatalogued analyte is stored + timeline-visible but **won't appear as a "tracked marker" tile** until catalogued.
- `formatMarkerValue` uses default decimals for unknown codes (`:557-561`).
- Interpretation is **band-less** for any LOINC absent from `tableV1.biomarkers` (`:906`, D28) — never an invented band.

**⇒ Recommendation:** scope CBC/CMP (and all new markers) to **catalog + display-name + Phase-B interpretation**. Parser is out of scope for every item here.

---

## 5. Licensing flags (Phase-A step 6 — sourced)

Denali is a **commercial** product (Stripe paid tiers). "Free for research" ≠ "free for commercial use." **Rule (prompt §1): do not implement or keep shipping any instrument on an unresolved licence.**

| Instrument | In play | Finding | Disposition | Conf. |
|---|---|---|---|---|
| **Epworth / ESS** | **shipping** (`instruments/epworth.ts`) | © M.W. Johns; **all** users need a licence, **user fee for commercial**; managed by MAPI Research Trust / ePROVIDE. | ⛔ **DECISION REQUIRED — licence needed. App ships ESS now → live compliance gap.** Obtain licence or stop shipping. | HIGH |
| **Menopause Rating Scale / MRS** | **shipping** (`instruments/mrs.ts`) | Owned by ZEG Berlin GmbH; **commercial use requires a licence** via their PRO request form (research use more flexible). | ⛔ **DECISION REQUIRED — commercial licence/permission needed. App ships MRS now.** | MEDIUM-HIGH |
| **IIEF-5 / SHIM** | proposed (men) | Distributed "adapted with permission"; IQVIA licenses it as a COA **per-use, incl. patient-support-app use**. | ⛔ **DECISION REQUIRED — licence likely needed. Contradicts prompt's "believed yes."** Do not build until resolved. | MEDIUM |
| **3IQ** | proposed (women) | Brown et al. 2006, *Ann Intern Med* (PMID 16702587). No explicit licensing regime surfaced; journal © is ACP. | ⚠️ **VERIFY free-for-commercial before build** (prompt "believed yes" — plausible but UNVERIFIED). Confirm w/ authors / ACP permissions. | MEDIUM |

Already-shipping and licence-clear (no action): PHQ-2/9, GAD-7 (public domain, Pfizer-released), AUDIT-C (WHO/public), IPSS/AUA, ADAM (Morley 2000) — not re-audited in depth this pass; flag only that the four above are the open items.

**Sources:** [epworthsleepinessscale.com/licenses](https://epworthsleepinessscale.com/licenses/) · [ePROVIDE — ESS](https://eprovide.mapi-trust.org/instruments/epworth-sleepiness-scale) · [ZEG Berlin — MRS](https://zeg-berlin.de/expertise/diagnostics-tools/menopause-rating-scale/about-mrs/) · [IQVIA COAs — SHIM](https://coas.iqvia.com/COAs/sexual-health-inventory-for-men) · [Rosen 1999 (IIEF-5), PMID 10404287](https://pubmed.ncbi.nlm.nih.gov/10404287/) · [Brown 2006 (3IQ), PMID 16702587](https://pubmed.ncbi.nlm.nih.gov/16702587/)

---

## 6. PCOS flag / new-gating-input finding (HIGH)

- **Gating inputs today:** `sex_at_birth` (`instrumentsFor` `index.ts:88-102`; `markersFor` `markerCatalog.ts:569-576`; `domainsForCohort` `registry.ts:122-132`) and **age/`birth_year`** — but age drives **interpretation + preventive only**, never which marker/instrument is offered (`markerCatalog.ts:18-24`; `uspstf.ts:101-109`).
- **No non-sex gate exists.** Grep for `pcos` / `organ_inventory` / `risk_gate` / `risk_flag` across `mobile/src` → **0 hits**. (The `organ_inventory` / `risk_gate` concepts live only in the *unintegrated* `docs/screening_rules.yaml`; the mobile engine does not read them.)
- **⇒ PCOS-history is a net-new profile field + capture + framing consumer.** Home = `profile` table (`001-init.sql:27-51`) / contract `ProfileRow` (`LocalDataDAL.ts:91-101`). Adding it is the **only** item touching the frozen contract (guard-hook gated by `.wave-0-complete`) **and** a new migration. Keep it a **framing** input (education/interpretation copy), never a hard gate that hides markers (prompt §2).

---

## 7. Clinical-content items to source + `verify` in Phase B (the gate list)

Nothing below is authored here. Each ships `verified:false`/`provisional:true`, cited, gated like the empty tables.

**Instrument text + scoring (transcribe verbatim from cited source — never paraphrase; if source unobtainable, STOP):**
- **3IQ** — 3 items + response options + urge/stress classification logic (Brown 2006). *(Licence-gated.)*
- **IIEF-5/SHIM** — 5 items + response options + severity bands (Rosen 1999). *(Licence-gated.)*

**Instrument interpretation strings (band headlines/explanations, `provisional`):**
- 3IQ + IIEF-5 `InstrumentInterpretation` entries in `tableV1.ts` (referral-verb placeholder pattern, ‡ until named reviewer).

**Marker reference/interpretation ranges (cited, assay-/sex-/age-/menopausal-status-specific; prefer the report's own printed range; NEVER from recall):**
- **Estradiol** — pre- vs post-menopause (≈10× — the cautionary example).
- **FSH** — menopausal-status-specific.
- **Free testosterone, SHBG, DHEA-S** — sex- and age-specific.
- **Free T4, TPO antibodies** — if surfaced.
- CBC/CMP — only if interpretation is later wanted; else band-less + report's own range.

**Terminology to NLM-verify (provisional LOINC discipline, `markerCatalog.ts:25-32`):**
- LOINC for FSH, estradiol, free testosterone, SHBG, DHEA-S (+ free T4, TPO, and any CBC/CMP manual markers). `provisional:true` until clinical sign-off on the SET, units, bounds, sex/age relevance.

---

## 8. Dependency-ordered build sequence (Phase C — gated on Phase B content + §5 licences)

> **Gate 0 (blocking): licence decisions.** Resolve ESS + MRS (already shipping), IIEF-5, and verify 3IQ *before* the dependent build step. No instrument work proceeds on an unresolved licence.

1. **Markers — androgen + female panel** (lowest risk; no contract/migration/parser change): FSH, estradiol, free testosterone, SHBG, DHEA-S. Catalog entries (NLM-verified provisional LOINC) + display names; interpretation band-less or Phase-B-sourced; female framing (FSH/estradiol) via education copy.
2. **CBC/CMP + optional thyroid** (fold into step 1): display-name additions (+ optional manual markers). **No parser work.** Optional free T4 / TPO last.
3. **3IQ PROM** — *only if licence-clear (Gate 0).* New module + registrations + **female urinary/incontinence domain wiring** + Phase-B interpretation. No DAL change.
4. **IIEF-5 PROM** — *only if licence obtained (Gate 0).* New module + registrations + hormonal/"sexual health" domain + Phase-B interpretation.
5. **PCOS-history flag** — last (only schema/contract change): lift `.wave-0-complete` → additive contract field → migration 003 → DAL marshal → capture UI → framing consumption.

**Ordering rationale:** markers need no contract/migration/parser change (cheapest, safest, and unblock the female-panel gap immediately); PROMs need registration + a possibly-new domain but no schema; PCOS is the only frozen-contract + migration touch, so it's isolated last. Licences gate everything instrument-related.

---

## 9. UNCERTAIN / open decisions (with resolving artifact)

| # | Item | Conf. | Resolve via |
|---|---|---|---|
| U1 | IIEF-5/SHIM licence actually required for a commercial patient app | MEDIUM | IQVIA / ePROVIDE quote for Denali's use case. |
| U2 | 3IQ free for commercial use | MEDIUM | Brown 2006 / ACP permissions; author contact. |
| U3 | ESS + MRS remediation path (licence vs. remove) | HIGH (that a decision is needed) | Product-owner licence decision; MAPI (ESS) + ZEG Berlin (MRS). |
| U4 | 3IQ domain: extend `urinary` to females vs. new `incontinence`/`pelvic` domain | LOW (design) | Product decision at build. |
| U5 | IIEF-5 domain: fold into `hormonal` vs. new "sexual health" domain | LOW (design) | Product decision at build. |
| U6 | New-marker LOINC codes | — (not yet verified) | NLM Clinical Tables LOINC API in Phase B/C; provisional until then. |
| U7 | FSH/estradiol as *optional log* vs. offered marker (framing) | MEDIUM | Product decision; both supported by catalog `entryHint` + education copy. |

---

## 10. Coverage manifest — files read/inspected this pass

**Read in full:** `docs/ADDITIONS_PROMPT.md` · `docs/screening_rules.yaml` · `mobile/CLAUDE.md` · `mobile/src/onboarding/instruments/index.ts` · `mobile/src/onboarding/instruments/types.ts` · `mobile/src/onboarding/instruments/ipss.ts` · `.../adam.ts` · `.../mrs.ts` · `.../epworth.ts` · `mobile/src/screens/markers/markerCatalog.ts` · `mobile/src/preventive/uspstf.ts` · `mobile/src/screens/timeline/biomarkers/registry.ts` · `mobile/src/screens/timeline/domains/registry.ts` · `mobile/src/screens/timeline/displayMapping.ts` · `mobile/src/screens/timeline/interpretation/tableV1.ts` · `mobile/src/db/dal/observations.ts` · `mobile/src/db/dal/profile.ts` · `mobile/src/db/migrations/001-init.sql` · `mobile/src/contracts/LocalDataDAL.ts` · `mobile/src/onboarding/cohortPayload.ts` · `mobile/src/upload/parseClient.ts` · `mobile/src/upload/reviewCommit.ts` · `mobile/src/upload/types.ts` · `app/src/app/api/parse-report/route.ts`

**Read in part:** `mobile/src/screens/InstrumentsScreen.tsx` (1-75, 235-329, 470-539) · `mobile/src/screens/markers/LogMarkerScreen.tsx` (140-184)

**Inspected via listing/grep:** `mobile/` tree + `mobile/src/**` dir map · `instruments/` + `upload/` + `db/dal/` + `db/migrations/` + `contracts/` + `onboarding/inputs/` listings · `.wave-0-complete` presence · `instrumentsFor`/`markersFor`/`persistInstrument` consumer grep · `pcos`/`organ_inventory`/`risk_gate` grep (0 hits) · new-analyte grep · `audit/` dir state.

**Not consumed (noted):** `audit/CURRENT_STATE.md` (prior review — code used as ground truth instead).

**Web (licensing, read-only):** MAPI/ePROVIDE (ESS), ZEG Berlin (MRS), IQVIA COAs (SHIM), PubMed (IIEF-5, 3IQ) — see §5.

---

## 11. Phase A Definition of Done — self-check

- [x] `audit/ADDITIONS_PLAN.md` exists.
- [x] Every target item classified MISSING/PARTIAL/skip with `path:line` (§2).
- [x] Build pattern per item, exemplar-cited (§3).
- [x] Parser impact for unmapped analytes determined + cited (§4).
- [x] Licensing flags for all instruments in play — existing (ESS, MRS) + new (3IQ, IIEF-5) — with sources (§5).
- [x] PCOS-flag / non-sex-gate location determined (§6).
- [x] Clinical-content items to source + `verify` enumerated (§7).
- [x] Dependency-ordered build sequence (§8).
- [x] Coverage manifest (§10). · UNCERTAINs carry resolving artifacts (§9).
- [x] No code/config/migration/CI/secret change. No clinical content authored.

## ⛑ STOP — Phase A complete. Awaiting product-owner review before Phase B.
