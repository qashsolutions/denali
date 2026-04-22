import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * learning.ts — Unit Tests
 *
 * Tests entity extraction (pure regex logic), confidence-based mapping
 * upserts with RPC fallback, feedback processing, prompt injection
 * formatting, and learning orchestration.
 *
 * Per plan: /Users/cvr/.claude/plans/pure-petting-lamport.md
 */

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import {
  extractEntities,
  buildLearningPromptInjection,
  buildFlywheelPromptInjection,
  updateSymptomMapping,
  updateProcedureMapping,
  recordCoveragePath,
  processFeedback,
  getSymptomMappings,
  getProcedureMappings,
  getSuccessfulCoveragePaths,
  getLearningContext,
  queueLearningJob,
  pruneLowConfidenceMappings,
  getFlywheelContext,
  checkOutcomeIncentive,
  applyOutcomeIncentive,
  recordAppealOutcome,
  type LearningContext,
  type FlywheelContext,
} from "../learning";

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// Group 1: extractEntities — Pure (20 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("extractEntities — symptoms", () => {
  it("extracts pain pattern: 'having severe back pain'", () => {
    const r = extractEntities("I'm having severe back pain");
    expect(r.symptoms.length).toBeGreaterThan(0);
    expect(r.symptoms.some(s => s.phrase.includes("back"))).toBe(true);
  });

  it("extracts possessive pattern: 'my knee hurts'", () => {
    const r = extractEntities("my knee hurts");
    expect(r.symptoms.some(s => s.phrase.includes("knee"))).toBe(true);
  });

  it("extracts 'pain in' pattern: 'pain in my lower back'", () => {
    const r = extractEntities("I have pain in my lower back");
    expect(r.symptoms.some(s => s.phrase.includes("back"))).toBe(true);
  });

  it("extracts feeling pattern: 'feeling dizzy'", () => {
    const r = extractEntities("I'm feeling dizzy all the time");
    expect(r.symptoms.length).toBeGreaterThan(0);
  });

  it("extracts trouble pattern: 'having trouble breathing'", () => {
    const r = extractEntities("I'm having trouble breathing");
    expect(r.symptoms.some(s => s.phrase.includes("breathing"))).toBe(true);
  });

  it("extracts inability pattern: 'can't sleep'", () => {
    const r = extractEntities("I can't sleep at night");
    expect(r.symptoms.some(s => s.phrase.includes("sleep"))).toBe(true);
  });

  it("matches specific keyword: 'shortness of breath'", () => {
    const r = extractEntities("I have shortness of breath");
    expect(r.symptoms.length).toBeGreaterThan(0);
  });

  it("deduplicates identical phrases", () => {
    const r = extractEntities("my knee hurts and my knee hurts a lot");
    const kneeEntries = r.symptoms.filter(s => s.phrase.includes("knee"));
    expect(kneeEntries.length).toBe(1);
  });
});

describe("extractEntities — severity & duration", () => {
  it("attaches severity keyword when present", () => {
    const r = extractEntities("I have terrible headache");
    const withSeverity = r.symptoms.filter(s => s.severity);
    expect(withSeverity.length).toBeGreaterThan(0);
    expect(withSeverity[0].severity).toBe("terrible");
  });

  it("attaches duration from timeframe in message", () => {
    const r = extractEntities("having back pain for 3 weeks");
    const withDuration = r.symptoms.filter(s => s.duration);
    expect(withDuration.length).toBeGreaterThan(0);
  });
});

describe("extractEntities — length guards", () => {
  it("accepts phrase of exactly 3 chars", () => {
    const r = extractEntities("my arm hurts");
    expect(r.symptoms.some(s => s.phrase === "arm")).toBe(true);
  });

  it("returns empty for message with no patterns", () => {
    const r = extractEntities("Hello there");
    expect(r.symptoms).toEqual([]);
    expect(r.procedures).toEqual([]);
    expect(r.medications).toEqual([]);
    expect(r.providers).toEqual([]);
    expect(r.timeframes).toEqual([]);
  });
});

