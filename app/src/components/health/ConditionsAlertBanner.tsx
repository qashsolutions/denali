"use client";

import { useMemo } from "react";
import type { DiagnosisAggregate } from "@/lib/health-analytics";
import type { DiagnosisSummary } from "@/lib/fhir/transforms";
import { getSeverityConfig, cleanDiagnosisName } from "./DiagnosisSummaryCard";

interface ConditionsAlertBannerProps {
  diagnoses: DiagnosisAggregate[];
  conditions?: DiagnosisSummary[];
}

export function ConditionsAlertBanner({ diagnoses, conditions = [] }: ConditionsAlertBannerProps) {
  const flagged = useMemo(() => {
    const items: { name: string; level: "red" | "amber" }[] = [];
    for (const dx of diagnoses) {
      const cleaned = cleanDiagnosisName(dx.name);
      if (cleaned.length < 3) continue;
      const severity = getSeverityConfig(dx.name, conditions);
      if (severity.level === "red" || severity.level === "amber") {
        items.push({ name: cleaned, level: severity.level });
      }
    }
    return items;
  }, [diagnoses, conditions]);

  if (flagged.length === 0) return null;

  const redCount = flagged.filter((f) => f.level === "red").length;
  const amberCount = flagged.filter((f) => f.level === "amber").length;

  const borderColor = redCount > 0 ? "border-red-500/30" : "border-amber-500/30";
  const bgColor = redCount > 0 ? "bg-red-500/5" : "bg-amber-500/5";
  const dotColor = redCount > 0 ? "bg-red-500" : "bg-amber-500";

  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById("conditions-section")?.scrollIntoView({ behavior: "smooth" });
      }}
      className={`w-full ${bgColor} border ${borderColor} rounded-xl px-4 py-3 text-left hover:brightness-95 transition-all`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {flagged.length} condition{flagged.length !== 1 ? "s" : ""} may need provider attention
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
            {redCount > 0 && <span className="text-red-500 font-medium">{redCount} urgent</span>}
            {redCount > 0 && amberCount > 0 && <span> &middot; </span>}
            {amberCount > 0 && <span className="text-amber-500 font-medium">{amberCount} to monitor</span>}
          </p>
        </div>
        <span className="text-xs font-medium text-[var(--text-muted)] shrink-0">
          View &darr;
        </span>
      </div>
    </button>
  );
}
