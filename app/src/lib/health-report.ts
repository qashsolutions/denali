/**
 * Health Report Generation Engine
 *
 * Generates comprehensive Medicare health summary reports using Claude (Sonnet 4.6).
 * Follows diabetes-insights.ts pattern: structured JSON output + hash-based dedup.
 */

import { createHash } from "crypto";
import { API_CONFIG } from "@/config";
import { getClaudeClient } from "@/lib/claude";
import { buildHealthContextForPrompt } from "@/lib/fhir/context";
import type { SessionState } from "@/lib/session-state";

// ─────────────────────────────────────────────────────────────────────────────
// Report Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthReport {
  generatedAt: string;
  patientSummary: {
    age: number | null;
    gender: string | null;
    coverageType: string;
    coverageParts: string[];
  };
  redFlags: Array<{
    severity: "urgent" | "warning";
    title: string;
    detail: string;
    recommendation: string;
  }>;
  diabetesSection: {
    classification: "diabetic" | "pre-diabetic" | "at-risk" | "none";
    findings: string[];
    medicareBenefits: string[];
    actionItems: string[];
  };
  obesitySection: {
    classification: "obese" | "at-risk" | "none";
    findings: string[];
    medicareBenefits: string[];
    actionItems: string[];
  };
  conditionsSummary: Array<{
    name: string;
    severity: "red" | "amber" | "green";
    isPrimary: boolean;
    note: string;
  }>;
  medicationReview: Array<{
    name: string;
    ndcCode: string | null;
    status: string;
    concern: string | null;
  }>;
  screeningStatus: Array<{
    type: string;
    lastDate: string | null;
    isOverdue: boolean;
    medicareCoverage: string;
  }>;
  dmeSupplies: Array<{
    category: string;
    items: string[];
    relevance: string;
  }> | null;
  careTeam: Array<{
    specialty: string;
    hasVisited: boolean;
    recommendation: string | null;
  }>;
  recentDenials: Array<{
    procedure: string;
    reason: string;
    actionItem: string;
  }>;
  hospiceStatus: boolean;
  preDiabetesResources: {
    eligible: boolean;
    cdcRiskTestLink: string;
    mdppInfo: string;
    lifestyleGuidance: string[];
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hash for Dedup
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportInput {
  patient: { age: number; gender: string } | null;
  coverage: Array<{ type: string; status: string }>;
  conditions: Array<{ code: string; name: string; category: string; isPrimary?: boolean }>;
  medications: Array<{ name: string; status: string; isDiabetesMed: boolean; isObesityMed: boolean; ndcCode?: string; gapDays?: number }>;
  screenings: Array<{ screeningType: string; lastDate: string; isOverdue: boolean }>;
  providers: Array<{ name: string; specialty?: string; visitCount: number }>;
  hospitalizations: Array<{ admissionDate: string; dischargeDate: string; diagnoses: string[] }>;
  dme: Array<{ category: string; items: string[] }>;
  isHospice: boolean;
  diabetesClassification: string;
  obesityClassification: string;
  recentDenials: Array<{ procedure: string; denialReason: string }>;
}

export function computeReportHash(data: ReportInput): string {
  const normalized = JSON.stringify({
    age: data.patient?.age,
    gender: data.patient?.gender,
    coverageCount: data.coverage.length,
    conditionCodes: data.conditions.map((c) => c.code).sort(),
    medCount: data.medications.length,
    screeningCount: data.screenings.length,
    providerCount: data.providers.length,
    hospCount: data.hospitalizations.length,
    dmeCount: data.dme.length,
    isHospice: data.isHospice,
    diabetesClass: data.diabetesClassification,
    obesityClass: data.obesityClassification,
    denialCount: data.recentDenials.length,
  });
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a comprehensive health report using Claude (Sonnet 4.6).
 * Uses the same health context that the chat system uses.
 */
export async function generateHealthReport(
  sessionState: SessionState,
  input: ReportInput
): Promise<HealthReport> {
  const claude = getClaudeClient();
  const healthContext = buildHealthContextForPrompt(sessionState);
  const prompt = buildReportPrompt(healthContext, input);

  const response = await claude.messages.create({
    model: API_CONFIG.claude.model,
    max_tokens: 4000,
    system: `You are a Medicare health data analyst generating a structured health summary report.
Respond ONLY with valid JSON matching the exact schema requested. No markdown, no commentary.

Rules:
- Never diagnose. Only reference Medicare-covered services.
- Write at an 8th grade reading level, no medical jargon.
- Focus on actionable items and Medicare benefits the patient may not be using.
- For pre-diabetic patients, always include MDPP and CDC risk test information.
- For hospice patients, focus on comfort care and hospice benefit coverage.
- Reference specific Medicare program names (DSMT, MNT, MDPP, IBT, NCD numbers).`,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("");

  try {
    const parsed = JSON.parse(text);
    return normalizeReport(parsed, input);
  } catch {
    console.error("[HealthReport] Failed to parse Claude response:", text.slice(0, 200));
    return buildFallbackReport(input);
  }
}

function buildReportPrompt(healthContext: string | null, input: ReportInput): string {
  const lines: string[] = [];

  lines.push("Generate a comprehensive Medicare Health Summary Report from this patient's claims data.");
  lines.push("");

  if (healthContext) {
    lines.push("=== HEALTH DATA ===");
    lines.push(healthContext);
    lines.push("");
  }

  lines.push("=== ADDITIONAL DATA ===");
  lines.push(`Diabetes classification: ${input.diabetesClassification}`);
  lines.push(`Obesity classification: ${input.obesityClassification}`);
  lines.push(`Hospice status: ${input.isHospice}`);
  lines.push(`Patient: age ${input.patient?.age ?? "unknown"}, ${input.patient?.gender ?? "unknown"}`);
  lines.push(`Active coverage: ${input.coverage.map((c) => c.type).join(", ") || "None"}`);
  lines.push(`Conditions: ${input.conditions.length}`);
  lines.push(`Medications: ${input.medications.length}`);
  lines.push(`DME supplies: ${input.dme.length} categories`);
  lines.push(`Screenings tracked: ${input.screenings.length}`);
  lines.push(`Recent denials: ${input.recentDenials.length}`);

  if (input.dme.length > 0) {
    lines.push("");
    lines.push("DME Details:");
    for (const d of input.dme) {
      lines.push(`  ${d.category}: ${d.items.join(", ")}`);
    }
  }

  if (input.recentDenials.length > 0) {
    lines.push("");
    lines.push("Denied Claims:");
    for (const d of input.recentDenials) {
      lines.push(`  ${d.procedure}: ${d.denialReason}`);
    }
  }

  lines.push("");
  lines.push("Respond with ONLY this JSON schema:");
  lines.push(JSON.stringify({
    redFlags: [{ severity: "urgent|warning", title: "string", detail: "string", recommendation: "string" }],
    diabetesSection: {
      classification: "diabetic|pre-diabetic|at-risk|none",
      findings: ["string"],
      medicareBenefits: ["string"],
      actionItems: ["string"],
    },
    obesitySection: {
      classification: "obese|at-risk|none",
      findings: ["string"],
      medicareBenefits: ["string"],
      actionItems: ["string"],
    },
    conditionsSummary: [{ name: "string", severity: "red|amber|green", isPrimary: true, note: "string" }],
    medicationReview: [{ name: "string", ndcCode: "string|null", status: "string", concern: "string|null" }],
    screeningStatus: [{ type: "string", lastDate: "string|null", isOverdue: true, medicareCoverage: "string" }],
    dmeSupplies: [{ category: "string", items: ["string"], relevance: "string" }],
    careTeam: [{ specialty: "string", hasVisited: true, recommendation: "string|null" }],
    recentDenials: [{ procedure: "string", reason: "string", actionItem: "string" }],
    preDiabetesResources: { eligible: true, mdppInfo: "string", lifestyleGuidance: ["string"] },
  }, null, 2));

  return lines.join("\n");
}

function normalizeReport(parsed: Record<string, unknown>, input: ReportInput): HealthReport {
  const p = parsed as Record<string, unknown>;
  return {
    generatedAt: new Date().toISOString(),
    patientSummary: {
      age: input.patient?.age ?? null,
      gender: input.patient?.gender ?? null,
      coverageType: input.coverage.some((c) => c.type.includes("Part C"))
        ? `Medicare Advantage`
        : "Original Medicare",
      coverageParts: input.coverage.map((c) => c.type),
    },
    redFlags: Array.isArray(p.redFlags) ? p.redFlags as HealthReport["redFlags"] : [],
    diabetesSection: {
      classification: input.diabetesClassification as HealthReport["diabetesSection"]["classification"],
      findings: (p.diabetesSection as Record<string, unknown>)?.findings as string[] ?? [],
      medicareBenefits: (p.diabetesSection as Record<string, unknown>)?.medicareBenefits as string[] ?? [],
      actionItems: (p.diabetesSection as Record<string, unknown>)?.actionItems as string[] ?? [],
    },
    obesitySection: {
      classification: input.obesityClassification as HealthReport["obesitySection"]["classification"],
      findings: (p.obesitySection as Record<string, unknown>)?.findings as string[] ?? [],
      medicareBenefits: (p.obesitySection as Record<string, unknown>)?.medicareBenefits as string[] ?? [],
      actionItems: (p.obesitySection as Record<string, unknown>)?.actionItems as string[] ?? [],
    },
    conditionsSummary: Array.isArray(p.conditionsSummary) ? p.conditionsSummary as HealthReport["conditionsSummary"] : [],
    medicationReview: Array.isArray(p.medicationReview) ? p.medicationReview as HealthReport["medicationReview"] : [],
    screeningStatus: Array.isArray(p.screeningStatus) ? p.screeningStatus as HealthReport["screeningStatus"] : [],
    dmeSupplies: Array.isArray(p.dmeSupplies) && p.dmeSupplies.length > 0 ? p.dmeSupplies as HealthReport["dmeSupplies"] : null,
    careTeam: Array.isArray(p.careTeam) ? p.careTeam as HealthReport["careTeam"] : [],
    recentDenials: Array.isArray(p.recentDenials) ? p.recentDenials as HealthReport["recentDenials"] : [],
    hospiceStatus: input.isHospice,
    preDiabetesResources: input.diabetesClassification === "pre-diabetic" || input.diabetesClassification === "at-risk"
      ? {
          eligible: true,
          cdcRiskTestLink: "https://www.cdc.gov/diabetes/risk-test",
          mdppInfo: (p.preDiabetesResources as Record<string, unknown>)?.mdppInfo as string
            ?? "The Medicare Diabetes Prevention Program (MDPP) is a free program that helps you make lifestyle changes to prevent type 2 diabetes. Ask your doctor about eligibility.",
          lifestyleGuidance: (p.preDiabetesResources as Record<string, unknown>)?.lifestyleGuidance as string[]
            ?? ["Talk to your doctor about the Medicare Diabetes Prevention Program (MDPP)", "Medicare covers nutrition counseling — ask about Medical Nutrition Therapy (MNT)"],
        }
      : null,
  };
}

function buildFallbackReport(input: ReportInput): HealthReport {
  return {
    generatedAt: new Date().toISOString(),
    patientSummary: {
      age: input.patient?.age ?? null,
      gender: input.patient?.gender ?? null,
      coverageType: "Original Medicare",
      coverageParts: input.coverage.map((c) => c.type),
    },
    redFlags: [],
    diabetesSection: {
      classification: input.diabetesClassification as HealthReport["diabetesSection"]["classification"],
      findings: [],
      medicareBenefits: [],
      actionItems: [],
    },
    obesitySection: {
      classification: input.obesityClassification as HealthReport["obesitySection"]["classification"],
      findings: [],
      medicareBenefits: [],
      actionItems: [],
    },
    conditionsSummary: [],
    medicationReview: [],
    screeningStatus: [],
    dmeSupplies: null,
    careTeam: [],
    recentDenials: [],
    hospiceStatus: input.isHospice,
    preDiabetesResources: null,
  };
}