describe("extractEntities — procedures", () => {
  it("extracts imaging: 'MRI of the knee' with bodyPart", () => {
    const r = extractEntities("I need an MRI of the knee");
    expect(r.procedures.length).toBeGreaterThan(0);
    const mriEntry = r.procedures.find(p => p.phrase.includes("knee") || p.phrase.includes("mri"));
    expect(mriEntry).toBeTruthy();
  });

  it("extracts surgery: 'knee replacement'", () => {
    const r = extractEntities("I'm scheduled for knee replacement surgery");
    expect(r.procedures.some(p => p.phrase.includes("knee"))).toBe(true);
  });

  it("extracts therapy: 'physical therapy'", () => {
    const r = extractEntities("I'm doing physical therapy");
    expect(r.procedures.some(p => p.phrase.includes("physical therapy"))).toBe(true);
  });
});

describe("extractEntities — medications, providers, timeframes", () => {
  it("extracts medication: 'taking metformin'", () => {
    const r = extractEntities("I'm taking metformin for diabetes");
    expect(r.medications).toContain("metformin");
  });

  it("extracts provider: 'Dr. Smith'", () => {
    const r = extractEntities("I saw Dr. Smith yesterday");
    expect(r.providers.some(p => p.includes("Smith"))).toBe(true);
  });

  it("extracts timeframe: 'for 6 months'", () => {
    const r = extractEntities("I've had pain for 6 months now");
    expect(r.timeframes.length).toBeGreaterThan(0);
    expect(r.timeframes.some(t => t.includes("6") && t.includes("month"))).toBe(true);
  });
});

