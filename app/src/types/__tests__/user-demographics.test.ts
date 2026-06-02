import { describe, it, expect } from "vitest";
import {
  SEX_AT_BIRTH_VALUES,
  GENDER_IDENTITY_VALUES,
  SEX_AT_BIRTH_LABELS,
  GENDER_IDENTITY_LABELS,
  SEX_AT_BIRTH_UI_OPTIONS,
  isValidSexAtBirth,
  isValidGenderIdentity,
  type SexAtBirth,
  type GenderIdentity,
} from "../user-demographics";

/**
 * Chunk 3 — user-demographics value sets, labels, and UI option lists.
 *
 * Tests verify the shared data the Settings page (Step 7) and onboarding
 * form (Step 6) both consume. UI render + PATCH-on-change flow is covered
 * by Playwright E2E (vitest is node env; no jsdom/RTL).
 */

// ─── Label maps — exhaustiveness ────────────────────────────────────────────

describe("SEX_AT_BIRTH_LABELS", () => {
  it("has a label for every SexAtBirth value (no missing keys)", () => {
    for (const v of SEX_AT_BIRTH_VALUES) {
      expect(SEX_AT_BIRTH_LABELS[v]).toBeDefined();
      expect(typeof SEX_AT_BIRTH_LABELS[v]).toBe("string");
      expect(SEX_AT_BIRTH_LABELS[v].length).toBeGreaterThan(0);
    }
  });

  it("maps 'unknown' to 'Prefer not to say' (the v1 UI label for the unknown enum)", () => {
    // This mapping is load-bearing — the onboarding form and Settings both
    // display "Prefer not to say" to the user, which writes "unknown" to DB.
    expect(SEX_AT_BIRTH_LABELS.unknown).toBe("Prefer not to say");
  });
});

describe("GENDER_IDENTITY_LABELS", () => {
  it("has a label for every GenderIdentity value (no missing keys)", () => {
    for (const v of GENDER_IDENTITY_VALUES) {
      expect(GENDER_IDENTITY_LABELS[v]).toBeDefined();
      expect(typeof GENDER_IDENTITY_LABELS[v]).toBe("string");
      expect(GENDER_IDENTITY_LABELS[v].length).toBeGreaterThan(0);
    }
  });

  it("maps 'prefer-not-to-say' to 'Prefer not to say'", () => {
    expect(GENDER_IDENTITY_LABELS["prefer-not-to-say"]).toBe(
      "Prefer not to say",
    );
  });
});

// ─── SEX_AT_BIRTH_UI_OPTIONS — v1 UI invariants ─────────────────────────────

describe("SEX_AT_BIRTH_UI_OPTIONS", () => {
  it("has exactly 3 entries (v1 UI lock — no Intersex visible)", () => {
    expect(SEX_AT_BIRTH_UI_OPTIONS.length).toBe(3);
  });

  it("preserves the spec-locked order: male, female, unknown", () => {
    expect(SEX_AT_BIRTH_UI_OPTIONS[0].value).toBe("male");
    expect(SEX_AT_BIRTH_UI_OPTIONS[1].value).toBe("female");
    expect(SEX_AT_BIRTH_UI_OPTIONS[2].value).toBe("unknown");
  });

  it("does NOT include 'intersex' in the v1 UI options", () => {
    // intersex is a valid SexAtBirth enum value (API-settable) but not in
    // the v1 picker. Documented edge in Settings: dropdown shows blank when
    // current value is "intersex".
    const values = SEX_AT_BIRTH_UI_OPTIONS.map((o) => o.value);
    expect(values).not.toContain("intersex");
  });

  it("every UI option value is a valid SexAtBirth (cross-check with type guard)", () => {
    for (const opt of SEX_AT_BIRTH_UI_OPTIONS) {
      expect(isValidSexAtBirth(opt.value)).toBe(true);
    }
  });

  it("label for each UI option matches the SEX_AT_BIRTH_LABELS source-of-truth", () => {
    for (const opt of SEX_AT_BIRTH_UI_OPTIONS) {
      expect(opt.label).toBe(SEX_AT_BIRTH_LABELS[opt.value]);
    }
  });
});

// ─── Type-guard sanity ──────────────────────────────────────────────────────

describe("Type guards reject UI-only labels (defense against accidental misuse)", () => {
  it("isValidSexAtBirth rejects the human-readable label 'Prefer not to say'", () => {
    // Cookie/payload values must be the enum value ("unknown"), not the label.
    expect(isValidSexAtBirth("Prefer not to say")).toBe(false);
  });

  it("isValidGenderIdentity rejects the human-readable label 'Transgender male'", () => {
    expect(isValidGenderIdentity("Transgender male")).toBe(false);
    // The actual enum value is the kebab-case version
    expect(isValidGenderIdentity("transgender-male")).toBe(true);
  });
});

// Type sanity — these don't run, just verify exports compile.
const _sabType: SexAtBirth = "male";
const _giType: GenderIdentity = "non-binary";
void _sabType;
void _giType;
