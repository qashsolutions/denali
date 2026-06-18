import { describe, expect, it } from "vitest";

import {
  ragForObservation,
  suggestNameFromObservations,
  suggestReportName,
  summarizeReport,
} from "../reportInterpretation";
import type { ExtractedObservation } from "../types";

function obs(p: Partial<ExtractedObservation>): ExtractedObservation {
  return {
    category: "biomarker",
    code_system: "LOINC",
    code: "x",
    display: "X",
    value_num: 1,
    value_text: null,
    unit: "U/L",
    effective_at: "2026-05-12",
    confidence: 0.9,
    source_text: "",
    ...p,
  };
}

describe("ragForObservation", () => {
  it("uses the structured abnormal_flag when present", () => {
    expect(ragForObservation(obs({ abnormal_flag: "high" }))).toEqual({
      tint: "watch",
      label: "Flagged high",
    });
    expect(ragForObservation(obs({ abnormal_flag: "low" }))?.label).toBe(
      "Flagged low",
    );
    expect(ragForObservation(obs({ abnormal_flag: "critical" }))).toEqual({
      tint: "alarm",
      label: "Flagged critical",
    });
    expect(ragForObservation(obs({ abnormal_flag: "normal" }))).toEqual({
      tint: "ok",
      label: "In range",
    });
  });

  it("returns null when the report states no flag (no claim)", () => {
    expect(ragForObservation(obs({ abnormal_flag: null }))).toBeNull();
    expect(ragForObservation(obs({ source_text: "GGT 96 U/L" }))).toBeNull();
  });

  it("falls back to the report's flag WORD in source_text", () => {
    expect(
      ragForObservation(obs({ source_text: "GGT 96 U/L 8-61 HIGH" }))?.tint,
    ).toBe("watch");
    expect(
      ragForObservation(obs({ source_text: "Ferritin 8 ng/mL 15-150 LOW" }))
        ?.label,
    ).toBe("Flagged low");
    expect(
      ragForObservation(obs({ source_text: "Potassium 7.1 CRITICAL" }))?.tint,
    ).toBe("alarm");
    expect(
      ragForObservation(obs({ source_text: "TSH 2.3 mIU/L NORMAL" }))?.tint,
    ).toBe("ok");
  });

  it("does NOT read a stray letter in a unit as a flag", () => {
    // 'L' inside mL / 'H' inside mmHg must not trip low/high.
    expect(ragForObservation(obs({ source_text: "eGFR 82 mL/min/1.73m2" }))).toBeNull();
    expect(ragForObservation(obs({ source_text: "BP 132 mmHg" }))).toBeNull();
  });

  it("structured flag wins over source_text", () => {
    expect(
      ragForObservation(
        obs({ abnormal_flag: "normal", source_text: "... HIGH ..." }),
      )?.tint,
    ).toBe("ok");
  });
});

describe("summarizeReport — factual, no diagnosis", () => {
  it("empty → empty string", () => {
    expect(summarizeReport([])).toBe("");
  });

  it("counts values and flagged-out-of-range (plural)", () => {
    const rows = [
      obs({ source_text: "a HIGH" }),
      obs({ source_text: "b LOW" }),
      obs({ source_text: "c NORMAL" }),
    ];
    expect(summarizeReport(rows)).toBe(
      "Read 3 values from this report. 2 are flagged outside the range on your report.",
    );
  });

  it("singular value + singular flagged", () => {
    expect(summarizeReport([obs({ source_text: "a HIGH" })])).toBe(
      "Read 1 value from this report. 1 is flagged outside the range on your report.",
    );
  });

  it("none flagged", () => {
    expect(
      summarizeReport([obs({ abnormal_flag: "normal" }), obs({ source_text: "x" })]),
    ).toBe("Read 2 values from this report. None are flagged outside the range on your report.");
  });

  it("never contains diagnosis/condition/recommendation language", () => {
    const s = summarizeReport([
      obs({ source_text: "GGT 96 HIGH" }),
      obs({ source_text: "AST 71 HIGH" }),
    ]);
    expect(s).not.toMatch(/disease|consistent with|risk|diagnos|should|recommend|likely/i);
  });
});

describe("suggestReportName", () => {
  const d = new Date("2026-06-17T12:00:00Z");
  it("builds {type label} · {Mon YYYY}", () => {
    expect(suggestReportName("lab", d)).toBe("Lab results · Jun 2026");
    expect(suggestReportName("ehr", d)).toBe("EHR export · Jun 2026");
    expect(suggestReportName("visit", d)).toBe("Visit summary · Jun 2026");
  });
  it("falls back to 'Health report' for an unknown/free-form type", () => {
    expect(suggestReportName("other", d)).toBe("Health report · Jun 2026");
    expect(suggestReportName("general", d)).toBe("Health report · Jun 2026");
  });
});

describe("suggestNameFromObservations", () => {
  const today = new Date("2026-06-17T12:00:00Z");
  it("uses the report's own dominant month, not today", () => {
    const rows = [
      obs({ effective_at: "2026-05-12" }),
      obs({ effective_at: "2026-05-12" }),
      obs({ effective_at: "2026-03-01" }),
    ];
    expect(suggestNameFromObservations(rows, today)).toBe(
      "Health report · May 2026",
    );
  });
  it("falls back to the given date when no observation date parses", () => {
    expect(suggestNameFromObservations([], today)).toBe(
      "Health report · Jun 2026",
    );
    expect(
      suggestNameFromObservations([obs({ effective_at: "" })], today),
    ).toBe("Health report · Jun 2026");
  });
});
