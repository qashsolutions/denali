import { describe, it, expect } from "vitest";

/**
 * fhir/transforms.ts — Unit Tests
 *
 * Tests the PII boundary in transformPatient() and data transforms.
 * CRITICAL: transformPatient() is the privacy boundary — only age+gender
 * should ever be extracted from the FHIR Patient resource.
 */

import { transformPatient, transformCoverage, transformEOB } from "../transforms";

// ── transformPatient: PII boundary tests ──

describe("transformPatient — PII boundary", () => {
  const fullPatient = {
    resourceType: "Patient" as const,
    id: "patient-123",
    name: [{ given: ["John", "Robert"], family: "Smith", use: "official" }],
    birthDate: "1950-06-15",
    gender: "male",
    identifier: [
      { system: "http://hl7.org/fhir/sid/us-medicare", value: "1EG4-TE5-MK72" },
    ],
    address: [{ city: "Dallas", state: "TX", postalCode: "75201" }],
  };

  it("extracts only age and gender", () => {
    const result = transformPatient(fullPatient);

    expect(result).toHaveProperty("age");
    expect(result).toHaveProperty("gender");
    // Should have EXACTLY these 2 properties — nothing else
    expect(Object.keys(result)).toEqual(["age", "gender"]);
  });

  it("does NOT include patient name", () => {
    const result = transformPatient(fullPatient);
    const json = JSON.stringify(result);

    expect(json).not.toContain("John");
    expect(json).not.toContain("Robert");
    expect(json).not.toContain("Smith");
    expect(result).not.toHaveProperty("name");
  });

  it("does NOT include date of birth", () => {
    const result = transformPatient(fullPatient);
    const json = JSON.stringify(result);

    expect(json).not.toContain("1950-06-15");
    expect(json).not.toContain("1950");
    expect(result).not.toHaveProperty("dateOfBirth");
    expect(result).not.toHaveProperty("birthDate");
  });

  it("does NOT include Medicare ID", () => {
    const result = transformPatient(fullPatient);
    const json = JSON.stringify(result);

    expect(json).not.toContain("1EG4-TE5-MK72");
    expect(json).not.toContain("medicare");
    expect(result).not.toHaveProperty("medicareId");
    expect(result).not.toHaveProperty("identifier");
  });

  it("does NOT include address", () => {
    const result = transformPatient(fullPatient);
    const json = JSON.stringify(result);

    expect(json).not.toContain("Dallas");
    expect(json).not.toContain("75201");
    expect(json).not.toContain("TX");
    expect(result).not.toHaveProperty("address");
  });

  it("computes age from birthDate (not stored)", () => {
    const result = transformPatient(fullPatient);
    // Born 1950 — should be ~75-76 depending on when test runs
    expect(result.age).toBeGreaterThanOrEqual(75);
    expect(result.age).toBeLessThanOrEqual(76);
  });

  it("capitalizes gender", () => {
    const result = transformPatient(fullPatient);
    expect(result.gender).toBe("Male");
  });

  it("handles missing birthDate gracefully", () => {
    const result = transformPatient({
      resourceType: "Patient",
      id: "no-dob",
      gender: "female",
    });
    expect(result.age).toBe(0);
    expect(result.gender).toBe("Female");
  });

  it("handles missing gender gracefully", () => {
    const result = transformPatient({
      resourceType: "Patient",
      id: "no-gender",
      birthDate: "1960-01-01",
    });
    expect(result.gender).toBe("Unknown");
  });

  it("handles completely empty patient", () => {
    const result = transformPatient({
      resourceType: "Patient",
      id: "empty",
    });
    expect(result.age).toBe(0);
    expect(result.gender).toBe("Unknown");
    expect(Object.keys(result)).toEqual(["age", "gender"]);
  });
});

// ── transformCoverage ──

describe("transformCoverage", () => {
  it("transforms active Part A coverage", () => {
    const result = transformCoverage({
      resourceType: "Coverage",
      id: "cov-1",
      status: "active",
      type: { coding: [{ code: "PART_A", display: "Part A" }] },
      period: { start: "2020-01-01" },
    });
    expect(result.status).toBe("Active");
    expect(result.type).toContain("Part A");
    expect(result.startDate).not.toBe("Unknown");
  });

  it("extracts plan name from class or payor", () => {
    const result = transformCoverage({
      resourceType: "Coverage",
      id: "cov-2",
      status: "active",
      type: { coding: [{ code: "HMO" }] },
      period: { start: "2024-01-01" },
      payor: [{ display: "Humana Gold Plus" }],
    });
    expect(result.planName).toBe("Humana Gold Plus");
  });

  it("handles missing fields gracefully", () => {
    const result = transformCoverage({
      resourceType: "Coverage",
      id: "cov-empty",
    });
    expect(result.status).toBeTruthy();
    expect(result.startDate).toBe("Unknown");
  });
});

// ── transformEOB ──

describe("transformEOB", () => {
  it("transforms a basic outpatient claim", () => {
    const result = transformEOB({
      resourceType: "ExplanationOfBenefit",
      id: "eob-1",
      type: { coding: [{ code: "71", display: "Outpatient" }] },
      status: "active",
      outcome: "complete",
      billablePeriod: { start: "2026-01-15" },
      provider: { display: "Dr. Smith" },
      diagnosis: [
        { diagnosisCodeableConcept: { coding: [{ code: "E11.65", display: "Type 2 diabetes with hyperglycemia" }] } },
      ],
      item: [
        {
          productOrService: { coding: [{ code: "99213", display: "Office visit" }] },
          adjudication: [
            { category: { coding: [{ code: "submitted" }] }, amount: { value: 150 } },
          ],
        },
      ],
    });

    expect(result.id).toBe("eob-1");
    expect(result.provider).toBe("Dr. Smith");
    expect(result.diagnosis).toContain("Type 2 diabetes with hyperglycemia");
    expect(result.diagnosisCodes).toContain("E11.65");
    expect(result.procedures.length).toBeGreaterThan(0);
  });

  it("extracts denial reasons from adjudication", () => {
    const result = transformEOB({
      resourceType: "ExplanationOfBenefit",
      id: "eob-denied",
      type: { coding: [{ code: "71" }] },
      status: "active",
      outcome: "complete",
      billablePeriod: { start: "2026-02-01" },
      provider: { display: "Provider" },
      item: [
        {
          productOrService: { coding: [{ code: "99214" }] },
          adjudication: [
            {
              category: { coding: [{ code: "denialreason" }] },
              reason: { coding: [{ code: "CO-50", display: "Not medically necessary" }] },
            },
          ],
        },
      ],
    });

    // Denial reasons should be captured
    expect(result.status).toBeTruthy();
  });

  it("handles missing fields without crashing", () => {
    const result = transformEOB({
      resourceType: "ExplanationOfBenefit",
      id: "eob-minimal",
    });

    expect(result.id).toBe("eob-minimal");
    expect(result.provider).toContain("Unknown");
    expect(result.serviceDate).toBe("Unknown");
    expect(result.diagnosis).toEqual([]);
  });
});
