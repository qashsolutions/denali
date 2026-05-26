import { describe, it, expect } from "vitest";

/**
 * fhir/context.ts — Unit Tests
 *
 * Tests the consent gate and health context injection into Claude prompts.
 * CRITICAL: The consent gate is the last line of defense preventing health
 * data from reaching the AI without explicit user permission.
 */

import { buildHealthContextForPrompt } from "../context";
import type { SessionState } from "@/lib/session-state";

/** Minimal session state with health data available and consent ON */
function makeSessionState(overrides?: Partial<SessionState>): SessionState {
  return {
    userName: "Test",
    userZip: "12345",
    symptoms: [],
    duration: "",
    providerName: "",
    priorTreatments: [],
    diagnosisCodes: [],
    procedureCodes: [],
    denialCodes: [],
    coverageCriteria: [],
    policyReferences: [],
    requirementAnswers: {},
    requirementsToVerify: [],
    redFlags: [],
    verificationComplete: false,
    isAppeal: false,
    denialDate: null,
    priorAuthRequired: null,
    medicareType: null,
    maPlanName: null,
    email: null,
    healthDataAvailable: true,
    blueButtonConnected: true,
    consentHealthDataAi: true,
    conditions: [],
    medications: [],
    screenings: [],
    providers: [],
    hospitalizations: [],
    labs: [],
    activeCoverage: [],
    recentDenials: [],
    recentClaims: [],
    diabetesClassification: null,
    obesityClassification: null,
    isHospice: false,
    dme: [],
    labTrends: [],
    recentLogSummary: null,
    appealLevel: 1,
    priorAppealId: null,
    ...overrides,
  } as SessionState;
}

describe("buildHealthContextForPrompt — consent gate", () => {
  it("returns null when healthDataAvailable is false", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({ healthDataAvailable: false }),
    );
    expect(result).toBeNull();
  });

  it("returns null when consentHealthDataAi is false", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({ consentHealthDataAi: false }),
    );
    expect(result).toBeNull();
  });

  it("returns null when consentHealthDataAi is null (default OFF)", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({ consentHealthDataAi: null as unknown as boolean }),
    );
    expect(result).toBeNull();
  });

  it("returns null when consentHealthDataAi is undefined", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        consentHealthDataAi: undefined as unknown as boolean,
      }),
    );
    expect(result).toBeNull();
  });

  it("returns context only when consentHealthDataAi is exactly true", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({ consentHealthDataAi: true }),
    );
    expect(result).not.toBeNull();
    expect(result).toContain("PATIENT CHART");
  });

  it("returns null when healthDataAvailable is false even if consent is true", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        healthDataAvailable: false,
        consentHealthDataAi: true,
      }),
    );
    expect(result).toBeNull();
  });
});

describe("buildHealthContextForPrompt — hospice safety gate", () => {
  it("includes hospice warning when isHospice is true", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({ isHospice: true }),
    );
    expect(result).toContain("HOSPICE");
    expect(result).toContain("comfort");
  });

  it("does not include hospice warning when isHospice is false", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({ isHospice: false }),
    );
    expect(result).not.toContain("HOSPICE");
  });
});

