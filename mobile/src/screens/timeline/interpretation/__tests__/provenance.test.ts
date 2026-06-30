/**
 * Provenance invariants — table v1.2 (operator-approved plan, 2026-06-09).
 *
 * Pins the EVIDENCE & PROVENANCE PIPELINE rules:
 *   1. Every shipped instrument entry carries a complete ProvenanceRecord.
 *   2. review_status === "pending_clinical_review" on every CC-authored
 *      entry ⇒ every band stays provisional (the ‡ render key). CC never
 *      ships "clinically_reviewed" — when a named human review lands,
 *      this test is updated alongside lastClinicallyReviewedBy in the
 *      same reviewed change.
 *   3. provenance.source mirrors the deprecated cutoffSource (v1.2
 *      mirror invariant; v1.3 drops cutoffSource).
 *   4. Vocabulary-level provenance records exist and are pending review.
 */
import { describe, expect, it } from "vitest";

import {
  CONDITIONS_45_PLUS_PROVENANCE,
  SYMPTOMS_PROVENANCE,
} from "../../../../onboarding/vocab";
import {
  flattenStrategyBands,
  INTERPRETATION_TABLE_V1,
} from "../tableV1";

const instruments = Object.entries(INTERPRETATION_TABLE_V1.instruments);

describe("provenance — instrument entries (table v1.2)", () => {
  it("ships 8 instrument entries", () => {
    expect(instruments).toHaveLength(8);
  });

  it.each(instruments.map(([id]) => [id]))(
    "%s carries a complete provenance record",
    (id) => {
      const entry = INTERPRETATION_TABLE_V1.instruments[id];
      expect(entry.provenance).toBeDefined();
      expect(entry.provenance.source.length).toBeGreaterThan(0);
      // Null until the terminology-verifier pins them — never invented.
      expect(
        entry.provenance.pmid_or_code_system_version === null ||
          typeof entry.provenance.pmid_or_code_system_version === "string",
      ).toBe(true);
      expect(
        entry.provenance.retrieved_at === null ||
          typeof entry.provenance.retrieved_at === "string",
      ).toBe(true);
    },
  );

  it.each(instruments.map(([id]) => [id]))(
    "%s: pending review ⇒ every band provisional (‡ render key)",
    (id) => {
      const entry = INTERPRETATION_TABLE_V1.instruments[id];
      expect(entry.provenance.review_status).toBe("pending_clinical_review");
      for (const band of flattenStrategyBands(entry.strategy)) {
        expect(band.provisional).toBe(true);
      }
    },
  );

  it.each(instruments.map(([id]) => [id]))(
    "%s: provenance.source mirrors deprecated cutoffSource (v1.2 invariant)",
    (id) => {
      const entry = INTERPRETATION_TABLE_V1.instruments[id];
      expect(entry.provenance.source).toBe(entry.cutoffSource);
    },
  );

  it("no entry ships clinically_reviewed while the table names no reviewer", () => {
    expect(INTERPRETATION_TABLE_V1.lastClinicallyReviewedBy).toBeNull();
    for (const [, entry] of instruments) {
      expect(entry.provenance.review_status).not.toBe("clinically_reviewed");
    }
  });
});

describe("provenance — vocabularies", () => {
  it.each([
    ["CONDITIONS_45_PLUS", CONDITIONS_45_PLUS_PROVENANCE],
    ["SYMPTOMS", SYMPTOMS_PROVENANCE],
  ])("%s carries a pending vocabulary-level record", (_name, rec) => {
    expect(rec.source.length).toBeGreaterThan(0);
    expect(rec.review_status).toBe("pending_clinical_review");
  });
});
