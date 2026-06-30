# Upload extract — test fixtures

## `sample-lab.pdf`

A 720-byte hand-rolled, single-page PDF embedding a deterministic short lab
snippet:

```
Glucose 95 mg/dL
Cholesterol 180 mg/dL
HbA1c 5.6%
```

The fixture is consumed in two places:

1. **Wrapper-logic test** (`mobile/src/upload/__tests__/extract.test.ts`).
   The test mocks `expo-pdf-text-extract` and never actually parses the PDF,
   but it does load the bytes from this file to assert "this looks like a
   valid PDF" (`%PDF-1.4` header + non-empty body).

2. **Dev-mode self-test** (`mobile/src/upload/extractSelfTest.ts`). The
   self-test runs only when `__DEV__ === true`, decodes the base64 sidecar
   into a temp file, and asks the real native bridge to extract its text.
   Output is logged with the `[EXTRACT-SELFTEST]` prefix so the main thread
   can grep Metro/Logcat for it during STEP 3 simulator runs.

## `sample-lab.base64.ts`

Auto-generated sibling of `sample-lab.pdf` — same bytes, base64-encoded into
a TypeScript module. RN's Metro bundler does not bundle binary `.pdf` assets
by default, but a `.ts` constant works everywhere. The dev-mode self-test
imports `SAMPLE_LAB_PDF_BASE64` from here.

## Regenerating

If you need to change the embedded text:

```bash
cd mobile
node --experimental-strip-types src/upload/__tests__/fixtures/generate.ts
```

The generator writes both `sample-lab.pdf` and `sample-lab.base64.ts` in
this directory and prints the new sizes. Commit both regenerated files
together; the `SAMPLE_LAB_LINES` constant in `sample-lab.base64.ts` MUST
stay in lockstep with the bytes in `sample-lab.pdf`.

`pdftotext sample-lab.pdf -` is a useful sanity check that the new PDF is
valid and embeds the expected text.

## Why hand-rolled (not `pdfkit` / `pdf-lib`)

Avoids a devDep + a transitive font binary, keeps the generator
self-contained (one Node file, no install step), and produces byte-stable
output for diff visibility.
