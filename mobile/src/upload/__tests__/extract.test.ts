/**
 * extract.test.ts — wrapper-logic tests for `src/upload/extract.ts`.
 *
 * SCOPE — what these tests prove:
 *
 *   The shim around `expo-pdf-text-extract` maps native-module outputs to
 *   the `ExtractResult` contract that `UploadScreen.tsx` consumes:
 *
 *     - PDF + non-empty text          → { ok: true,  text, method }
 *     - PDF + empty / whitespace text → { ok: false, reason: "pdf_has_no_text_layer" }
 *     - PDF + native throws           → { ok: false, reason: "extract_failed", detail }
 *     - PDF + isAvailable() === false → { ok: false, reason: "extract_failed", detail }
 *     - image (any platform)          → { ok: false, reason: "ocr_not_supported_phase_1" }
 *
 * SCOPE — what these tests do NOT prove:
 *
 *   The actual on-device native bridge — `expo-pdf-text-extract` calling
 *   PDFKit (iOS) / PDFBox (Android) — does NOT run in vitest's node
 *   environment. Native modules cannot be loaded without a device or
 *   simulator. The native bridge is therefore mocked here.
 *
 *   The real native extraction + Hermes + New-Arch interop is verified
 *   separately by running `npx expo run:ios` / `npx expo run:android`
 *   against the same `sample-lab.pdf` fixture. See
 *   `docs/history/phase-1-mobile-decisions.md` § D13 for the validation
 *   record across both platforms.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PickedFile } from "../picker";

// ── Hoisted shared state for the mocks ──────────────────────────────────
// `vi.mock` factories are hoisted to the top of the file, before any
// top-level `const`/`class` declarations. Anything they close over must
// itself be hoisted via `vi.hoisted` so the factory can see it.

const fixtures = vi.hoisted(() => {
  // Load the fixture bytes *outside* the hoisted block — `vi.hoisted`
  // returns synchronously, and the fixture bytes are accessed from
  // both the mock factory (blobStore) and the test cases.
  const { readFileSync: hRead } = require("node:fs") as typeof import("node:fs");
  const { resolve: hResolve } = require("node:path") as typeof import("node:path");
  const path = hResolve(__dirname, "fixtures/sample-lab.pdf");
  const bytes = new Uint8Array(hRead(path));
  return { bytes };
});

const FIXTURE_BYTES = fixtures.bytes;

const mocks = vi.hoisted(() => {
  const extractTextMock =
    vi.fn<(uri: string, password?: string) => Promise<string>>();
  const isAvailableMock = vi.fn<() => boolean>();

  // In-memory file system for the temp-file dance. Defined inside the
  // hoisted block so the `expo-file-system` mock factory can reference
  // both the data store and the fake classes without TDZ issues.
  const fakeFs: Record<string, Uint8Array> = {};

  class FakeDirectory {
    root: { uri: string } | string;
    name?: string;
    constructor(root: { uri: string } | string, name?: string) {
      this.root = root;
      this.name = name;
    }
    get uri(): string {
      const base = typeof this.root === "string" ? this.root : this.root.uri;
      return this.name ? `${base.replace(/\/$/, "")}/${this.name}` : base;
    }
    get exists(): boolean {
      return true;
    }
    create(_opts?: { intermediates?: boolean }): void {
      void _opts;
    }
  }

  class FakeFile {
    uri: string;
    constructor(...parts: Array<{ uri: string } | string | FakeFile>) {
      const segments = parts.map((p) =>
        typeof p === "string" ? p : "uri" in p ? p.uri : "",
      );
      const base = segments[0].replace(/\/$/, "");
      const tail = segments.slice(1).join("/").replace(/^\//, "");
      this.uri = tail ? `${base}/${tail}` : base;
    }
    get exists(): boolean {
      return this.uri in fakeFs;
    }
    create(): void {
      if (!(this.uri in fakeFs)) fakeFs[this.uri] = new Uint8Array(0);
    }
    write(content: Uint8Array | string): void {
      if (typeof content === "string") {
        fakeFs[this.uri] = new TextEncoder().encode(content);
      } else {
        fakeFs[this.uri] = new Uint8Array(content);
      }
    }
    delete(): void {
      delete fakeFs[this.uri];
    }
  }

  return { extractTextMock, isAvailableMock, fakeFs, FakeDirectory, FakeFile };
});

const { extractTextMock, isAvailableMock, fakeFs } = mocks;

// ── Mock the native PDF bridge ───────────────────────────────────────────
// `expo-pdf-text-extract` is a native module — its real `requireNativeModule`
// call cannot resolve in a node environment. We mock it before importing
// the module under test.

vi.mock("expo-pdf-text-extract", () => ({
  extractText: (uri: string, password?: string) =>
    mocks.extractTextMock(uri, password),
  isAvailable: () => mocks.isAvailableMock(),
}));

// ── Mock the encrypted-blob reader ───────────────────────────────────────
// `extract.ts` calls `readBlob(reportId)` to decrypt the on-device blob.
// We return the fixture bytes directly so the wrapper sees real PDF bytes
// (though the native bridge is mocked).

vi.mock("../blobStore", () => ({
  readBlob: vi.fn(async (_reportId: string) => fixtures.bytes),
}));

// ── Mock expo-file-system so the temp-file dance doesn't touch real disk ──

vi.mock("expo-file-system", () => ({
  Directory: mocks.FakeDirectory,
  File: mocks.FakeFile,
  Paths: { cache: { uri: "file:///fake/cache" } },
}));

// Import AFTER all mocks are registered.
import { extractText } from "../extract";

// ── Helpers ──────────────────────────────────────────────────────────────

function makePdf(): PickedFile {
  return {
    kind: "pdf",
    uri: "file:///fake/pick/sample-lab.pdf",
    mimeType: "application/pdf",
    name: "sample-lab.pdf",
    size: FIXTURE_BYTES.byteLength,
  };
}

function makeImage(): PickedFile {
  return {
    kind: "image",
    uri: "file:///fake/pick/photo.jpg",
    mimeType: "image/jpeg",
    name: "photo.jpg",
    size: 12345,
  };
}

// ── Sanity check the fixture ─────────────────────────────────────────────
// This is the "the fixture is a real PDF" check. It does NOT exercise the
// native bridge; it just proves the bytes have the expected PDF header
// and embedded text strings — so a future maintainer who tweaks the
// generator notices if the fixture stops being a valid PDF.

describe("fixture sanity", () => {
  it("starts with the PDF 1.4 header", () => {
    const head = new TextDecoder().decode(FIXTURE_BYTES.subarray(0, 8));
    expect(head).toBe("%PDF-1.4");
  });

  it("embeds the expected lab text lines as literal substrings", () => {
    const raw = new TextDecoder("latin1").decode(FIXTURE_BYTES);
    // PDF content stream uses unescaped parentheses to delimit strings;
    // the literal text lines appear verbatim inside the stream.
    expect(raw).toContain("Glucose 95 mg/dL");
    expect(raw).toContain("Cholesterol 180 mg/dL");
    expect(raw).toContain("HbA1c 5.6%");
  });
});

// ── Wrapper-logic tests ──────────────────────────────────────────────────

describe("extractText wrapper logic", () => {
  beforeEach(() => {
    extractTextMock.mockReset();
    isAvailableMock.mockReset();
    // Default: native module is available. Each test can override.
    isAvailableMock.mockReturnValue(true);
    Object.keys(fakeFs).forEach((k) => delete fakeFs[k]);
  });

  it("returns ok=true with method='pdf-text-layer' on non-empty text", async () => {
    extractTextMock.mockResolvedValueOnce(
      "Glucose 95 mg/dL\nCholesterol 180 mg/dL\nHbA1c 5.6%",
    );

    const result = await extractText(makePdf(), "rep-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.method).toBe("pdf-text-layer");
      expect(result.text).toContain("Glucose 95 mg/dL");
      expect(result.text).toContain("HbA1c 5.6%");
    }
    expect(extractTextMock).toHaveBeenCalledTimes(1);
    // The wrapper passes a `file://` URI inside Paths.cache — never the
    // picker's raw uri, since the bytes live encrypted in the blob store.
    const passedUri = extractTextMock.mock.calls[0][0];
    expect(passedUri).toContain("/fake/cache/");
    expect(passedUri).toContain("rep-1.pdf");
  });

  it("returns pdf_has_no_text_layer when the native bridge yields empty text", async () => {
    extractTextMock.mockResolvedValueOnce("");

    const result = await extractText(makePdf(), "rep-2");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("pdf_has_no_text_layer");
    }
  });

  it("returns pdf_has_no_text_layer when the bridge yields whitespace-only text", async () => {
    extractTextMock.mockResolvedValueOnce("   \n   \t  ");

    const result = await extractText(makePdf(), "rep-3");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("pdf_has_no_text_layer");
    }
  });

  it("returns pdf_has_no_text_layer when extracted text is shorter than 16 chars", async () => {
    // Below the 16-char threshold the extractor treats it as a scan signal —
    // a real one-line lab snippet exceeds 16 chars comfortably.
    extractTextMock.mockResolvedValueOnce("OK");

    const result = await extractText(makePdf(), "rep-4");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("pdf_has_no_text_layer");
    }
  });

  it("returns extract_failed with the error message when the bridge throws", async () => {
    extractTextMock.mockRejectedValueOnce(new Error("CORRUPT_PDF"));

    const result = await extractText(makePdf(), "rep-5");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("extract_failed");
      expect(result.detail).toBe("CORRUPT_PDF");
    }
  });

  it("returns extract_failed when the bridge rejects with a non-Error value", async () => {
    extractTextMock.mockRejectedValueOnce("string-error");

    const result = await extractText(makePdf(), "rep-6");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("extract_failed");
      expect(result.detail).toBe("string-error");
    }
  });

  it("returns extract_failed without calling the bridge when isAvailable() is false", async () => {
    isAvailableMock.mockReturnValue(false);

    const result = await extractText(makePdf(), "rep-7");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("extract_failed");
      expect(result.detail).toContain("development build");
    }
    expect(extractTextMock).not.toHaveBeenCalled();
  });

  it("returns ocr_not_supported_phase_1 for image kinds without calling the PDF bridge", async () => {
    const result = await extractText(makeImage(), "rep-8");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ocr_not_supported_phase_1");
      expect(result.detail).toContain("Image OCR");
    }
    expect(extractTextMock).not.toHaveBeenCalled();
  });

  it("cleans up the temp file in the finally branch even on success", async () => {
    extractTextMock.mockResolvedValueOnce(
      "Glucose 95 mg/dL\nCholesterol 180 mg/dL\nHbA1c 5.6%",
    );

    await extractText(makePdf(), "rep-9");

    // The wrapper stages bytes into `<cache>/pdf-extract-tmp/<reportId>.pdf`
    // and unlinks in `finally`. After a successful extraction the temp
    // file MUST be gone — plaintext bytes do not linger on disk.
    const tempPath = "file:///fake/cache/pdf-extract-tmp/rep-9.pdf";
    expect(tempPath in fakeFs).toBe(false);
  });

  it("cleans up the temp file even when the bridge throws", async () => {
    extractTextMock.mockRejectedValueOnce(new Error("CORRUPT_PDF"));

    await extractText(makePdf(), "rep-10");

    const tempPath = "file:///fake/cache/pdf-extract-tmp/rep-10.pdf";
    expect(tempPath in fakeFs).toBe(false);
  });
});
