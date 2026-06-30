# Denali — upload/parse test fixtures

Synthetic **text-layer PDFs** for exercising the Phase-1 upload → `/api/parse-report`
→ on-device analysis pipeline. One report per `<sex>_<healthissue>` across every
category, male and female where clinically applicable, plus negative cases.

Regenerate: `cd mobile/test-fixtures && python3 generate_fixtures.py`
(deps: `reportlab`; verify with `pdftotext`). Source of truth =
`generate_fixtures.py`; expected parsed output per file = `manifest.json`.

> **All data is synthetic.** Names / DOB / MRN are deliberately fake **and present**
> so we can verify the parser **strips identifiers** — expected output must contain
> **no** name/DOB/MRN/address.

## Hard format rule (why these are PDFs, not images)

The pipeline accepts **PDF with a real text layer only** — there is **no OCR** in
Phase 1. Image files and scanned/photographed PDFs are rejected
(`extract.ts` → `pdf_has_no_text_layer` / `ocr_not_supported_phase_1`). Also:
`≤15 MB`, extracted text `≤200,000 chars`, needs the **custom dev build** (the
native PDF-text bridge isn't in Expo Go), and `health_data_ai` consent must be
**ON**. Parsing is plan-routed: **trial → Haiku 4.5**, paid → Sonnet 4.6
(`ramanac@gmail.com` is trial → Haiku).

## The matrix

| File (`male_*` / `female_*`) | Type | Exercises | Headline markers |
|---|---|---|---|
| `*_diabetes` | lab | biomarker parse | A1c 4548-4, fasting glucose 1558-6 |
| `*_cardiac` | lab | biomarker + vital | lipids, hs-CRP 30522-7, BP, HR |
| `*_obesity` | visit | **BMI bands** | height 8302-2, weight 29463-7, waist 8280-0, BMI 39156-5 |
| `*_bonedensity` | lab | **DXA T-score bands** | hip T-score 38264-8 (F=osteoporosis, M=osteopenia) |
| `*_thyroid` | lab | biomarker | TSH 3016-3 |
| `*_liver` | lab | biomarker | ALT 1742-6, AST 1920-8 |
| `*_kidney` | lab | biomarker | creatinine 2160-0, eGFR 98979-8 |
| `*_anemia` | lab | biomarker (band-less) | ferritin 2276-4, Hgb 718-7 |
| `*_vitamind` | lab | biomarker | 25-OH vit D 62292-8 |
| `*_alcohol` | visit | band-less labs + screener note | GGT 2324-2, AST/ALT, AUDIT-C |
| `*_mentalhealth` | visit | screener note | PHQ-9 44261-6, GAD-7 70274-6 |
| `*_sleep` | visit | screener note | Epworth (internal slug — see note) |
| `*_comprehensive` | lab | broad multi-panel + BMI | CMP + lipids + A1c + TSH + vit D + CBC + vitals |
| `male_prostate` | visit | male cohort gate | PSA 2857-1, IPSS |
| `male_hormonal` | visit | male cohort gate | testosterone 2986-8, ADAM |
| `female_menopause` | visit | female-specific | FSH 15067-2, estradiol 2243-4, MRS |

**Banded interpretation today** only fires for **BMI** (`*_obesity`, `*_comprehensive`)
and **bone-density T-score** (`*_bonedensity`). Every other marker stores +
charts **band-less** (raw value, no severity) — that is expected, not a bug
(only those two LOINCs have cited bands in `tableV1.ts`).

### Negative fixtures

| File | Expected |
|---|---|
| `negative_nonmedical.pdf` | A coffee receipt → **0 observations** (empty-parse review state). |
| `negative_scanned_notextlayer.pdf` | Image-only PDF (rasterized) → rejected on-device at extraction (`pdf_has_no_text_layer`); never reaches the server. |

## Using them on the emulator / device

The system DocumentPicker reads from device storage, so push the files first:

```bash
# Android emulator (denali_pixel)
adb push reports/ /sdcard/Download/denali-fixtures/
# then in the app: Upload tab → pick a PDF from Downloads → review → Save
```

(iOS simulator: drag the PDF onto the simulator window, or use the Files app.)

After upload, compare the review screen against `manifest.json[*].expected_observations`.

## Known gaps these fixtures surface

- **No plausibility guard on the upload review→commit path** (manual marker
  entry has one; the parsed path does not). `*_*` reports with out-of-range
  values still commit as-is — confirm that's intended.
- Screener scores (PHQ-9, GAD-7, Epworth, AUDIT-C, IPSS, MRS, ADAM) parse as
  `screening`/`internal` observations from the visit notes; they are **not** the
  same as taking the in-app questionnaire, so they won't drive the instrument
  domain charts — they exercise the *parser*, not the screener flow.
- **LOINC choices:** lab analytes use verified LOINCs. Surveys use a verified
  LOINC only where confirmed (PHQ-9 `44261-6`, GAD-7 `70274-6`); Epworth and the
  rest use an `internal` slug rather than an unverified code. A generator guard
  rejects any unchecked `points`-unit LOINC. The manifest is a *QA guide* — the
  LLM parser may pick a different-but-reasonable LOINC, so assert on the marker
  + value, not an exact code match.
- **Codebase mismatch to fix separately (not replicated here):** the app's
  `mobile/src/onboarding/instruments/epworth.ts` labels LOINC **`89204-2`** as
  the Epworth total score, but `89204-2` is canonically *"PHQ-9 modified for
  Teens total score"* (a depression screener) — verified on loinc.org. And
  `markerCatalog.ts` codes **waist** as `56086-2`, which is the *"Adult Waist
  Circumference Protocol"* panel concept, not a measured-value code (`8280-0`).
  These fixtures use the correct codes; the app code should be corrected too.
