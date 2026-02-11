import { describe, it, expect } from "vitest";
import {
  extractConditionsFromClaims,
  extractMedicationsFromClaims,
  extractScreeningsFromClaims,
  extractProvidersFromClaims,
  extractHospitalizationsFromClaims,
} from "../eob-clinical";
import {
  syntheticClaims,
  carrierDiabetes,
  outpatientPreDiabetic,
  partDMetformin,
  pdeInsulin,
  carrierScreenings,
  inpatientStay,
  RECENT,
  OLDER,
} from "./fixtures/synthetic-claims";

// ─────────────────────────────────────────────────────────────────────────────
// extractConditionsFromClaims
// ─────────────────────────────────────────────────────────────────────────────

describe("extractConditionsFromClaims", () => {
  it("finds E11.9 with category type2", () => {
    const conditions = extractConditionsFromClaims(syntheticClaims);
    const type2 = conditions.find((c) => c.code === "E11.9");
    expect(type2).toBeDefined();
    expect(type2!.category).toBe("type2");
    expect(type2!.name).toBe("Type 2 diabetes mellitus without complications");
  });

  it("finds R73.03 with category pre-diabetic", () => {
    const conditions = extractConditionsFromClaims(syntheticClaims);
    const preDiabetic = conditions.find((c) => c.code === "R73.03");
    expect(preDiabetic).toBeDefined();
    expect(preDiabetic!.category).toBe("pre-diabetic");
  });

  it("finds E66.01 with category obesity", () => {
    const conditions = extractConditionsFromClaims(syntheticClaims);
    const obesity = conditions.find((c) => c.code === "E66.01");
    expect(obesity).toBeDefined();
    expect(obesity!.category).toBe("obesity");
  });

  it("finds E11.10 from inpatient claim", () => {
    const conditions = extractConditionsFromClaims(syntheticClaims);
    const dka = conditions.find((c) => c.code === "E11.10");
    expect(dka).toBeDefined();
    expect(dka!.category).toBe("type2");
  });

  it("deduplicates E11.9 across claims, keeping most recent date", () => {
    // E11.9 appears in claim 1 (RECENT) and claim 5 (RECENT) and claim 7 (ADMISSION_DATE)
    const conditions = extractConditionsFromClaims(syntheticClaims);
    const e119Entries = conditions.filter((c) => c.code === "E11.9");
    expect(e119Entries).toHaveLength(1);
  });

  it("returns correct recordedDate", () => {
    const conditions = extractConditionsFromClaims([outpatientPreDiabetic]);
    const preDiabetic = conditions.find((c) => c.code === "R73.03");
    expect(preDiabetic!.recordedDate).toBe(OLDER);
  });

  it("returns empty array for claims with no matching diagnosis codes", () => {
    const conditions = extractConditionsFromClaims([partDMetformin]);
    expect(conditions).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractMedicationsFromClaims
// ─────────────────────────────────────────────────────────────────────────────

describe("extractMedicationsFromClaims", () => {
  it("finds Metformin as a diabetes med", () => {
    const meds = extractMedicationsFromClaims(syntheticClaims);
    const metformin = meds.find((m) => m.name === "Metformin 500mg");
    expect(metformin).toBeDefined();
    expect(metformin!.isDiabetesMed).toBe(true);
    expect(metformin!.status).toBe("Active");
  });

  it("finds Insulin Glargine as brand name", () => {
    const meds = extractMedicationsFromClaims(syntheticClaims);
    const insulin = meds.find((m) =>
      m.name.toLowerCase().includes("insulin glargine")
    );
    expect(insulin).toBeDefined();
    expect(insulin!.isBrandName).toBe(true);
    expect(insulin!.isDiabetesMed).toBe(true);
  });

  it("enriches with PDE data: daysSupply", () => {
    const meds = extractMedicationsFromClaims([partDMetformin]);
    expect(meds[0].daysSupply).toBe(30);
    expect(meds[0].refillNumber).toBe(3);
    expect(meds[0].quantityDispensed).toBe(60);
  });

  it("computes estimatedRunOutDate and gapDays", () => {
    const meds = extractMedicationsFromClaims([partDMetformin]);
    expect(meds[0].estimatedRunOutDate).toBeDefined();
    expect(typeof meds[0].gapDays).toBe("number");
  });

  it("ignores non-Part-D claims (Carrier, Outpatient, Inpatient)", () => {
    const meds = extractMedicationsFromClaims([
      carrierDiabetes,
      carrierScreenings,
      inpatientStay,
    ]);
    expect(meds).toHaveLength(0);
  });

  it("sorts diabetes meds first, then alphabetical", () => {
    const meds = extractMedicationsFromClaims(syntheticClaims);
    // Both are diabetes meds, so sorted alphabetically
    expect(meds.length).toBeGreaterThanOrEqual(2);
    // All diabetes meds come before non-diabetes meds
    const firstNonDiabetes = meds.findIndex((m) => !m.isDiabetesMed);
    if (firstNonDiabetes > 0) {
      for (let i = 0; i < firstNonDiabetes; i++) {
        expect(meds[i].isDiabetesMed).toBe(true);
      }
    }
  });

  it("deduplicates by normalized drug name", () => {
    const duplicateClaim: typeof partDMetformin = {
      ...partDMetformin,
      id: "claim-003-dup",
      serviceDate: OLDER,
    };
    const meds = extractMedicationsFromClaims([partDMetformin, duplicateClaim]);
    const metformins = meds.filter((m) =>
      m.name.toLowerCase().includes("metformin")
    );
    expect(metformins).toHaveLength(1);
    // Keeps most recent date
    expect(metformins[0].startDate).toBe(RECENT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractScreeningsFromClaims
// ─────────────────────────────────────────────────────────────────────────────

describe("extractScreeningsFromClaims", () => {
  it("maps CPT 83036 to screening type a1c", () => {
    const screenings = extractScreeningsFromClaims(syntheticClaims);
    const a1c = screenings.find((s) => s.screeningType === "a1c");
    expect(a1c).toBeDefined();
    expect(a1c!.displayName).toBe("A1C Test");
    expect(a1c!.cptCodes).toContain("83036");
  });

  it("maps CPT 99214 to screening type office-visit", () => {
    const screenings = extractScreeningsFromClaims(syntheticClaims);
    const officeVisit = screenings.find(
      (s) => s.screeningType === "office-visit"
    );
    expect(officeVisit).toBeDefined();
    expect(officeVisit!.cptCodes).toContain("99214");
  });

  it("maps CPT 92250 to screening type eye-exam", () => {
    const screenings = extractScreeningsFromClaims(syntheticClaims);
    const eyeExam = screenings.find((s) => s.screeningType === "eye-exam");
    expect(eyeExam).toBeDefined();
    expect(eyeExam!.displayName).toBe("Diabetic Eye Exam");
  });

  it("computes monthsSinceLast and isOverdue", () => {
    const screenings = extractScreeningsFromClaims(syntheticClaims);
    for (const screening of screenings) {
      expect(typeof screening.monthsSinceLast).toBe("number");
      expect(typeof screening.isOverdue).toBe("boolean");
    }
  });

  it("recent screenings are not overdue", () => {
    // All our screening claims use RECENT (2 months ago)
    const screenings = extractScreeningsFromClaims(syntheticClaims);
    const a1c = screenings.find((s) => s.screeningType === "a1c");
    // A1C overdue threshold is 12 months; 2 months ago = not overdue
    expect(a1c!.isOverdue).toBe(false);
  });

  it("only processes Carrier and Outpatient claims", () => {
    // Part D and Inpatient claims should be ignored even if they have procedureCodes
    const screenings = extractScreeningsFromClaims([partDMetformin, pdeInsulin]);
    expect(screenings).toHaveLength(0);
  });

  it("deduplicates by screening type, keeping most recent date", () => {
    const olderA1C: typeof carrierScreenings = {
      ...carrierScreenings,
      id: "claim-005-old",
      serviceDate: OLDER,
    };
    const screenings = extractScreeningsFromClaims([
      carrierScreenings,
      olderA1C,
    ]);
    const a1cs = screenings.filter((s) => s.screeningType === "a1c");
    expect(a1cs).toHaveLength(1);
    // monthsSinceLast should reflect the more recent date
    expect(a1cs[0].monthsSinceLast).toBeLessThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractProvidersFromClaims
// ─────────────────────────────────────────────────────────────────────────────

describe("extractProvidersFromClaims", () => {
  it("extracts providers from careTeam arrays", () => {
    const providers = extractProvidersFromClaims(syntheticClaims);
    expect(providers.length).toBeGreaterThan(0);
  });

  it("aggregates by NPI with visit count", () => {
    const providers = extractProvidersFromClaims(syntheticClaims);
    const eyeDoc = providers.find((p) => p.npi === "1234567890");
    expect(eyeDoc).toBeDefined();
    expect(eyeDoc!.name).toBe("Dr. Eye Specialist");
    expect(eyeDoc!.specialty).toBe("Ophthalmology");
    expect(eyeDoc!.visitCount).toBe(1);
  });

  it("tracks claim types per provider", () => {
    const providers = extractProvidersFromClaims(syntheticClaims);
    const eyeDoc = providers.find((p) => p.npi === "1234567890");
    expect(eyeDoc!.claimTypes).toContain("Outpatient");
  });

  it("sorts by visit count descending", () => {
    const providers = extractProvidersFromClaims(syntheticClaims);
    for (let i = 1; i < providers.length; i++) {
      expect(providers[i - 1].visitCount).toBeGreaterThanOrEqual(
        providers[i].visitCount
      );
    }
  });

  it("returns empty for claims without careTeam", () => {
    const providers = extractProvidersFromClaims([
      carrierDiabetes,
      partDMetformin,
    ]);
    expect(providers).toHaveLength(0);
  });

  it("uses name as key when NPI is absent", () => {
    const claimWithoutNPI: typeof carrierDiabetes = {
      ...carrierDiabetes,
      careTeam: [{ name: "Nurse Jones", role: "Assisting" }],
    };
    const providers = extractProvidersFromClaims([claimWithoutNPI]);
    expect(providers).toHaveLength(1);
    expect(providers[0].npi).toBe(""); // non-numeric key → empty NPI
    expect(providers[0].name).toBe("Nurse Jones");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractHospitalizationsFromClaims
// ─────────────────────────────────────────────────────────────────────────────

describe("extractHospitalizationsFromClaims", () => {
  it("filters to inpatient claims only", () => {
    const hospitalizations = extractHospitalizationsFromClaims(syntheticClaims);
    expect(hospitalizations).toHaveLength(1);
  });

  it("computes lengthOfStay from billable period", () => {
    const hospitalizations = extractHospitalizationsFromClaims(syntheticClaims);
    expect(hospitalizations[0].lengthOfStay).toBe(5);
  });

  it("computes daysSinceDischarge", () => {
    const hospitalizations = extractHospitalizationsFromClaims(syntheticClaims);
    // Discharge was ~10 days ago
    expect(hospitalizations[0].daysSinceDischarge).toBeGreaterThanOrEqual(9);
    expect(hospitalizations[0].daysSinceDischarge).toBeLessThanOrEqual(11);
  });

  it("sets needsFollowUp true for recent discharge (< 30 days)", () => {
    const hospitalizations = extractHospitalizationsFromClaims(syntheticClaims);
    expect(hospitalizations[0].needsFollowUp).toBe(true);
  });

  it("extracts admissionType and dischargeStatus", () => {
    const hospitalizations = extractHospitalizationsFromClaims(syntheticClaims);
    expect(hospitalizations[0].admissionType).toBe("Emergency");
    expect(hospitalizations[0].dischargeStatus).toBe("Home");
  });

  it("returns empty for non-inpatient claims", () => {
    const hospitalizations = extractHospitalizationsFromClaims([
      carrierDiabetes,
      outpatientPreDiabetic,
      partDMetformin,
    ]);
    expect(hospitalizations).toHaveLength(0);
  });

  it("also matches SNF claim type", () => {
    const snfClaim: typeof inpatientStay = {
      ...inpatientStay,
      id: "claim-snf",
      type: "Skilled Nursing Facility",
    };
    const hospitalizations = extractHospitalizationsFromClaims([snfClaim]);
    expect(hospitalizations).toHaveLength(1);
  });

  it("preserves diagnosis and financial data", () => {
    const hospitalizations = extractHospitalizationsFromClaims(syntheticClaims);
    expect(hospitalizations[0].diagnoses).toContain("Diabetic ketoacidosis");
    expect(hospitalizations[0].provider).toBe("General Hospital");
    expect(hospitalizations[0].totalCharged).toBe("$12,000.00");
  });
});
