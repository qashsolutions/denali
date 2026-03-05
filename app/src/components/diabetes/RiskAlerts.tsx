"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  LabResult,
  DiagnosisSummary,
  MedicationSummary,
  DiabetesClassification,
  ProviderDetail,
  HospitalizationSummary,
  ScreeningHistory,
} from "@/lib/fhir/transforms";
import type { SnapshotPoint } from "@/hooks/useDiabetesSnapshots";

interface RiskAlertsProps {
  labs: LabResult[];
  conditions: DiagnosisSummary[];
  medications: MedicationSummary[];
  classification: DiabetesClassification | null;
  a1cHistory?: SnapshotPoint[];
  providers?: ProviderDetail[];
  hospitalizations?: HospitalizationSummary[];
  screenings?: ScreeningHistory[];
}

interface Alert {
  severity: "red" | "amber";
  title: string;
  chatMessage: string;
  ctaLabel?: string;
}

export function RiskAlerts({ labs, conditions, medications, classification, a1cHistory, providers, hospitalizations, screenings }: RiskAlertsProps) {
  const router = useRouter();

  const alerts = useMemo(() => {
    const result: Alert[] = [];

    const latestA1C = labs.find((l) => l.name.toLowerCase().includes("a1c"));

    // A1C >= 9.0 — urgent
    if (latestA1C && latestA1C.value >= 9.0) {
      result.push({
        severity: "red",
        title: "Urgent: Very high A1C",
        chatMessage: `My A1C is ${latestA1C.value}%. What should I do?`,
      });
    }

    // Diabetes diagnosis but no active diabetes meds
    const hasDiabetesDx = conditions.some((c) =>
      ["type1", "type2", "other-diabetes"].includes(c.category)
    );
    const hasActiveDiabetesMed = medications.some(
      (m) => m.isDiabetesMed && m.status === "Active"
    );
    if (hasDiabetesDx && !hasActiveDiabetesMed) {
      result.push({
        severity: "amber",
        title: "No diabetes medications found",
        chatMessage: "I have a diabetes diagnosis but no active medications. What should I ask my doctor?",
      });
    }

    // Medication refill gap (P1) — overdue by 14+ days
    const overdueMeds = medications.filter(
      (m) => m.isDiabetesMed && m.gapDays != null && m.gapDays >= 14
    );
    if (overdueMeds.length > 0) {
      const medName = overdueMeds[0].name;
      result.push({
        severity: "amber",
        title: "Medication refill may be overdue",
        chatMessage: `My ${medName} refill may be overdue. Can you help me understand my options?`,
      });
    }

    // A1C trending up (compare last 2 points from snapshot history)
    if (a1cHistory && a1cHistory.length >= 2) {
      const latest = a1cHistory[a1cHistory.length - 1];
      const previous = a1cHistory[a1cHistory.length - 2];
      if (latest.value - previous.value >= 0.5) {
        result.push({
          severity: "amber",
          title: "A1C trending up",
          chatMessage: `My A1C went from ${previous.value}% to ${latest.value}%. What should I do?`,
        });
      }
    }

    // No endocrinologist visits (P2) — if diabetic and no endo in providers
    if (hasDiabetesDx && providers && providers.length > 0) {
      const hasEndo = providers.some(
        (p) => p.specialty?.toLowerCase().includes("endocrin")
      );
      if (!hasEndo) {
        result.push({
          severity: "amber",
          title: "No endocrinologist visits found",
          chatMessage: "I have diabetes but haven't seen an endocrinologist. Can you find one near me who accepts Medicare?",
          ctaLabel: "Find a specialist",
        });
      }
    }

    // Post-discharge follow-up (P3) — recent discharge within 30 days
    if (hospitalizations && hospitalizations.length > 0) {
      const recentDischarges = hospitalizations.filter((h) => h.needsFollowUp);
      if (recentDischarges.length > 0) {
        const h = recentDischarges[0];
        result.push({
          severity: "red",
          title: "Post-discharge follow-up needed",
          chatMessage: `I was discharged from ${h.provider} ${h.daysSinceDischarge} days ago. What follow-up care should I schedule?`,
        });
      }
    }

    // Obesity + no counseling — obesity diagnosis but no obesity-counseling screenings
    const hasObesityDx = conditions.some((c) => c.category === "obesity");
    if (hasObesityDx && screenings) {
      const hasObesityCounseling = screenings.some(
        (s) => s.screeningType === "obesity-counseling"
      );
      if (!hasObesityCounseling) {
        result.push({
          severity: "amber",
          title: "No obesity counseling visits found",
          chatMessage: "I have an obesity diagnosis but no counseling visits. Can you find a provider near me who offers Medicare-covered obesity counseling?",
          ctaLabel: "Find a specialist",
        });
      }
    }

    // Obesity medication refill gap — obesity-only meds (not dual-flagged diabetes)
    const overdueObesityMeds = medications.filter(
      (m) => m.isObesityMed && !m.isDiabetesMed && m.gapDays != null && m.gapDays >= 14
    );
    if (overdueObesityMeds.length > 0) {
      const medName = overdueObesityMeds[0].name;
      result.push({
        severity: "amber",
        title: "Weight management medication refill may be overdue",
        chatMessage: `My ${medName} refill may be overdue. Can you help me understand my options?`,
      });
    }

    // Obesity + diabetes + no endocrinologist
    if (hasObesityDx && hasDiabetesDx && providers && providers.length > 0) {
      const hasEndo = providers.some(
        (p) => p.specialty?.toLowerCase().includes("endocrin")
      );
      if (!hasEndo) {
        result.push({
          severity: "amber",
          title: "No endocrinologist for obesity + diabetes",
          chatMessage: "I have both obesity and diabetes but haven't seen an endocrinologist. Can you find one near me who accepts Medicare?",
          ctaLabel: "Find a specialist",
        });
      }
    }

    return result;
  }, [labs, conditions, medications, classification, a1cHistory, providers, hospitalizations, screenings]);

  if (alerts.length === 0) return null;

  return (
    <section className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`rounded-xl border p-4 ${
            alert.severity === "red"
              ? "bg-red-500/5 border-red-500/20"
              : "bg-amber-500/5 border-amber-500/20"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className={`text-sm font-bold ${
              alert.severity === "red" ? "text-red-500" : "text-amber-500"
            }`}>
              {alert.severity === "red" ? "!!!" : "!!"}
            </span>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                alert.severity === "red"
                  ? "text-red-700 dark:text-red-400"
                  : "text-amber-700 dark:text-amber-400"
              }`}>
                {alert.title}
              </p>
              <button
                onClick={() => router.push(`/app/chat?message=${encodeURIComponent(alert.chatMessage)}`)}
                className="text-xs font-medium text-[var(--accent-primary)] hover:underline mt-1"
              >
                {alert.ctaLabel || "Talk to Denali"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
