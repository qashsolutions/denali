"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  ScreeningHistory,
  MedicationSummary,
  DiagnosisSummary,
  ProviderDetail,
  HospitalizationSummary,
} from "@/lib/fhir/transforms";

interface HealthAlert {
  severity: "red" | "amber";
  title: string;
  detail: string;
  chatMessage: string;
}

interface HealthAlertsBannerProps {
  screenings: ScreeningHistory[];
  medications: MedicationSummary[];
  conditions: DiagnosisSummary[];
  providers: ProviderDetail[];
  hospitalizations: HospitalizationSummary[];
}

export function HealthAlertsBanner({
  screenings,
  medications,
  conditions,
  providers,
  hospitalizations,
}: HealthAlertsBannerProps) {
  const router = useRouter();
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);

  const alerts = useMemo(() => {
    const result: HealthAlert[] = [];

    // Post-discharge follow-up (red) — most urgent
    const recentDischarges = hospitalizations.filter((h) => h.needsFollowUp);
    for (const h of recentDischarges) {
      result.push({
        severity: "red",
        title: "Post-discharge follow-up needed",
        detail: `Discharged from ${h.provider} ${h.daysSinceDischarge} days ago`,
        chatMessage: `I was discharged from ${h.provider} ${h.daysSinceDischarge} days ago. What follow-up care should I schedule?`,
      });
    }

    // Medication refill overdue (amber)
    const overdueMeds = medications.filter(
      (m) => (m.isDiabetesMed || m.isObesityMed) && m.gapDays != null && m.gapDays >= 14
    );
    if (overdueMeds.length > 0) {
      const med = overdueMeds[0];
      result.push({
        severity: "amber",
        title: "Medication refill may be overdue",
        detail: `${med.name} — ${med.gapDays} days since last fill`,
        chatMessage: `My ${med.name} refill may be overdue. Can you help me understand my options?`,
      });
    }

    // Screening overdue (amber)
    const overdueScreenings = screenings.filter((s) => s.isOverdue);
    for (const s of overdueScreenings) {
      result.push({
        severity: "amber",
        title: `${s.displayName} overdue`,
        detail: `Last: ${s.lastDate} (${s.monthsSinceLast} months ago)`,
        chatMessage: `My ${s.displayName.toLowerCase()} is overdue. What should I do?`,
      });
    }

    // No endocrinologist (amber) — only if diabetic
    const hasDiabetesDx = conditions.some((c) =>
      ["type1", "type2", "other-diabetes"].includes(c.category)
    );
    if (hasDiabetesDx && providers.length > 0) {
      const hasEndo = providers.some((p) =>
        p.specialty?.toLowerCase().includes("endocrin")
      );
      if (!hasEndo) {
        result.push({
          severity: "amber",
          title: "No endocrinologist visits found",
          detail: "Consider a referral for specialized diabetes care",
          chatMessage:
            "I have diabetes but haven't seen an endocrinologist. Can you find one near me who accepts Medicare?",
        });
      }
    }

    return result;
  }, [screenings, medications, conditions, providers, hospitalizations]);

  if (alerts.length === 0) return null;

  const hasRedAlerts = alerts.some((a) => a.severity === "red");
  const isExpanded = !isManuallyCollapsed;
  const headerBg = hasRedAlerts
    ? "bg-red-500/5 border-red-500/20"
    : "bg-amber-500/5 border-amber-500/20";
  const headerText = hasRedAlerts
    ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";

  return (
    <div>
      <button
        onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)}
        className={`w-full rounded-xl border ${headerBg} p-4 flex items-center justify-between transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${headerText}`}>
            {hasRedAlerts ? "!!!" : "!!"}
          </span>
          <span className={`text-sm font-semibold ${headerText}`}>
            {alerts.length} Health Alert{alerts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span
          className={`text-xs ${headerText} transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        >
          &#9660;
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
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
                <span
                  className={`text-sm font-bold ${
                    alert.severity === "red"
                      ? "text-red-500"
                      : "text-amber-500"
                  }`}
                >
                  {alert.severity === "red" ? "!!!" : "!!"}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      alert.severity === "red"
                        ? "text-red-700 dark:text-red-400"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {alert.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {alert.detail}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/app/chat?message=${encodeURIComponent(alert.chatMessage)}`
                      );
                    }}
                    className="text-xs font-medium text-[var(--accent-primary)] hover:underline mt-1"
                  >
                    Talk to Denali
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