describe("buildHealthContextForPrompt — data injection", () => {
  it("includes active coverage", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        activeCoverage: ["Medicare Part A", "Medicare Part B"],
      }),
    );
    expect(result).toContain("Active Coverage");
    expect(result).toContain("Medicare Part A");
    expect(result).toContain("Medicare Part B");
  });

  it("includes MA plan name when present", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        activeCoverage: ["Medicare Advantage"],
        maPlanName: "Humana Gold Plus",
      }),
    );
    expect(result).toContain("Humana Gold Plus");
  });

  it("includes diabetes conditions", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        conditions: [
          { name: "Type 2 diabetes", code: "E11.65", category: "type2" },
        ],
      }),
    );
    expect(result).toContain("Diabetes Diagnoses");
    expect(result).toContain("Type 2 diabetes");
    expect(result).toContain("E11.65");
  });

  it("includes obesity conditions separately", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        conditions: [
          { name: "Type 2 diabetes", code: "E11", category: "type2" },
          { name: "Morbid obesity", code: "E66.01", category: "obesity" },
        ],
      }),
    );
    expect(result).toContain("Diabetes Diagnoses");
    expect(result).toContain("Obesity Diagnoses");
    expect(result).toContain("Morbid obesity");
  });

  it("includes diabetes medications with refill gap warning", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        medications: [
          {
            name: "Metformin",
            status: "Active",
            isDiabetesMed: true,
            isObesityMed: false,
            daysSupply: 30,
            gapDays: 21,
            isBrandName: false,
          },
        ],
      }),
    );
    expect(result).toContain("Metformin");
    expect(result).toContain("REFILL OVERDUE");
    expect(result).toContain("21 days");
  });

  it("includes obesity medications separately from diabetes meds", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        medications: [
          {
            name: "Wegovy",
            status: "Active",
            isDiabetesMed: false,
            isObesityMed: true,
            daysSupply: 28,
            gapDays: 0,
            isBrandName: true,
          },
        ],
      }),
    );
    expect(result).toContain("Weight-Management Medications");
    expect(result).toContain("Wegovy");
  });

  it("includes overdue screenings with ACTION prompt", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        screenings: [
          {
            screeningType: "a1c",
            displayName: "A1C Test",
            lastDate: "2024-01-01",
            monthsSinceLast: 14,
            isOverdue: true,
          },
        ],
      }),
    );
    expect(result).toContain("A1C Test");
    expect(result).toContain("OVERDUE");
    expect(result).toContain("ACTION");
  });

  it("includes diabetes classification with action directives", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({ diabetesClassification: "pre-diabetic" }),
    );
    expect(result).toContain("Pre-Diabetic");
    expect(result).toContain("MDPP");
  });

  it("includes obesity classification with action directives", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({ obesityClassification: "obese" }),
    );
    expect(result).toContain("Obese");
    expect(result).toContain("IBT");
  });

  it("includes recent denied claims with appeal prompt", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        recentDenials: [
          {
            procedure: "MRI Lumbar Spine",
            serviceDate: "2026-01-15",
            denialCode: "CO-50",
            denialReason: "Not medically necessary",
          },
        ],
      }),
    );
    expect(result).toContain("Denied Claims");
    expect(result).toContain("MRI Lumbar Spine");
    expect(result).toContain("appeal");
  });

  it("includes recent claims for EOB review", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        recentClaims: [
          {
            serviceDate: "2026-03-01",
            type: "Outpatient",
            status: "Paid",
            provider: "Dr. Smith",
            procedures: ["Office Visit"],
            diagnosis: ["Diabetes Type 2"],
            totalCharged: "$250.00",
            medicarePaid: "$200.00",
            youOwe: "$50.00",
          },
        ],
      }),
    );
    expect(result).toContain("Recent Claims");
    expect(result).toContain("Dr. Smith");
    expect(result).toContain("$250.00");
  });

  it("includes denial reason for denied claims in EOB", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        recentClaims: [
          {
            serviceDate: "2026-03-01",
            type: "Outpatient",
            status: "Denied",
            provider: "Dr. Smith",
            procedures: ["MRI"],
            diagnosis: ["Back pain"],
            totalCharged: "$1500.00",
            medicarePaid: "$0.00",
            youOwe: "$1500.00",
            denialReasons: ["Prior authorization required"],
          },
        ],
      }),
    );
    expect(result).toContain("Denial reason");
    expect(result).toContain("Prior authorization required");
  });

  it("includes hospitalizations with follow-up flag", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        hospitalizations: [
          {
            admissionDate: "2026-03-01",
            dischargeDate: "2026-03-05",
            lengthOfStay: 4,
            daysSinceDischarge: 10,
            needsFollowUp: true,
            provider: "City Hospital",
            diagnoses: ["Pneumonia"],
          },
        ],
      }),
    );
    expect(result).toContain("Recent Hospitalizations");
    expect(result).toContain("FOLLOW-UP NEEDED");
    expect(result).toContain("City Hospital");
  });

  it("includes care team providers", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        providers: [
          {
            name: "Dr. Chen",
            specialty: "Endocrinology",
            visitCount: 3,
            lastSeen: "2026-02-15",
          },
        ],
      }),
    );
    expect(result).toContain("Care Team");
    expect(result).toContain("Dr. Chen");
    expect(result).toContain("Endocrinology");
  });

  it("includes DME supplies", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        dme: [
          {
            category: "glucose-monitor",
            items: ["FreeStyle Libre"],
            isRelevantToDiabetes: true,
            isRelevantToObesity: false,
          },
        ],
      }),
    );
    expect(result).toContain("DME Supplies");
    expect(result).toContain("FreeStyle Libre");
  });

  it("includes A1C trend history with direction arrows", () => {
    const result = buildHealthContextForPrompt(
      makeSessionState({
        labTrends: [
          { loincCode: "4548-4", date: "2025-06-01", value: 7.2 },
          { loincCode: "4548-4", date: "2025-12-01", value: 6.8 },
        ],
      }),
    );
    expect(result).toContain("A1C History");
    expect(result).toContain("7.2%");
    expect(result).toContain("6.8%");
    expect(result).toContain("improving");
  });

  it("truncates health context at 4KB safety cap", () => {
    // Create sessionState with enough data to exceed 4096 chars
    const longCoverage = Array.from(
      { length: 200 },
      (_, i) => `Medicare Coverage Item ${i} with extra detail text`,
    );
    const result = buildHealthContextForPrompt(
      makeSessionState({ activeCoverage: longCoverage }),
    );
    expect(result!.length).toBeLessThanOrEqual(4096 + 50); // 50 chars buffer for truncation message
    expect(result).toContain("[Health data truncated");
  });

  it("includes reminder postamble at end", () => {
    const result = buildHealthContextForPrompt(makeSessionState());
    expect(result).toContain("REMINDER");
    expect(result).toContain("full Medicare chart");
  });
});
