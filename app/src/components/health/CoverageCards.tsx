"use client";

import type { CoverageSummary } from "@/lib/fhir/transforms";

interface CoverageCardsProps {
  coverage: CoverageSummary[];
}

export function CoverageCards({ coverage }: CoverageCardsProps) {
  if (coverage.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Coverage
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {coverage.map((cov, i) => (
          <div
            key={i}
            className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  cov.status === "Active" ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {cov.status}
              </span>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              {cov.type}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Since {cov.startDate}
            </p>
            {cov.planName && (
              <p className="text-xs text-[var(--text-muted)] mt-1">{cov.planName}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
