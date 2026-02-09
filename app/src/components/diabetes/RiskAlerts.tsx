"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  LabResult,
  DiagnosisSummary,
  MedicationSummary,
  DiabetesClassification,
} from "@/lib/fhir/transforms";
import type { SnapshotPoint } from "@/hooks/useDiabetesSnapshots";

interface RiskAlertsProps {
  labs: LabResult[];
  conditions: DiagnosisSummary[];
  medications: MedicationSummary[];
  classification: DiabetesClassification | null;
  a1cHistory?: SnapshotPoint[];
}

interface Alert {
  severity: "red" | "amber";
  title: string;
  chatMessage: string;
}

export function RiskAlerts({ labs, conditions, medications, classification, a1cHistory }: RiskAlertsProps) {
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

    return result;
  }, [labs, conditions, medications, classification, a1cHistory]);

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
                Talk to Denali
              </button>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
