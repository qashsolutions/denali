"use client";

import { useEffect } from "react";
import type { ClaimSummary } from "@/lib/fhir/transforms";

interface ClaimDetailProps {
  claim: ClaimSummary;
  onClose: () => void;
}

export function ClaimDetail({ claim, onClose }: ClaimDetailProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[var(--bg-secondary)] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[var(--bg-secondary)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                {claim.type}
              </span>
              {claim.status === "Denied" ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">
                  Denied
                </span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
                  {claim.status}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {claim.serviceDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Provider */}
          <Section label="Provider">
            <p className="text-sm text-[var(--text-primary)]">{claim.provider}</p>
          </Section>

          {/* Diagnoses */}
          {claim.diagnosis.length > 0 && (
            <Section label="Diagnoses">
              <ul className="space-y-1">
                {claim.diagnosis.map((dx, i) => (
                  <li key={i} className="text-sm text-[var(--text-primary)]">
                    {dx}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Procedures */}
          {claim.procedures.length > 0 && (
            <Section label="Services">
              <ul className="space-y-1">
                {claim.procedures.map((px, i) => (
                  <li key={i} className="text-sm text-[var(--text-primary)]">
                    {px}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Amounts */}
          <Section label="Amounts">
            <div className="grid grid-cols-3 gap-3">
              <AmountBox label="Total Charged" value={claim.totalCharged} />
              <AmountBox label="Medicare Paid" value={claim.medicarePaid} />
              <AmountBox
                label="You Owe"
                value={claim.youOwe}
                highlight={claim.youOwe !== "$0.00"}
              />
            </div>
          </Section>

          {/* Denial warning */}
          {claim.status === "Denied" && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">
                This claim was denied
              </p>
              {claim.denialReasons?.map((reason, i) => (
                <p key={i} className="text-sm text-red-600/80 dark:text-red-400/80">
                  {reason}
                </p>
              ))}
              <a
                href="/app/claims"
                className="inline-block mt-3 text-sm font-medium text-[var(--accent-primary)] hover:underline"
              >
                Get Help Appealing &rarr;
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function AmountBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[var(--bg-tertiary)] rounded-xl px-3 py-2 text-center">
      <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
      <p
        className={`text-sm font-semibold ${
          highlight ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
