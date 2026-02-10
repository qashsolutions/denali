"use client";

import type { ProviderAggregate } from "@/lib/health-analytics";
import type { ProviderDetail } from "@/lib/fhir/transforms";

interface ProviderSummaryProps {
  providers: ProviderAggregate[];
  providerDetails?: ProviderDetail[];
}

export function ProviderSummary({ providers, providerDetails = [] }: ProviderSummaryProps) {
  if (providers.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Your Providers
      </h3>
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {providers.map((prov, i) => {
          // Look up specialty from ProviderDetail (match by name, case-insensitive)
          const detail = providerDetails.find(
            (d) => d.name.toLowerCase() === prov.name.toLowerCase()
          );
          const specialty = detail?.specialty;

          return (
            <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {prov.name}
                </p>
                {specialty && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {specialty}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-[var(--text-muted)]">
                  {prov.visits} visit{prov.visits !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Last: {prov.lastSeen}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