describe("extractEntities — edge cases", () => {
  it("returns empty result for empty string", () => {
    const r = extractEntities("");
    expect(r.symptoms).toEqual([]);
    expect(r.procedures).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 2: buildLearningPromptInjection — Pure (6 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("buildLearningPromptInjection", () => {
  const emptyContext: LearningContext = {
    symptomMappings: [],
    procedureMappings: [],
    coveragePaths: [],
    recentDenials: [],
    effectiveQuestions: [],
  };

  it("returns empty string for empty context", () => {
    expect(buildLearningPromptInjection(emptyContext)).toBe("");
  });

  it("includes symptom mapping section with confidence percentage", () => {
    const ctx: LearningContext = {
      ...emptyContext,
      symptomMappings: [
        { phrase: "back pain", icd10Code: "M54.5", icd10Description: "Low back pain", confidence: 0.85, useCount: 10, lastUsed: new Date() },
      ],
    };
    const result = buildLearningPromptInjection(ctx);
    expect(result).toContain("Learned Symptom Mappings");
    expect(result).toContain("85% confidence");
    expect(result).toContain("M54.5");
  });

  it("includes procedure mapping section", () => {
    const ctx: LearningContext = {
      ...emptyContext,
      procedureMappings: [
        { phrase: "mri back", cptCode: "72148", cptDescription: "MRI Lumbar", confidence: 0.7, useCount: 5, lastUsed: new Date() },
      ],
    };
    const result = buildLearningPromptInjection(ctx);
    expect(result).toContain("Learned Procedure Mappings");
    expect(result).toContain("72148");
  });

  it("caps symptom mappings at 5", () => {
    const ctx: LearningContext = {
      ...emptyContext,
      symptomMappings: Array.from({ length: 8 }, (_, i) => ({
        phrase: `symptom${i}`, icd10Code: `M${i}`, icd10Description: "", confidence: 0.8, useCount: 1, lastUsed: new Date(),
      })),
    };
    const result = buildLearningPromptInjection(ctx);
    const arrowCount = (result.match(/→/g) || []).length;
    expect(arrowCount).toBe(5);
  });

  it("caps coverage paths at 3", () => {
    const ctx: LearningContext = {
      ...emptyContext,
      coveragePaths: Array.from({ length: 6 }, (_, i) => ({
        icd10Code: `E${i}`, cptCode: `9921${i}`, ncdId: null, lcdId: null, contractorId: null,
        documentationRequired: [], outcome: "approved", useCount: i + 1, lastUsedAt: new Date(),
      })),
    };
    const result = buildLearningPromptInjection(ctx);
    const pathLines = result.split("\n").filter(l => l.startsWith("- 9921"));
    expect(pathLines.length).toBe(3);
  });

  it("shows NCD ref, falls back to LCD", () => {
    const withNcd: LearningContext = {
      ...emptyContext,
      coveragePaths: [{ icd10Code: "E11", cptCode: "99213", ncdId: "220.6", lcdId: null, contractorId: null, documentationRequired: [], outcome: "approved", useCount: 1, lastUsedAt: new Date() }],
    };
    expect(buildLearningPromptInjection(withNcd)).toContain("NCD 220.6");

    const withLcd: LearningContext = {
      ...emptyContext,
      coveragePaths: [{ icd10Code: "E11", cptCode: "99213", ncdId: null, lcdId: "L35936", contractorId: null, documentationRequired: [], outcome: "approved", useCount: 1, lastUsedAt: new Date() }],
    };
    expect(buildLearningPromptInjection(withLcd)).toContain("LCD L35936");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 3: buildFlywheelPromptInjection — Pure (4 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("buildFlywheelPromptInjection", () => {
  it("returns empty string for empty array", () => {
    expect(buildFlywheelPromptInjection([])).toBe("");
  });

  it("formats entry with avg_days", () => {
    const ctx: FlywheelContext[] = [{ carc_code: "CO-50", total_cases: 25, success_rate: 72, avg_days: 14, approved: 18, denied: 7 }];
    const result = buildFlywheelPromptInjection(ctx);
    expect(result).toContain("CARC CO-50");
    expect(result).toContain("25 cases");
    expect(result).toContain("72%");
    expect(result).toContain("avg 14 days");
  });

  it("omits avg_days when null", () => {
    const ctx: FlywheelContext[] = [{ carc_code: "CO-4", total_cases: 10, success_rate: 50, avg_days: null, approved: 5, denied: 5 }];
    const result = buildFlywheelPromptInjection(ctx);
    expect(result).not.toContain("avg");
    expect(result).not.toContain("days to resolution");
  });

  it("caps at 20 entries", () => {
    const ctx: FlywheelContext[] = Array.from({ length: 25 }, (_, i) => ({
      carc_code: `CO-${i}`, total_cases: 10, success_rate: 50, avg_days: null, approved: 5, denied: 5,
    }));
    const result = buildFlywheelPromptInjection(ctx);
    const carcLines = result.split("\n").filter(l => l.startsWith("- CARC"));
    expect(carcLines.length).toBe(20);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 4: updateSymptomMapping — DB (5 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("updateSymptomMapping", () => {
  it("calls RPC with normalized phrase on success", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await updateSymptomMapping("  BACK PAIN  ", "M54.5", "Low back pain", 0.1);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("update_symptom_mapping"),
      ["back pain", "M54.5", "Low back pain", 0.1]
    );
  });

  it("falls back to direct update when RPC fails — existing row", async () => {
    mockQuery
      .mockRejectedValueOnce(new Error("RPC not found"))
      .mockResolvedValueOnce({ rows: [{ id: "sm-1", confidence: 0.7, use_count: 3 }] })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    await updateSymptomMapping("back pain", "M54.5", "", 0.1);

    // UPDATE should be called with clamped confidence
    const updateCall = mockQuery.mock.calls[2];
    expect(updateCall[0]).toContain("UPDATE symptom_mappings");
    expect(updateCall[1]![0]).toBeCloseTo(0.8); // 0.7 + 0.1
    expect(updateCall[1]![1]).toBe(4); // use_count + 1
  });

  it("falls back to direct insert when RPC fails — new row", async () => {
    mockQuery
      .mockRejectedValueOnce(new Error("RPC not found"))
      .mockResolvedValueOnce({ rows: [] }) // SELECT returns nothing
      .mockResolvedValueOnce({ rows: [] }); // INSERT

    await updateSymptomMapping("new symptom", "R42", "Dizziness", 0.1);

    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[0]).toContain("INSERT INTO symptom_mappings");
    expect(insertCall[1]![3]).toBeCloseTo(0.6); // initial(0.5) + boost(0.1)
  });

  it("clamps confidence at 1.0", async () => {
    mockQuery
      .mockRejectedValueOnce(new Error("RPC"))
      .mockResolvedValueOnce({ rows: [{ id: "sm-2", confidence: 0.95, use_count: 10 }] })
      .mockResolvedValueOnce({ rows: [] });

    await updateSymptomMapping("high conf", "M54.5", "", 0.1);

    const updateCall = mockQuery.mock.calls[2];
    expect(updateCall[1]![0]).toBe(1); // Math.min(1, 0.95 + 0.1)
  });

  it("uses custom boost parameter", async () => {
    mockQuery
      .mockRejectedValueOnce(new Error("RPC"))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await updateSymptomMapping("test", "R42", "", 0.3);

    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[1]![3]).toBeCloseTo(0.8); // 0.5 + 0.3
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 5: updateProcedureMapping — DB (3 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("updateProcedureMapping", () => {
  it("calls RPC on success", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await updateProcedureMapping("mri back", "72148", "MRI Lumbar", 0.1);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("update_procedure_mapping"),
      ["mri back", "72148", "MRI Lumbar", 0.1]
    );
  });

  it("fallback update existing row", async () => {
    mockQuery
      .mockRejectedValueOnce(new Error("RPC"))
      .mockResolvedValueOnce({ rows: [{ id: "pm-1", confidence: 0.6, use_count: 2 }] })
      .mockResolvedValueOnce({ rows: [] });

    await updateProcedureMapping("mri", "72148", "", 0.1);

    const updateCall = mockQuery.mock.calls[2];
    expect(updateCall[0]).toContain("UPDATE procedure_mappings");
    expect(updateCall[1]![0]).toBeCloseTo(0.7);
  });

  it("fallback insert new row", async () => {
    mockQuery
      .mockRejectedValueOnce(new Error("RPC"))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await updateProcedureMapping("ct scan", "74176", "CT Abdomen", 0.1);

    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[0]).toContain("INSERT INTO procedure_mappings");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 6: recordCoveragePath — DB (4 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("recordCoveragePath", () => {
  it("updates existing path — increments use_count", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "cp-1", use_count: 3 }] })
      .mockResolvedValueOnce({ rows: [] });

    await recordCoveragePath("E11", "99213", {}, "approved");

    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain("UPDATE coverage_paths");
    expect(updateCall[1]).toContain(4); // use_count + 1
  });

  it("inserts new path with null policy refs", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await recordCoveragePath("E11", "99213", {}, "pending");

    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain("INSERT INTO coverage_paths");
    // ncd_id, lcd_id, contractor_id should be null
    expect(insertCall[1]![2]).toBeNull();
    expect(insertCall[1]![3]).toBeNull();
    expect(insertCall[1]![4]).toBeNull();
  });

  it("includes documentationRequired when provided", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "cp-2", use_count: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    await recordCoveragePath("E11", "99213", {}, "approved", ["Prior auth form", "Lab results"]);

    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain("documentation_required");
  });

  it("swallows errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    await expect(recordCoveragePath("E11", "99213", {}, "pending")).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 7: processFeedback — DB (4 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("processFeedback", () => {
  it("applies positive boost for thumbs up", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await processFeedback("msg-1", "up", {
      symptoms: ["back pain"],
      icd10Codes: ["M54.5"],
    });

    // Should call update_symptom_mapping RPC with positive boost (0.1)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("update_symptom_mapping"),
      expect.arrayContaining([0.1])
    );
  });

  it("applies negative penalty for thumbs down", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await processFeedback("msg-2", "down", {
      symptoms: ["knee pain"],
      icd10Codes: ["M17.11"],
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("update_symptom_mapping"),
      expect.arrayContaining([-0.15])
    );
  });

  it("stores correction only for 'down' rating", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await processFeedback("msg-3", "down", { symptoms: ["test"], icd10Codes: ["R42"] }, "Wrong code");

    const insertCall = mockQuery.mock.calls.find(c => (c[0] as string).includes("INSERT INTO user_feedback"));
    expect(insertCall).toBeTruthy();
    expect(insertCall![1]).toContain("Wrong code");
  });

  it("does NOT store correction for 'up' rating", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await processFeedback("msg-4", "up", { symptoms: ["test"], icd10Codes: ["R42"] }, "Some note");

    const insertCall = mockQuery.mock.calls.find(c => (c[0] as string).includes("INSERT INTO user_feedback"));
    expect(insertCall).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 8: getSymptomMappings / getProcedureMappings — DB (4 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("getSymptomMappings", () => {
  it("maps DB rows to SymptomMapping type", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "sm-1", phrase: "back pain", icd10_code: "M54.5",
        icd10_description: null, confidence: 0.8, use_count: 5, last_used_at: "2026-01-01",
      }],
    });

    const result = await getSymptomMappings("back pain");
    expect(result[0].icd10Code).toBe("M54.5");
    expect(result[0].icd10Description).toBe(""); // null → ""
    expect(result[0].confidence).toBe(0.8);
  });

  it("returns [] on query error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const result = await getSymptomMappings("test");
    expect(result).toEqual([]);
    spy.mockRestore();
  });
});

describe("getProcedureMappings", () => {
  it("maps DB rows correctly", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "pm-1", phrase: "mri", cpt_code: "72148",
        cpt_description: "MRI Lumbar", confidence: 0.7, use_count: 3, last_used_at: "2026-01-01",
      }],
    });

    const result = await getProcedureMappings("mri");
    expect(result[0].cptCode).toBe("72148");
    expect(result[0].cptDescription).toBe("MRI Lumbar");
  });

  it("returns [] on error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error("fail"));
    expect(await getProcedureMappings("test")).toEqual([]);
    spy.mockRestore();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 9: getSuccessfulCoveragePaths — DB (2 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("getSuccessfulCoveragePaths", () => {
  it("maps rows and handles non-array documentation_required", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "cp-1", icd10_code: "E11", cpt_code: "99213", ncd_id: null, lcd_id: "L35936",
        contractor_id: null, documentation_required: "not-an-array", outcome: "approved",
        use_count: 5, last_used_at: "2026-01-01",
      }],
    });

    const result = await getSuccessfulCoveragePaths("99213");
    expect(result[0].documentationRequired).toEqual([]); // non-array → []
    expect(result[0].lcdId).toBe("L35936");
  });

  it("returns [] on error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error("fail"));
    expect(await getSuccessfulCoveragePaths("99213")).toEqual([]);
    spy.mockRestore();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 10: getLearningContext — DB (3 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("getLearningContext", () => {
  it("orchestrates reads and returns populated context", async () => {
    // getSymptomMappings → query
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "s1", phrase: "pain", icd10_code: "M54.5", icd10_description: "", confidence: 0.8, use_count: 1, last_used_at: "2026-01-01" }],
    });
    // getProcedureMappings → query
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "p1", phrase: "mri", cpt_code: "72148", cpt_description: "", confidence: 0.7, use_count: 1, last_used_at: "2026-01-01" }],
    });
    // getSuccessfulCoveragePaths → query
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // recent denials → query
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getLearningContext(["pain"], ["mri"]);
    expect(result.symptomMappings.length).toBe(1);
    expect(result.procedureMappings.length).toBe(1);
  });

  it("formats recent denials as 'CPT with ICD10'", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // getSymptomMappings("test")
      .mockResolvedValueOnce({ rows: [{ cpt_code: "99213", icd10_code: "E11" }] }); // recent denials query

    const result = await getLearningContext(["test"], []);
    expect(result.recentDenials).toContain("99213 with E11");
  });

  it("handles denial query error gracefully", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({ rows: [] }); // symptom
    mockQuery.mockRejectedValueOnce(new Error("fail")); // denials

    const result = await getLearningContext(["test"], []);
    expect(result.recentDenials).toEqual([]);
    spy.mockRestore();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 11: Remaining functions — DB (10 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("queueLearningJob", () => {
  it("inserts with correct type and JSON data", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await queueLearningJob("extract_entities", { symptoms: ["pain"] });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO learning_queue"),
      ["extract_entities", JSON.stringify({ symptoms: ["pain"] })]
    );
  });

  it("swallows errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error("fail"));

    await expect(queueLearningJob("update_mappings", {})).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("pruneLowConfidenceMappings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns counts and performs 4 queries", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "5" }] }) // symptom count
      .mockResolvedValueOnce({ rows: [] }) // symptom delete
      .mockResolvedValueOnce({ rows: [{ count: "3" }] }) // procedure count
      .mockResolvedValueOnce({ rows: [] }); // procedure delete

    const result = await pruneLowConfidenceMappings();

    expect(result).toEqual({ symptoms: 5, procedures: 3 });
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it("defaults to 0 when count row missing", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // symptom count — no rows
      .mockResolvedValueOnce({ rows: [] }) // symptom delete
      .mockResolvedValueOnce({ rows: [] }) // procedure count — no rows
      .mockResolvedValueOnce({ rows: [] }); // procedure delete

    const result = await pruneLowConfidenceMappings();
    expect(result.symptoms).toBe(0);
    expect(result.procedures).toBe(0);
  });
});

