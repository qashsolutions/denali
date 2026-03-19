/**
 * Health Context for Claude Prompts
 *
 * Builds a concise text block from cached health data
 * that gets injected into the system prompt.
 */

import type { SessionState } from "@/lib/session-state";

/**
 * Build a concise health context string for injection into Claude's system prompt.
 * Returns null if no health data is available or if the user has revoked health_data_ai consent.
 */
export function buildHealthContextForPrompt(sessionState: SessionState): string | null {
  if (!sessionState.healthDataAvailable) return null;

  // Respect consent: only inject if user has explicitly enabled health_data_ai
  // Use !== true (not === false) so null/undefined never accidentally grants access
  if (sessionState.consentHealthDataAi !== true) return null;

  const lines: string[] = [
    "## PATIENT CHART — Medicare Health Data (YOU HAVE ALREADY REVIEWED THIS)",
    "",
    "CRITICAL: The following is this patient's actual Medicare data. You ALREADY KNOW this information.",
    "When the patient mentions ANY condition, medication, or service listed below, respond as if you",
    "have already reviewed their chart. NEVER ask them to confirm what you can see here.",
    "",
  ];

  // SAFETY: Hospice detection — suppress aggressive recommendations
  if (sessionState.isHospice) {
    lines.push("⚠️ HOSPICE: This patient has hospice claims. Do NOT recommend aggressive treatment, new specialist referrals, or screening follow-ups. Focus on comfort, symptom management, and Medicare hospice benefit coverage.");
    lines.push("");
  }

  // Active coverage
  if (sessionState.activeCoverage && sessionState.activeCoverage.length > 0) {
    lines.push("**Active Coverage:**");
    for (const cov of sessionState.activeCoverage) {
      lines.push(`- ${cov}`);
    }
    if (sessionState.maPlanName) {
      lines.push(`- **Medicare Advantage Plan:** ${sessionState.maPlanName}`);
    }
    lines.push("");
  }

  // Recent claims (for EOB review)
  if (sessionState.recentClaims && sessionState.recentClaims.length > 0) {
    lines.push("**Recent Claims (most recent first):**");
    for (const claim of sessionState.recentClaims) {
      const procedures = claim.procedures.length > 0 ? claim.procedures.join(", ") : "N/A";
      const diagnoses = claim.diagnosis.length > 0 ? claim.diagnosis.join(", ") : "N/A";
      lines.push(`- **${claim.serviceDate}** — ${claim.type} | ${claim.status}`);
      lines.push(`  Provider: ${claim.provider}`);
      lines.push(`  Services: ${procedures}`);
      lines.push(`  Diagnoses: ${diagnoses}`);
      lines.push(`  Charged: ${claim.totalCharged} | Medicare paid: ${claim.medicarePaid} | You owe: ${claim.youOwe}`);
      if (claim.status === "Denied" && claim.denialReasons?.length) {
        lines.push(`  Denial reason: ${claim.denialReasons[0]}`);
      }
    }
    lines.push("");
    lines.push("**ACTION:** When a user asks about their bill or EOB, reference this claim data directly. Summarize the most recent claim proactively instead of asking which one. Explain charges, what Medicare paid, and what the user owes in plain English.");
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

  // Diabetes & obesity conditions
  if (sessionState.conditions && sessionState.conditions.length > 0) {
    const diabetesConds = sessionState.conditions.filter(c => c.category !== "obesity");
    const obesityConds = sessionState.conditions.filter(c => c.category === "obesity");

    if (diabetesConds.length > 0) {
      lines.push("**Diabetes Diagnoses:**");
      for (const cond of diabetesConds) {
        lines.push(`- ${cond.name} (${cond.code}) — ${cond.category}`);
      }
      lines.push("");
    }

    if (obesityConds.length > 0) {
      lines.push("**Obesity Diagnoses:**");
      for (const cond of obesityConds) {
        lines.push(`- ${cond.name} (${cond.code})`);
      }
      lines.push("");
    }
  }

  // Active medications
  if (sessionState.medications && sessionState.medications.length > 0) {
    const diabetesMeds = sessionState.medications.filter(m => m.isDiabetesMed);
    const otherActiveMeds = sessionState.medications.filter(m => !m.isDiabetesMed && m.status === "Active");

    if (diabetesMeds.length > 0) {
      lines.push("**Active Diabetes Medications:**");
      for (const med of diabetesMeds) {
        let detail = `(${med.status})`;
        if (med.daysSupply) detail += ` — ${med.daysSupply}-day supply`;
        if (med.isBrandName != null) detail += med.isBrandName ? " [Brand]" : " [Generic]";
        if (med.gapDays != null && med.gapDays >= 14) detail += ` — REFILL OVERDUE by ${med.gapDays} days`;
        lines.push(`- ${med.name} ${detail}`);
      }
      lines.push("");
      const gapMeds = diabetesMeds.filter(m => m.gapDays != null && m.gapDays >= 14);
      if (gapMeds.length > 0) {
        lines.push(`**ACTION:** ${gapMeds.length} diabetes medication(s) may need refilling. Ask if they need help with refills.`);
        lines.push("");
      }
    }
    const obesityMeds = sessionState.medications.filter(m => m.isObesityMed && !m.isDiabetesMed);
    if (obesityMeds.length > 0) {
      lines.push("**Active Weight-Management Medications:**");
      for (const med of obesityMeds) {
        let detail = `(${med.status})`;
        if (med.daysSupply) detail += ` — ${med.daysSupply}-day supply`;
        if (med.gapDays != null && med.gapDays >= 14) detail += ` — REFILL OVERDUE by ${med.gapDays} days`;
        lines.push(`- ${med.name} ${detail}`);
      }
      lines.push("");
    }

    if (otherActiveMeds.length > 0) {
      lines.push(`**Other Active Medications:** ${otherActiveMeds.length} non-diabetes medications`);
      lines.push("");
    }
  }

  // Diabetes classification
  if (sessionState.diabetesClassification) {
    const classLabel = {
      "diabetic": "Diabetic",
      "pre-diabetic": "Pre-Diabetic",
      "at-risk": "At Risk for Diabetes",
      "none": "No diabetes indicators",
    }[sessionState.diabetesClassification];
    lines.push(`**Diabetes Classification:** ${classLabel}`);
    if (sessionState.diabetesClassification === "diabetic") {
      lines.push("**ACTION:** Focus on management optimization. Check if using all Medicare-covered benefits (DSMT, supplies, MNT).");
    } else if (sessionState.diabetesClassification === "pre-diabetic") {
      lines.push("**ACTION:** Focus on prevention. Recommend MDPP enrollment. Lifestyle coaching.");
    } else if (sessionState.diabetesClassification === "at-risk") {
      lines.push("**ACTION:** Recommend screening. Suggest diabetes risk assessment.");
    }
    lines.push("");
  }

  // Obesity classification
  if (sessionState.obesityClassification && sessionState.obesityClassification !== "none") {
    const obesityLabel = {
      "obese": "Obese (diagnosed or on weight-management medication)",
      "at-risk": "At Risk for Obesity (pre-diabetes or elevated BMI indicators)",
    }[sessionState.obesityClassification];
    lines.push(`**Obesity Classification:** ${obesityLabel}`);
    if (sessionState.obesityClassification === "obese") {
      lines.push("**ACTION:** Offer obesity management guidance. Check Medicare-covered benefits: IBT (NCD 210.12), nutrition counseling, bariatric surgery evaluation (NCD 100.1). If on GLP-1, mention Part D $35/month insulin cap may also apply for dual-use drugs.");
    } else if (sessionState.obesityClassification === "at-risk") {
      lines.push("**ACTION:** Recommend BMI screening at next visit. Mention Medicare covers Intensive Behavioral Therapy for obesity (NCD 210.12) if BMI ≥ 30.");
    }
    lines.push("");
  }

  // Lab trends (longitudinal A1C history)
  if (sessionState.labTrends && sessionState.labTrends.length > 0) {
    const a1cTrends = sessionState.labTrends.filter((t) =>
      t.loincCode === "4548-4" || t.loincCode === "59261-8"
    );
    if (a1cTrends.length > 0) {
      lines.push("**A1C History (longitudinal):**");
      let prevValue: number | null = null;
      for (const t of a1cTrends) {
        let arrow = "";
        if (prevValue !== null) {
          const diff = t.value - prevValue;
          if (diff > 0.01) arrow = " \u2191 rising";
          else if (diff < -0.01) arrow = " \u2193 improving";
          else arrow = " \u2192 stable";
        }
        lines.push(`- ${t.date}: ${t.value}%${arrow}`);
        prevValue = t.value;
      }
      lines.push("");
      lines.push("**ACTION:** Reference actual A1C trend when coaching. Note improvements or concerns.");
      lines.push("");
    }
  }

  // Recent self-reported log summary
  if (sessionState.recentLogSummary) {
    lines.push("**Recent Patient Log Entries:**");
    lines.push(sessionState.recentLogSummary);
    lines.push("");
  }

  // Screenings (P0)
  if (sessionState.screenings && sessionState.screenings.length > 0) {
    lines.push("**Recent Screenings:**");
    const overdue: string[] = [];
    for (const s of sessionState.screenings) {
      const status = s.isOverdue ? "(OVERDUE)" : "";
      lines.push(`- ${s.displayName}: ${s.lastDate} (${s.monthsSinceLast} months ago) ${status}`);
      if (s.isOverdue) overdue.push(s.displayName);
    }
    lines.push("");
    if (overdue.length > 0) {
      lines.push(`**ACTION:** ${overdue.length} screening(s) overdue: ${overdue.join(", ")}. Proactively mention when relevant. All covered by Medicare.`);
      lines.push("");
    }
  }

  // Providers (P2)
  if (sessionState.providers && sessionState.providers.length > 0) {
    lines.push("**Care Team:**");
    for (const p of sessionState.providers.slice(0, 8)) {
      const spec = p.specialty ? ` (${p.specialty})` : "";
      lines.push(`- ${p.name}${spec}: ${p.visitCount} visit(s), last seen ${p.lastSeen}`);
    }
    lines.push("");
  }

  // Hospitalizations (P3)
  if (sessionState.hospitalizations && sessionState.hospitalizations.length > 0) {
    const recent = sessionState.hospitalizations.filter(h => h.daysSinceDischarge <= 90);
    if (recent.length > 0) {
      lines.push("**Recent Hospitalizations:**");
      for (const h of recent) {
        const followUp = h.needsFollowUp ? " — FOLLOW-UP NEEDED" : "";
        lines.push(`- ${h.admissionDate} to ${h.dischargeDate} (${h.lengthOfStay} days) at ${h.provider}${followUp}`);
        if (h.diagnoses.length > 0) {
          lines.push(`  Diagnoses: ${h.diagnoses.slice(0, 3).join(", ")}`);
        }
      }
      lines.push("");
      const needsFollowUp = recent.filter(h => h.needsFollowUp);
      if (needsFollowUp.length > 0) {
        lines.push(`**ACTION:** ${needsFollowUp.length} recent discharge(s) within 30 days. Proactively ask about follow-up care and recovery.`);
        lines.push("");
      }
    }
  }

  // DME supplies
  if (sessionState.dme && sessionState.dme.length > 0) {
    lines.push("**DME Supplies:**");
    for (const d of sessionState.dme) {
      const relevance: string[] = [];
      if (d.isRelevantToDiabetes) relevance.push("diabetes");
      if (d.isRelevantToObesity) relevance.push("obesity");
      const relStr = relevance.length > 0 ? ` (relevant to ${relevance.join(", ")})` : "";
      lines.push(`- ${d.category}: ${d.items.join(", ")}${relStr}`);
    }
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

  // Post-amble: repeat instruction at end of health data (positional attention)
  lines.push("---");
  lines.push("REMINDER: You have this patient's full Medicare chart above. Use it directly in every response.");
  lines.push("When they mention a condition, medication, or service from their records, LEAD with what you know.");
  lines.push("A generic response when you have specific patient data is the worst possible experience.");

  const result = lines.join("\n");

  // Safety cap: truncate if health context exceeds 4KB to limit prompt size
  const MAX_HEALTH_CONTEXT_CHARS = 4096;
  if (result.length > MAX_HEALTH_CONTEXT_CHARS) {
    return result.slice(0, MAX_HEALTH_CONTEXT_CHARS) + "\n\n[Health data truncated for brevity]";
  }

  return result;
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
