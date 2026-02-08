/**
 * Health Context for Claude Prompts
 *
 * Builds a concise text block from cached health data
 * that gets injected into the system prompt.
 */

import type { SessionState } from "@/lib/claude";

/**
 * Build a concise health context string for injection into Claude's system prompt.
 * Returns null if no health data is available or if the user has revoked health_data_ai consent.
 */
export function buildHealthContextForPrompt(sessionState: SessionState): string | null {
  if (!sessionState.healthDataAvailable) return null;

  // Respect consent: if user has revoked health_data_ai, skip injection
  if (sessionState.consentHealthDataAi === false) return null;

  const lines: string[] = [
    "## Medicare Health Data (from Blue Button 2.0)",
    "",
    "This user has connected their Medicare account. Use this data to personalize guidance.",
    "Do NOT ask the user for information you already have from their records.",
    "",
  ];

  // Active coverage
  if (sessionState.activeCoverage && sessionState.activeCoverage.length > 0) {
    lines.push("**Active Coverage:**");
    for (const cov of sessionState.activeCoverage) {
      lines.push(`- ${cov}`);
    }
    lines.push("");
  }

  // Lab results (diabetes-relevant)
  if (sessionState.labs && sessionState.labs.length > 0) {
    lines.push("**Lab Results:**");
    for (const lab of sessionState.labs) {
      const range = interpretLabValue(lab.name, lab.value);
      lines.push(`- ${lab.name}: ${lab.value}${lab.unit} (${lab.date})${range ? ` — ${range}` : ""}`);
    }
    lines.push("");
    lines.push(
      "**ACTION:** Use these lab values to personalize diabetes coaching. Reference actual numbers when discussing management."
    );
    lines.push("");
  }

  // Recent denials
  if (sessionState.recentDenials && sessionState.recentDenials.length > 0) {
    lines.push("**Recent Denied Claims (proactively offer appeal help):**");
    for (const denial of sessionState.recentDenials) {
      lines.push(
        `- ${denial.procedure} (${denial.serviceDate}): ${denial.denialReason}`
      );
    }
    lines.push("");
    lines.push(
      "**ACTION:** If the user hasn't mentioned these denials, gently ask if they'd like help appealing."
    );
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Interpret a lab value into a clinical range label.
 * Used to give Claude context without the user needing to interpret numbers.
 */
function interpretLabValue(name: string, value: number): string | null {
  const lower = name.toLowerCase();

  if (lower.includes("a1c") || lower.includes("hemoglobin a1c")) {
    if (value < 5.7) return "Normal range";
    if (value < 6.5) return "Pre-diabetic range";
    return "Diabetic range";
  }

  if (lower.includes("glucose") && lower.includes("fasting")) {
    if (value < 100) return "Normal range";
    if (value < 126) return "Pre-diabetic range";
    return "Diabetic range";
  }

  if (lower.includes("glucose")) {
    if (value < 140) return "Normal range";
    if (value < 200) return "Pre-diabetic range";
    return "Diabetic range";
  }

  return null;
}
