/**
 * Diabetes Insights — Claude-generated Analysis
 *
 * Generates personalized diabetes insights using Claude via AWS Bedrock.
 * Includes summary, recommendations, risk alerts, and screening reminders.
 */

import { createHash } from "crypto";
import { API_CONFIG } from "@/config";
import { getClaudeClient } from "@/lib/claude";

export interface InsightInput {
  classification: string;
  a1cHistory: Array<{ date: string; value: number }>;
  labs: Array<{ name: string; value: number; unit: string; date: string }>;
  conditions: Array<{ code: string; name: string; category: string }>;
  medications: Array<{ name: string; status: string; isDiabetesMed: boolean }>;
  recentLogEntries: Array<{ entry_type: string; logged_at: string; glucose_value?: number | null; activity_minutes?: number | null; note?: string | null }>;
}

export interface InsightOutput {
  summary: string;
  recommendations: string[];
  riskAlerts: Array<{ severity: string; message: string }>;
  screeningReminders: Array<{ message: string }>;
}

/**
 * Compute a deterministic hash of the input data for change detection.
 */
export function computeDataHash(data: InsightInput): string {
  const normalized = JSON.stringify({
    classification: data.classification,
    a1c: data.a1cHistory.map((p) => `${p.date}:${p.value}`),
    labs: data.labs.map((l) => `${l.name}:${l.value}`),
    conditions: data.conditions.map((c) => c.code),
    medications: data.medications.filter((m) => m.isDiabetesMed).map((m) => m.name),
    logCount: data.recentLogEntries.length,
  });
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Generate diabetes insights using Claude API.
 */
export async function generateDiabetesInsight(
  data: InsightInput
): Promise<InsightOutput> {
  const claude = getClaudeClient();

  const prompt = buildPrompt(data);

  const response = await claude.messages.create({
    model: API_CONFIG.claude.model,
    max_tokens: 600,
    system: "You are a Medicare health data analyst. Respond ONLY with valid JSON matching the exact schema requested. No markdown, no commentary.",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("");

  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || "Unable to generate summary.",
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [],
      riskAlerts: Array.isArray(parsed.riskAlerts) ? parsed.riskAlerts : [],
      screeningReminders: Array.isArray(parsed.screeningReminders) ? parsed.screeningReminders : [],
    };
  } catch {
    console.error("[DiabetesInsights] Failed to parse Claude response:", text.slice(0, 200));
    return {
      summary: "Unable to generate insights at this time.",
      recommendations: [],
      riskAlerts: [],
      screeningReminders: [],
    };
  }
}

function buildPrompt(data: InsightInput): string {
  const lines: string[] = [];

  lines.push("Given this Medicare patient's diabetes-related data, generate insights.");
  lines.push("");
  lines.push(`Classification: ${data.classification}`);

  if (data.a1cHistory.length > 0) {
    lines.push("");
    lines.push("A1C History:");
    for (const p of data.a1cHistory) {
      lines.push(`  ${p.date}: ${p.value}%`);
    }
  }

  if (data.labs.length > 0) {
    lines.push("");
    lines.push("Current Labs:");
    for (const l of data.labs) {
      lines.push(`  ${l.name}: ${l.value}${l.unit} (${l.date})`);
    }
  }

  if (data.conditions.length > 0) {
    lines.push("");
    lines.push("Conditions:");
    for (const c of data.conditions) {
      lines.push(`  ${c.name} (${c.code})`);
    }
  }

  const diabetesMeds = data.medications.filter((m) => m.isDiabetesMed);
  if (diabetesMeds.length > 0) {
    lines.push("");
    lines.push("Diabetes Medications:");
    for (const m of diabetesMeds) {
      lines.push(`  ${m.name} (${m.status})`);
    }
  }

  if (data.recentLogEntries.length > 0) {
    lines.push("");
    lines.push("Recent Self-Reported Entries:");
    for (const e of data.recentLogEntries.slice(0, 10)) {
      if (e.entry_type === "glucose" && e.glucose_value) {
        lines.push(`  Glucose: ${e.glucose_value} mg/dL (${e.logged_at})`);
      } else if (e.entry_type === "activity" && e.activity_minutes) {
        lines.push(`  Activity: ${e.activity_minutes} min (${e.logged_at})`);
      } else if (e.note) {
        lines.push(`  ${e.entry_type}: ${e.note} (${e.logged_at})`);
      }
    }
  }

  lines.push("");
  lines.push("Rules:");
  lines.push("- Never diagnose. Only reference Medicare-covered services.");
  lines.push("- Reference actual values from the data above.");
  lines.push("- Write at an 8th grade reading level, no jargon.");
  lines.push("- Recommendations should be about Medicare-covered services the patient could use.");
  lines.push("");
  lines.push('Respond with ONLY this JSON schema:');
  lines.push('{');
  lines.push('  "summary": "2-3 sentence overview of current status",');
  lines.push('  "recommendations": ["actionable recommendation 1", "...up to 5"],');
  lines.push('  "riskAlerts": [{"severity": "red|amber", "message": "alert text"}],');
  lines.push('  "screeningReminders": [{"message": "reminder text"}]');
  lines.push('}');

  return lines.join("\n");
}
