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
      <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible">
        {coverage.map((cov, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[200px] sm:w-auto bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  cov.status === "Active" ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {cov.status}
              </span>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {cov.type}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Since {cov.startDate}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
