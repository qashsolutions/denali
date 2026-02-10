"use client";

import type { DiagnosisAggregate } from "@/lib/health-analytics";

interface DiagnosisSummaryCardProps {
  diagnoses: DiagnosisAggregate[];
}

export function DiagnosisSummaryCard({ diagnoses }: DiagnosisSummaryCardProps) {
  if (diagnoses.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Conditions in Your Claims
      </h3>
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {diagnoses.map((dx, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {dx.name}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-[var(--text-muted)]">
                Seen {dx.count} time{dx.count !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Last: {dx.lastSeen}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
