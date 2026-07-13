# LICENSING_BRIEF.md — instrument licence decision support (READ-ONLY)

**Scope:** decision-support for the product-owner licence call, per the Phase-A review of `docs/ADDITIONS_PROMPT.md`. Covers every instrument in play. **No** code/config/migration/CI/secret change — this file is the only write.
**Date:** 2026-07-04 · **Branch:** `develop`

**Verification tags:**
- **VERIFIED (primary)** = claim taken from the licensor's / copyright-holder's own page.
- **UNCERTAIN (confirm)** = best-available evidence, but NOT from the licensor's own terms — treat as a lead, not a settled fact. **Do not act as if settled.**

> ⚠️ **Correction to Phase A.** Phase A listed IPSS among the "already free" shipping instruments. That was wrong. **IPSS is copyright-encumbered** (© Wolters Kluwer; commercial distribution via MAPI Research Trust/ePROVIDE). It is shipping now. → there are **three** shipping-now exposures (ESS, MRS, **IPSS**), not two.

> 🧭 **Guard against repeating the error.** The free-replacement candidates named below (PROMIS, QUID, EHS, Greene) are *leads whose own commercial-licensing terms are NOT yet verified.* Do not assume any replacement is free-for-commercial without the same primary-source check.

---

## 1. TL;DR

- **Public-domain / clearly free (keep, no action beyond attribution):** PHQ-9, PHQ-2, GAD-7 — **VERIFIED**. AUDIT-C is public-domain but carries a commercial-carve-out phrasing → one confirmation email.
- **Active exposure — SHIPPING NOW on an encumbered licence (fix first):** **ESS** (VERIFIED licence-required), **MRS** (VERIFIED permission-required), **IPSS** (UNCERTAIN, lean licensed).
- **Gated new builds (blocked until cleared, no exposure yet):** **IIEF-5/SHIM** (UNCERTAIN, lean licensed), **3IQ** (UNCERTAIN, lean permissible-with-permission).
- **Verify-but-low-risk:** **ADAM** (UNCERTAIN, lean free) — shipping; no strong evidence of an active licensing regime.

---

## 2. Two urgencies, separated explicitly

### 🔴 Bucket A — ACTIVE EXPOSURE (shipping now; live compliance risk each day the app is up)

| Instrument | App status (path:line) | Why exposed |
|---|---|---|
| **Epworth / ESS** | shipping — `mobile/src/onboarding/instruments/epworth.ts` (unisex, `instruments/index.ts:91-96`) | Licensor's own page: a licence is required for ALL users. App has none. |
| **MRS** | shipping — `mobile/src/onboarding/instruments/mrs.ts` (female, `index.ts:98`) | Copyright holder requires a permission request for use; commercial not free. |
| **IPSS** | shipping — `mobile/src/onboarding/instruments/ipss.ts` (male, `index.ts:99`) | © Wolters Kluwer; commercial use/reproduction via MAPI/ePROVIDE. (Under-called in Phase A.) |

### 🟡 Bucket B — GATED NEW (not built; simply blocked until cleared — no exposure)

| Instrument | App status | Gate |
|---|---|---|
| **IIEF-5 / SHIM** | proposed-new (no module; `types.ts:18-26` has no IIEF id) | Do not build until licence confirmed. |
| **3IQ** | proposed-new (no module) | Do not build until reproduction rights confirmed. |

### 🟢 Bucket C — CLEAR / LOW-RISK (shipping; keep)

| Instrument | App status (path:line) | Basis |
|---|---|---|
| **PHQ-9 / PHQ-2** | shipping — `phq9.ts` / `phq2.ts` (unisex) | Public domain (Pfizer) — VERIFIED. |
| **GAD-7** | shipping — `gad7.ts` (unisex) | © Pfizer, no permission required — VERIFIED. |
| **AUDIT-C** | shipping — `auditC.ts` (unisex) | WHO public domain — VERIFIED; commercial carve-out → confirm. |
| **ADAM** | shipping — `adam.ts` (male) | SLU/Morley; no active regime found — UNCERTAIN, lean free. |

---

