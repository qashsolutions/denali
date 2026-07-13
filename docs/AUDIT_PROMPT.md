# Claude Code — denali.health mobile: longitudinal check-in audit & build plan

**How to use this file:** place it at the repo root (e.g. `docs/AUDIT_PROMPT.md`),
drop `screening_rules.yaml` (the Layer-3 rules config) into `docs/` as well, open Claude
Code in the mobile repo, and paste the CONTRACT + PHASES sections (or point CC at this
file). Run **Phases 0–4 read-only first**; do not let CC modify app code until the
inventory and gap analysis exist and you've reviewed them.

---

## 0. ROLE & OBJECTIVE

You are auditing the **denali.health mobile app** (Expo / React Native; "alpine
clarity" design language). Everything relevant is in **dev/staging only** — nothing here
is in production, and none of it exists on the web app yet. Your job in this pass is
**analysis, not construction**: inventory what longitudinal health check-in / screening
features actually exist in the code today, gate-by-gate (age × sex × anatomy), diff that
against the target catalog provided below, audit the lab-upload + storage + RAG + safety
pipelines, and produce a prioritized, sequenced build plan. **Make no changes to
application code in Phases 0–4.** Only create the documentation artifacts named below.

Ground every finding in a file path + line reference. If something is not in the code, say
"not found" — do **not** infer that a feature exists from naming or from this prompt. When
you are uncertain, mark it `UNCERTAIN` and list what evidence would resolve it.

---

## 1. NORTH-STAR ARCHITECTURE (the non-negotiables the plan must respect)

1. **Deterministic core, RAG explanation.** Eligibility/flagging is rule-based (see
   `docs/screening_rules.yaml`). The model/RAG layer only *explains* what the rules already
   decided and grounds every statement in a cited source. The model never re-derives who is
   eligible for what.
2. **User-supplied data.** The user uploads and stores their own information (lab reports,
   biometrics, questionnaire responses). Analysis is performed over *that* data plus the
   rules plus cited sources. Nothing is invented about the user.
3. **AI guidance, explicitly NOT medical advice.** Output is educational/navigational
   ("here is what this marker means; USPSTF suggests discussing X with a clinician"). It is
   not diagnosis, not treatment, not a physician substitute. This must be enforced in
   product copy, disclaimers, and the generation layer — not just a footer.
4. **Four layers.** (a) patient-reported check-ins / PROMs → (b) objective/biometric +
   uploaded labs → (c) screening-eligibility flags → (d) derived risk + RAG narrative with
   provenance = (instrument+score+threshold) × (guideline citation) × (user's own trend).
5. **Gating.** Screening eligibility keys off **sex_at_birth + organ_inventory**
   (organ inventory OVERRIDES sex_at_birth). Symptom PROMs key off gender_identity +
   reported anatomy. Ages are 45+.
6. **Safety precedes narrative.** A positive safety trigger (e.g. PHQ-9 item 9 > 0, high
   AUDIT-C) fires a deterministic crisis pathway BEFORE any RAG output, independent of
   whether the underlying rule is "verified."

---

## 2. INPUTS PROVIDED TO YOU

- `docs/screening_rules.yaml` — the authoritative **target** for Layer 3 (screenings +
  immunizations), each rule carrying age/sex/organ gates, grade, provenance, `verified`
  flag, and a CHANGELOG of open decisions. Treat this as the spec to diff against.
- **Appendix A** (below) — the **PROM catalog** (Layer 1), which is NOT in the YAML.
- **Appendix B** (below) — **candidate RAG sources**, pre-vetted for credibility/licensing.
- **Appendix C** (below) — condensed age × sex × anatomy matrix for quick reference.

If any input file is missing, stop and tell me which one before proceeding.

---

## 3. PHASES

### PHASE 0 — Discovery (read-only)
- Detect the stack, package manager, monorepo layout, and where shared logic lives
  (mobile-only vs a shared package that web could also consume). Record the exact commands
  you'd run to build/test.
- Locate: navigation/route tree, the check-in/questionnaire screens, any "Denali" analysis
  screen, the data model / storage layer, any file-upload code, any API/backend client, any
  LLM/RAG call sites, any feature flags, and any existing config that resembles
  screening/eligibility rules.
- Produce `audit/00_MAP.md`: a high-level map (dirs, key modules, data flow from a check-in
  tile → storage → analysis → rendered guidance). Diagrams as mermaid where useful.

### PHASE 1 — Feature inventory (read-only) → `audit/01_INVENTORY.md`
For **every** check-in / screening / questionnaire feature you find in the code, extract a
row with: feature name, file path(s), **instrument** used (e.g. GAD-7, AUDIT-C, ESS/Epworth,
IPSS, AMS/qADAM, MRS/Greene, PHQ-9), **exact scoring logic** (or "none / display-only"),
**age gating** (values, or "none"), **sex/gender gating** (which field: sex_at_birth vs
gender_identity, or "none"), **anatomy/organ gating** (or "none"), whether responses are
**persisted** (where/how), whether it's wired to a **backend**, and whether a **licence** is
required for the instrument (flag copyrighted scales — ESS/Epworth, MRS, MoCA, etc.).

Then answer explicitly, from the code (not assumption):
- Which check-ins are shown to **male** users, by age band? Which to **female** users, by
  age band? Which are unconditional?
- Does any gating use `organ_inventory`? If not, note that trans/post-surgical correctness
  is currently unmet.
- Is there a demographic-capture flow that sets sex_at_birth / gender_identity / anatomy?
  (Memory indicates `sex_at_birth` / `gender_identity` columns exist — verify in code.)

### PHASE 2 — Gap analysis (read-only) → `audit/02_GAP_ANALYSIS.md`
Diff the Phase-1 inventory against **Appendix A (PROMs)** + **`screening_rules.yaml`
(screenings/immunizations)** + **Appendix C (matrix)**. For each target item output one of:
`BUILT` / `PARTIAL` (what's missing) / `MISSING` / `MIS-GATED` (built but wrong age/sex/organ
logic — e.g. GAD-7 shown to 65+ as "recommended" when USPSTF is an I-statement there; PSA not
forced to shared-decision; mammography start age not 40). Group gaps by: (i) PROMs, (ii)
screening flags, (iii) immunizations, (iv) gating correctness, (v) lab/objective ingestion,
(vi) RAG/provenance, (vii) safety. Rank each gap by user-value × effort.

### PHASE 3 — Data, lab-upload & RAG pipeline audit (read-only) → `audit/03_DATA_RAG_AUDIT.md`
- **Upload:** Is there lab-report upload today? What formats (PDF, image, HL7/FHIR, CSV)?
  Where are files stored (device, S3, Supabase, etc.)? Encryption at rest/in transit? PHI
  handling? Is there OCR/parse, and does it normalize analytes to **LOINC**?
- **Storage/model:** What's the schema for uploaded results, biometrics, and questionnaire
  scores? Is there a longitudinal/trend representation (needed for Layer-4 "your own trend")?
- **RAG:** Is there any retrieval today? What corpus, what embedding/store, how are citations
  attached and surfaced? Does every generated claim carry a resolvable source? If there is a
  direct-LLM path with no retrieval, flag it — that violates the "grounded + cited" rule.
- Map current sources against **Appendix B**. Recommend the minimal source set for the
  lab-upload use case and note which of my connected MCP servers already cover it (PubMed
  works; deepsense-hosted NPI/CMS have had DNS failures per prior diagnostics — verify).
- Produce a concrete **lab-result → guidance** reference flow: parse → LOINC-normalize →
  attach the report's own reference range (deterministic) → map to patient-education
  (MedlinePlus Connect by LOINC) → apply any guideline threshold (cite ADA/KDIGO/ACC-AHA,
  link don't reproduce) → RAG narrative with citations → non-diagnostic framing.

### PHASE 4 — Safety & regulatory posture (read-only) → `audit/04_SAFETY_COMPLIANCE.md`
- Is there a deterministic crisis pathway for PHQ-9 item 9 / severe scores / AUDIT-C
  dependence? Does it fire before any RAG output? Are crisis resources present (e.g. 988 in
  the US)? If a mental-health PROM exists without this, mark it a **release blocker**.
- Document (do not resolve) the **CDS / medical-device boundary**: analyzing uploaded labs
  and returning "guidance" can approach clinical-decision-support. Summarize the risk, the
  "wellness/education vs device" line, the FDA CDS considerations, and what claims/disclaimer
  language and human-in-the-loop framing keep denali on the education side. List the specific
  product decisions this forces (claims wording, disclaimers, whether any feature can't ship
  as-is). Flag that this needs qualified regulatory/legal review — you are not that reviewer.
- Note instrument-licensing exposure surfaced in Phase 1 (ESS/Epworth commercial licence via
  MAPI/ePROVIDE; MRS; any proprietary scale) as go-live blockers.

### PHASE 5 — Prioritized next-steps plan → `audit/05_NEXT_STEPS.md`
Synthesize Phases 1–4 into a sequenced plan with: (1) a dependency-ordered backlog (blockers
first: gating correctness, safety pathway, licensing, source-of-truth decisions), (2) a
phased build sequence with acceptance criteria per item, (3) where the deterministic rules
engine should live (mobile-only vs shared package for web parity — recommend, with reasons),
(4) the minimal RAG source set to integrate first and the integration steps, (5) explicit
open decisions routed back to me (the four in the YAML CHANGELOG + any new ones), (6) a
"smallest shippable slice" proposal for a first internal release.

---

## 4. CONSTRAINTS & DEFINITION OF DONE
- **No application-code edits in Phases 0–4.** Only create files under `audit/`.
- Every claim cites a file path (+ line) or an external source URL. No unsourced assertions.
- Prefer tables; keep prose tight. Mark every uncertainty `UNCERTAIN` with the evidence that
  would resolve it.
- **Done when:** `audit/00_MAP.md` … `audit/05_NEXT_STEPS.md` exist, the gap analysis
  classifies every Appendix-A PROM and every `screening_rules.yaml` rule, the lab→guidance
  flow is written, the safety-pathway status is stated as pass/blocker, and the next-steps
  backlog is dependency-ordered. End by printing a one-screen executive summary and the list
  of decisions you need from me.

---

## APPENDIX A — PROM catalog (Layer 1; target for the check-in tiles)
Map each to the built tiles. Sex column: "organ/anatomy" means gate on anatomy, not identity
alone. **Confidence on instrument identity/applicability: HIGH** (stable, textbook PROMs);
tile→instrument mapping in the current app is UNCERTAIN until Phase 1 confirms it.

| Domain | Instrument | Sex/anatomy | Age emphasis | Licence risk |
|---|---|---|---|---|
| Depression (+ ideation) | PHQ-9 (PHQ-2 gate) | both | all 45+ | free |
| Anxiety | GAD-7 (GAD-2 gate) | both | **B 45–64; I-statement 65+** | free |
| Alcohol | AUDIT-C | both | all 45+ | free (WHO) |
| Daytime sleepiness | Epworth (ESS) | both | all 45+ | **copyrighted — commercial licence** |
| Sleep apnea risk | STOP-BANG | both (M higher) | 45+ | free |
| Insomnia | ISI | both (F higher) | 45+ | check licence |
| Male LUTS | IPSS / AUA-SI | prostate anatomy | 50+ | free |
| Erectile function | IIEF-5 / SHIM | male | 45+ | free |
| Male androgen symptoms | qADAM / AMS | male | 45+ | AMS licence varies |
| Female urinary/incontinence | ICIQ-UI SF / 3IQ | female anatomy | 45+, esp. postmeno | check licence |
| Menopause symptoms | MRS / Greene | female | ~45–60 peri/post | **MRS licence** |
| Cognition (subjective) | AD8 / single-item | both | 65+ (flag-only) | free (AD8) |
| Frailty | FRAIL (5-item) | both | 65+ | free |
| Falls risk | 1-item + gait | both (F fractures) | 65+ | free |
| Physical function / pain | PROMIS PF / Pain Interference | both | 55+ | free (PROMIS) |
| Nutrition | MNA-SF | both | 70+ | free |
| Social isolation | UCLA-3 | both | all 45+ | free |

> Note the "Hormonal changes" tile must fork by sex: **MRS/Greene** (women) vs **AMS/qADAM**
> (men) — different constructs. Verify which the app implements, and for whom.

---

## APPENDIX B — Candidate RAG sources (pre-vetted; verified 2026-07-02 where noted)
Confidence = suitability as a credible, citable source for THIS consumer, non-diagnostic,
lab-upload use case.

| Source | What it gives | Access | Confidence | Use for |
|---|---|---|---|---|
| **MedlinePlus Connect** (NLM) | Patient-friendly content keyed to **LOINC/ICD-10-CM/SNOMED/RxNorm**; EN/ES | Free; `connect.medlineplus.gov/application`; verified 07-02 | **HIGH** | Primary consumer explanation of each lab test & condition, keyed to codes |
| **myhealthfinder** (ODPHP/health.gov) | Consumer prevention recs bundling USPSTF + ACIP, personalized by age/sex/pregnancy | Free API (verify endpoint) | HIGH (verify API) | Consumer-facing "what's next" prevention layer |
| **USPSTF Prevention TaskForce API** (AHRQ) | Authoritative screening recs by age/sex/risk, JSON, with grades | Free but **requires approval**: uspstfpda@ahrq.gov; verified 07-02 | HIGH (gated) | Authoritative Layer-3 screening source of truth |
| **PubMed / PMC** (NLM) | Primary literature; evidence grounding | E-utilities API; **already connected via MCP (works)** | HIGH for grounding | Depth/evidence — SYNTHESIZE, not patient-facing prose |
| **LOINC** (Regenstrief) | Canonical lab-test identity/normalization | Free w/ registration/licence; tables + FHIR terminology | HIGH | Deterministic parsing of uploaded labs → codes |
| **RxNorm** (NLM) | Medication normalization | Free API | HIGH (if meds in scope) | Normalize/explain meds |
| **CDC / ACIP** | Immunization schedules | Public pages | **MEDIUM** | Immunizations — but landscape contested (see YAML); pin dated source |
| **NIH institutes** (NIDDK/NHLBI/NIA/NIMH) | Authoritative patient education | Mostly surfaced via MedlinePlus | HIGH | Condition education (access via MedlinePlus) |
| **Cochrane** | Systematic-review evidence | Abstracts free | MED-HIGH | Evidence grounding; link, don't reproduce |
| **Function Health** (commercial) | Biomarker interpretation content | **Already connected via MCP** | LOW-MED | Comparison only — third-party commercial, NOT a neutral authority; provenance/licence caution |

**Lab reference ranges (important nuance):** ranges are assay/lab-specific. Deterministic
rule: use the reference range **printed on the user's own uploaded report**. For
guideline-defined thresholds (A1c ≥6.5% = diabetes; LDL targets; eGFR/CKD staging; BP
categories), cite the specific society (ADA, KDIGO, ACC/AHA, KDOQI) and **link — do not
reproduce**. For "what does this mean," use MedlinePlus (via LOINC).

**Do NOT ingest/redistribute** (copyright): WebMD, Healthline, Mayo Clinic content,
UpToDate, or specialty-society full-text guidelines. You may *link* to and *cite* them; you
may not reproduce them into the corpus.

---

## APPENDIX C — Condensed age × sex × anatomy matrix (quick reference)
Authoritative detail + provenance is in `docs/screening_rules.yaml`. Verified windows are
marked ✓ (checked against primary source 2026-07-02); others are `verify`.

**Both sexes, 45+:** BP screening; depression (PHQ-9, + crisis pathway); AUDIT-C; sleep
(ESS/STOP-BANG); HepC once; anxiety (GAD-7) **B only 45–64, I-statement 65+**.
**Both, 45–75:** colorectal ✓ (45–49 B / 50–75 A / 76–85 selective); diabetes if
overweight/obese (35–70); ASCVD/statin risk assessment (40–75, lipids as input).
**Both, 50+:** shingles (RZV); pneumococcal ✓ (≥50 universal).
**Both, smokers 50–80:** lung LDCT ✓ (≥20 pack-yr, current/quit<15y).
**Both, RSV:** ✓ 75+ universal; 60–74 & 50–59 risk-based.
**Female (anatomy-gated):** mammography ✓ (40–74 biennial, B; 75+ I-statement); cervical
(→65, gate on cervix present) `verify`; menopause PROM (MRS/Greene, peri/post); female
incontinence PROM; osteoporosis DXA (F 65+; postmeno <65 if high FRAX) `verify`.
**Male (anatomy-gated):** IPSS (LUTS, 50+); IIEF-5; AMS/qADAM (androgen symptoms); PSA
**shared-decision only, 55–69; recommend-against 70+** `verify`; AAA one-time ultrasound
(65–75 ever-smoked) `verify`.
**65+ both:** cognition (AD8, flag-only); frailty (FRAIL); falls; nutrition (MNA-SF 70+).

> **Gating correctness checks CC must make:** (1) organ_inventory overrides sex_at_birth;
> (2) PSA is never auto-recommended; (3) mammography starts at 40; (4) anxiety not labeled
> "recommended" for 65+; (5) male/female "Hormonal" forks to the correct instrument.