describe("getFlywheelContext", () => {
  it("returns [] for empty cptCodes without querying", async () => {
    const result = await getFlywheelContext([], ["CO-4"]);
    expect(result).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("maps rows to FlywheelContext with correct types", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ carc_code: "CO-50", total_cases: 25, success_rate: 72, avg_days: null, approved: 18, denied: 7 }],
    });

    const result = await getFlywheelContext(["99213"], []);
    expect(result[0].carc_code).toBe("CO-50");
    expect(result[0].avg_days).toBeNull();
    expect(typeof result[0].total_cases).toBe("number");
  });

  it("returns [] on error", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error("fail"));
    expect(await getFlywheelContext(["99213"], [])).toEqual([]);
    spy.mockRestore();
  });
});

describe("checkOutcomeIncentive / applyOutcomeIncentive", () => {
  it("checkOutcomeIncentive returns true when row exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "1" }] });
    expect(await checkOutcomeIncentive("user@test.com")).toBe(true);
  });

  it("checkOutcomeIncentive returns false on empty/error", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await checkOutcomeIncentive("user@test.com")).toBe(false);
  });

  it("applyOutcomeIncentive returns RPC result", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ apply_outcome_incentive: true }] });
    expect(await applyOutcomeIncentive("user@test.com")).toBe(true);
  });

  it("applyOutcomeIncentive returns false on error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error("fail"));
    expect(await applyOutcomeIncentive("user@test.com")).toBe(false);
    spy.mockRestore();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Group 12: recordAppealOutcome — DB (5 tests)
// ════════════════════════════════════════════════════════════════════════════

describe("recordAppealOutcome", () => {
  it("returns false when appeal not found", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({ rows: [] }); // appeal SELECT

    expect(await recordAppealOutcome("missing", "approved")).toBe(false);
    spy.mockRestore();
  });

  it("updates appeal status and upserts existing coverage path", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ icd10_codes: ["E11"], cpt_codes: ["99213"], ncd_refs: null, lcd_refs: ["L35936"] }] }) // appeal
      .mockResolvedValueOnce({ rows: [] }) // UPDATE appeals
      .mockResolvedValueOnce({ rows: [{ id: "cp-1", use_count: 2 }] }) // coverage SELECT
      .mockResolvedValueOnce({ rows: [] }); // coverage UPDATE

    const result = await recordAppealOutcome("appeal-1", "approved");
    expect(result).toBe(true);

    // Verify appeal status update
    const appealUpdate = mockQuery.mock.calls[1];
    expect(appealUpdate[0]).toContain("UPDATE appeals");
    expect(appealUpdate[1]![0]).toBe("approved");

    // Verify coverage path update increments use_count
    const cpUpdate = mockQuery.mock.calls[3];
    expect(cpUpdate[0]).toContain("UPDATE coverage_paths");
    expect(cpUpdate[1]).toContain(3); // 2 + 1
  });

  it("inserts new coverage path when none exists", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ icd10_codes: ["E11"], cpt_codes: ["99213"], ncd_refs: null, lcd_refs: null }] })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE appeals
      .mockResolvedValueOnce({ rows: [] }) // coverage SELECT — not found
      .mockResolvedValueOnce({ rows: [] }); // coverage INSERT

    const result = await recordAppealOutcome("appeal-2", "denied");
    expect(result).toBe(true);

    const cpInsert = mockQuery.mock.calls[3];
    expect(cpInsert[0]).toContain("INSERT INTO coverage_paths");
  });

  it("skips coverage upsert when appeal has no codes", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ icd10_codes: null, cpt_codes: null, ncd_refs: null, lcd_refs: null }] })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE appeals only

    const result = await recordAppealOutcome("appeal-3", "partial");
    expect(result).toBe(true);
    // Only 2 queries: appeal SELECT + appeal UPDATE. No coverage_paths queries.
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("returns false on error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    expect(await recordAppealOutcome("appeal-4", "approved")).toBe(false);
    spy.mockRestore();
  });
});