## 3. Per-instrument detail cards

Each card: **status · licensor/licence (tag + source) · (a) license · (b) free replacement · (c) drop · recommendation (confidence)**.

### 🔴 Epworth Sleepiness Scale (ESS)
- **Status:** shipping — `mobile/src/onboarding/instruments/epworth.ts`.
- **Licensor / licence:** © Dr. Murray W. Johns; **Mapi Research Trust** (Lyon, FR) is worldwide licensing agent. *"A license is required to use the ESS… whether or not a license fee is payable."* — **VERIFIED (primary)**, [epworthsleepinessscale.com/licenses](https://epworthsleepinessscale.com/licenses/). Fee tiers **not disclosed** on-page (commercial users typically pay).
- **(a) License:** contact Mapi — `PROinformation@mapigroup.com`, +33 4 7213 6575, or [ePROVIDE ESS](https://eprovide.mapi-trust.org/instruments/epworth-sleepiness-scale). Cost basis **unknown, must inquire** (commercial digital-app licences here are commonly annual + per-use/volume).
- **(b) Free replacement:** **PROMIS Sleep-Related Impairment** (NIH/HealthMeasures, free — *verify terms*). Construct differs: PROMIS-SRI measures *daytime impairment from poor sleep over 7 days*; ESS measures *propensity to doze in 8 specific situations* and is the de-facto OSA-referral screen. A swap loses the dozing-propensity/OSA signal and changes scoring to T-scores.
- **(c) Drop:** lose the standardized daytime-sleepiness check-in ("Sleep" domain `domains/registry.ts:34`); Sleep domain would have no active screener.
- **Recommendation:** **License it OR replace with PROMIS-SRI — do not keep shipping unlicensed.** Licence is the lowest-disruption path if the OSA signal matters; else swap. **MEDIUM.**

### 🔴 Menopause Rating Scale (MRS)
- **Status:** shipping — `mobile/src/onboarding/instruments/mrs.ts` (female-gated).
- **Licensor / licence:** **ZEG Berlin GmbH** (Center for Epidemiology & Health Research, Invalidenstraße 115, 10115 Berlin). *"For all requests regarding permission to use our rating scales, please use exclusively the … PRO Request form."* — **VERIFIED (primary)**, [zeg-berlin.de MRS](https://zeg-berlin.de/expertise/diagnostics-tools/menopause-rating-scale/about-mrs/). Research use is more flexible; **commercial requires the request** (Phase-A search). Pricing not stated.
- **(a) License:** ZEG Berlin PRO Request form. Cost basis **unknown, must inquire** — ZEG is research-oriented and has historically granted MRS use at low/no cost, but a commercial consumer app must ask.
- **(b) Free replacement:** **weak field.** Greene Climacteric Scale (closest construct — vasomotor/psychological/somatic menopause symptoms) but its commercial terms *also* need checking; MENQOL is *also* Mapi/ePROVIDE-licensed; the Aging-Males'-Symptoms cousin is also ZEG. No clean free-for-commercial menopause PROM identified. Construct note: Greene ≈ MRS symptom domains but different item set/scoring.
- **(c) Drop:** lose menopause-specific vasomotor/urogenital symptom tracking ("Menopause" domain `registry.ts:35`); general PHQ-9/GAD-7/sleep partially overlap but don't capture vasomotor symptoms.
- **Recommendation:** **Inquire ZEG licence first** (likely the cheapest resolution); if commercial terms are unworkable, **drop** rather than swap (replacements are equally encumbered). **MEDIUM.**

### 🔴 IPSS (International Prostate Symptom Score)
- **Status:** shipping — `mobile/src/onboarding/instruments/ipss.ts` (male-gated). **Phase-A correction: not free.**
- **Licensor / licence:** © **Wolters Kluwer** (publisher); commercial use + translations distributed by **Mapi Research Trust/ePROVIDE**. **UNCERTAIN (confirm)** — one source claims public-domain, conflicting with the Wolters Kluwer/Mapi commercial regime; the ePROVIDE "Official I-PSS" listing is strong signal a commercial licence is required. Sources: [ePROVIDE I-PSS](https://eprovide.mapi-trust.org/instruments/international-prostate-symptom-score), [Phase-A search summary in ADDITIONS_PLAN.md §5].
- **(a) License:** Mapi/ePROVIDE (same house as ESS) and/or AUA. Cost basis **unknown, must inquire.**
- **(b) Free replacement:** no clean free clone (the AUA-SI is the same 7-item index, same encumbrance). Candidates: ICIQ-MLUTS (ICIQ requires registration), USP. All differ in item set; none is a drop-in.
- **(c) Drop:** lose the field-standard male-LUTS screen ("Urinary" domain for men `registry.ts:34`).
- **Recommendation:** **Resolve the public-domain ambiguity FIRST** (ask AUA/Mapi directly) — IPSS *may* be usable free with attribution, which would close this cheaply. If licensed-only, license it; do not drop (no viable free equivalent). **MEDIUM.**

### 🟡 IIEF-5 / SHIM (Sexual Health Inventory for Men)
- **Status:** proposed-new. Prompt assumed "believed yes (free)" — **evidence contradicts.**
- **Licensor / licence:** developed by Rosen et al. under **Pfizer**; **IQVIA/ePROVIDE** lists SHIM as a COA licensed **per-use, incl. patient-support-app use**; distributed copies carry "adapted with permission." **UNCERTAIN (confirm)** — no free-for-commercial statement located. Sources: [IQVIA COAs — SHIM](https://coas.iqvia.com/COAs/sexual-health-inventory-for-men), [Rosen 1999, PMID 10404287](https://pubmed.ncbi.nlm.nih.gov/10404287/).
- **(a) License:** IQVIA (ePROVIDE) or Pfizer directly. Cost basis **unknown, must inquire** (IQVIA states per-project/annual for app use).
- **(b) Free replacement:** **Erection Hardness Score (EHS)**, single item 0–4 — simpler, often reproduced freely (*verify*). Construct differs sharply: EHS = erection rigidity only; IIEF-5 = 5 domains (confidence, firmness, penetration, maintenance, satisfaction) → severity band + a documented early-CVD-risk signal. EHS loses the multi-domain severity + CVD-signal value.
- **(c) Drop:** lose the men's erectile-function PROM entirely (the one genuine male gap the prompt targets).
- **Recommendation:** **Do not build until licence confirmed.** If IQVIA/Pfizer terms are unworkable, fall back to EHS (accepting reduced granularity) rather than shipping IIEF-5 unlicensed. **MEDIUM.**

### 🟡 3IQ (3 Incontinence Questions)
- **Status:** proposed-new. Prompt "believed yes (free)."
- **Licensor / licence:** Brown et al. 2006, *Annals of Internal Medicine* — article © **American College of Physicians (ACP)**. Reproduced in national guidance (e.g., RACGP Red Book Appendix 13A), suggesting reproduction is obtainable. **UNCERTAIN (confirm)** — no explicit free-for-commercial grant; journal content is © ACP. Sources: [Annals 2006 (PMID 16702587)](https://pubmed.ncbi.nlm.nih.gov/16702587/), [RACGP Red Book App-13A](https://www.racgp.org.au/FSDEDEV/media/documents/Clinical%20Resources/Guidelines/Red%20Book/Appendix-13A.pdf).
- **(a) License:** ACP permissions (RightsLink via acpjournals.org) and/or corresponding author (J.S. Brown, UCSF). Cost basis **unknown, must inquire** — journal reprint permissions are often modest one-time fees.
- **(b) Free replacement:** **QUID (Questionnaire for Urinary Incontinence Diagnosis)**, Bradley 2005 — 6-item, validated stress-vs-urge classifier, generally freely available (*verify*). Strong construct match (same urge/stress/mixed classification goal); slightly longer than 3IQ.
- **(c) Drop:** lose the female incontinence-type PROM (a targeted women's-gap item).
- **Recommendation:** **Confirm ACP reproduction terms; if restrictive, use QUID** (close construct, likely free). Either path clears the women's incontinence gap. **MEDIUM.**

### 🟢 PHQ-9 / PHQ-2
- **Status:** shipping — `phq9.ts` / `phq2.ts`. **Licensor / licence:** developed by Spitzer/Williams/Kroenke under an educational grant from **Pfizer**; *"no permission required to reproduce, translate, display or distribute."* **VERIFIED (primary)**, [phqscreeners.com](https://www.phqscreeners.com/). **Recommendation: KEEP, no action.** **HIGH.**

### 🟢 GAD-7
- **Status:** shipping — `gad7.ts`. **Licensor / licence:** © **Pfizer**, *"no permission required to reproduce, translate, display or distribute."* **VERIFIED (primary)**, [phqscreeners.com](https://www.phqscreeners.com/). **Recommendation: KEEP, no action.** **HIGH.**

### 🟢 AUDIT-C
- **Status:** shipping — `auditC.ts`. **Licensor / licence:** derived from **WHO** AUDIT; *"As a WHO-approved instrument, the AUDIT is in the public domain"* and *"No permission is needed … for any non-commercial purpose."* — **VERIFIED (primary)** public-domain status, but the "non-commercial" phrasing + "the person completing it should not be charged a fee" leaves a **commercial carve-out ambiguity**. Source: [auditscreen.org FAQ](https://auditscreen.org/about/faqs) (contact John B. Saunders, MD — office@jbsaunders.net).
- **Recommendation: KEEP; send one confirmation email** that public-domain status covers a paid app (users aren't charged to take the AUDIT-C). Very likely fine. **MEDIUM-HIGH.**

### 🟢 ADAM
- **Status:** shipping — `adam.ts` (male-gated). **Licensor / licence:** Morley et al. 2000, **Saint Louis University**. Widely reproduced across versions/languages; **UNCERTAIN (confirm)** — no active licensing regime surfaced, no MAPI/IQVIA distribution. Source: [Validation, PMID 11016912](https://pubmed.ncbi.nlm.nih.gov/11016912/).
- **(a) License:** if claimed, SLU technology-transfer/Dr. Morley's group. **(b) Replacement:** Aging Males' Symptoms (AMS) is **worse** (ZEG Berlin — same encumbrance as MRS); qADAM is same family. **(c) Drop:** lose the male low-testosterone symptom screen ("Hormonal" domain `registry.ts:37`).
- **Recommendation: KEEP; low-priority confirmation to SLU.** Likely free; no evidence of an active regime. **MEDIUM.**

---

## 4. Decision table

| Instrument | App status | Licence tag | Recommendation | Conf. |
|---|---|---|---|---|
| PHQ-9 / PHQ-2 | shipping | Public domain — **VERIFIED** | **Keep**, no action | HIGH |
| GAD-7 | shipping | © Pfizer, free — **VERIFIED** | **Keep**, no action | HIGH |
| AUDIT-C | shipping | WHO public domain — **VERIFIED**; commercial carve-out ambiguous | **Keep** + confirm commercial (1 email) | MED-HIGH |
| **ESS** 🔴 | **shipping** | Licence required — **VERIFIED** | **License or replace (PROMIS-SRI); stop shipping unlicensed** | MED |
| **MRS** 🔴 | **shipping** | Permission required — **VERIFIED** | **Inquire ZEG licence; else drop** | MED |
| **IPSS** 🔴 | **shipping** | Commercial licence — **UNCERTAIN**, lean licensed | **Resolve public-domain ambiguity w/ AUA/Mapi first; license if needed** | MED |
| IIEF-5/SHIM 🟡 | proposed-new | Licence — **UNCERTAIN**, lean licensed | **Don't build until confirmed; fallback EHS** | MED |
| 3IQ 🟡 | proposed-new | ACP reproduction — **UNCERTAIN** | **Confirm ACP; else use QUID (free)** | MED |
| ADAM | shipping | SLU — **UNCERTAIN**, lean free | **Keep** + low-priority confirm | MED |

---

## 5. Exact questions to put to each licensor

**Mapi Research Trust — `PROinformation@mapigroup.com` (ESS; and IPSS distribution):**
1. Does a **paid consumer mobile health app** (subscription) require a commercial licence for the ESS? What is the **fee basis** — per-app, annual, per-registered-user, or per-administration?
2. Does the licence cover **on-device digital administration**, verbatim item display, and **local storage** of item-level responses + the total score?
3. For **IPSS specifically**: is it under a Mapi commercial licence, or (as one source claims) public domain? If licensed, same fee-basis question.

**ZEG Berlin — PRO Request form (MRS):**
1. Is a **commercial licence** required for MRS in a paid consumer app, and what is the **fee basis**? Is there a reduced/again-free tier for a preventive-health app?
2. Does permission cover **digital administration + local storage of item-level responses** and **verbatim English item text**?
3. May we show the 0–4 severity scale with **added plain-language calibration hints** (our `helperText`), clearly marked as non-part-of-instrument?

**American College of Physicians — permissions/RightsLink, acpjournals.org (3IQ):**
1. Does reproducing the **3IQ item text verbatim** in a commercial app require an ACP permission/licence? **Fee basis** (one-time reprint vs. ongoing)?
2. Is **attribution-only** sufficient, or is a formal licence needed for commercial digital reproduction?

**IQVIA/ePROVIDE + Pfizer (IIEF-5/SHIM):**
1. **Who holds licensing authority** for IIEF-5/SHIM for a commercial patient-support app — IQVIA (ePROVIDE) or Pfizer directly?
2. **Fee basis** for a paid consumer app; does it cover verbatim digital display + local scoring/storage?

**Saint Louis University — technology transfer / Dr. J.E. Morley's group (ADAM):**
1. Does SLU claim copyright on the ADAM questionnaire, and is a **licence required for verbatim reproduction** in a commercial app? **Fee**, if any?

**Dr. J.B. Saunders — office@jbsaunders.net (AUDIT-C):**
1. Confirm the **public-domain status permits use in a paid app** (users are not charged specifically to complete the AUDIT-C), and state any **required attribution**.

**For every replacement lead before adoption (PROMIS-SRI, QUID, EHS, Greene):** run the *same* primary-source check — confirm free-for-commercial from the owner's own terms before assuming.

---

## 6. Sources
Primary (licensor/owner): [ESS licenses](https://epworthsleepinessscale.com/licenses/) · [ePROVIDE ESS](https://eprovide.mapi-trust.org/instruments/epworth-sleepiness-scale) · [ZEG Berlin MRS](https://zeg-berlin.de/expertise/diagnostics-tools/menopause-rating-scale/about-mrs/) · [auditscreen.org FAQ](https://auditscreen.org/about/faqs) · [phqscreeners.com (PHQ/GAD)](https://www.phqscreeners.com/) · [IQVIA COAs — SHIM](https://coas.iqvia.com/COAs/sexual-health-inventory-for-men) · [ePROVIDE I-PSS](https://eprovide.mapi-trust.org/instruments/international-prostate-symptom-score).
Secondary (leads): [Rosen 1999 IIEF-5 (PMID 10404287)](https://pubmed.ncbi.nlm.nih.gov/10404287/) · [Brown 2006 3IQ (PMID 16702587)](https://pubmed.ncbi.nlm.nih.gov/16702587/) · [RACGP Red Book App-13A (3IQ reproduced)](https://www.racgp.org.au/FSDEDEV/media/documents/Clinical%20Resources/Guidelines/Red%20Book/Appendix-13A.pdf) · [ADAM validation (PMID 11016912)](https://pubmed.ncbi.nlm.nih.gov/11016912/) · [IPSS discrepancy — ADDITIONS_PLAN.md §5].

## 7. Methodology & guardrails
- Read-only pass: web reads + code `path:line` only. No code/config/migration/CI/secret change.
- Every "shipping now" status tied to a code path; every licence claim tagged VERIFIED (licensor's own page) or UNCERTAIN (lead only).
- No clinical content authored. Replacement instruments are named for licensing/product analysis, NOT transcribed.
- **Does NOT proceed to Phase B or C.** Awaiting the product-owner licence decision.

## ⛑ STOP — licence-decision brief complete. No build.
