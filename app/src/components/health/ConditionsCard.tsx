"use client";

/**
 * Conditions Card
 *
 * Displays diabetes-related diagnoses from FHIR Condition resources.
 */

import type { DiagnosisSummary } from "@/lib/fhir/transforms";

interface ConditionsCardProps {
  conditions: DiagnosisSummary[];
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  type1: { label: "Type 1", color: "text-red-600", bg: "bg-red-500/10" },
  type2: { label: "Type 2", color: "text-red-600", bg: "bg-red-500/10" },
  "other-diabetes": { label: "Diabetes", color: "text-red-600", bg: "bg-red-500/10" },
  "pre-diabetic": { label: "Pre-Diabetic", color: "text-amber-600", bg: "bg-amber-500/10" },
  obesity: { label: "Obesity", color: "text-amber-600", bg: "bg-amber-500/10" },
  other: { label: "Other", color: "text-gray-600", bg: "bg-gray-500/10" },
};

export function ConditionsCard({ conditions }: ConditionsCardProps) {
  if (conditions.length === 0) return null;

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
        Diagnoses
      </h2>

      <div className="space-y-3">
        {conditions.map((cond, i) => {
          const cat = CATEGORY_LABELS[cond.category] ?? CATEGORY_LABELS.other;
          return (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {cond.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {cond.code} &mdash; {cond.recordedDate}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${cat.bg} ${cat.color}`}>
                {cat.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
