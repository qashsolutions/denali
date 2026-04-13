"use client";

import { useState } from "react";
import type { PatientSummary } from "@/lib/fhir/transforms";

interface AccountSectionProps {
  patient: PatientSummary | null;
  lastSynced: Date | null;
  onRefresh: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function AccountSection({
  patient,
  lastSynced,
  onRefresh,
  onDisconnect,
}: AccountSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timeAgo = lastSynced ? formatTimeAgo(lastSynced) : null;

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Your Medicare Account
          </span>
          {timeAgo && (
            <span className="text-xs text-[var(--text-muted)]">
              &middot; Synced {timeAgo}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
          {/* PRIVACY §2: Only age + gender stored from FHIR Patient resource.
              No name, DOB, Medicare ID, or address is collected or displayed. */}
          {patient && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--health-red)]/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--health-red)] font-bold text-lg">
                    M
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Medicare Beneficiary
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {patient.age} years old &middot; {patient.gender}
                  </p>
                </div>
              </div>
            </div>
          )}

          {confirming ? (
            <div className="bg-[var(--bg-secondary)] rounded-xl border border-red-500/20 px-4 py-3">
              <p className="text-sm font-medium text-red-600 mb-2">
                Are you sure you want to disconnect your Medicare account?
              </p>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                This will permanently delete all cached health data, health reports,
                and diabetes insights. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirming(false);
                    onDisconnect();
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Yes, Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onRefresh}
                className="text-xs font-medium text-[var(--accent-primary)] hover:underline px-2 py-1"
              >
                Refresh Data
              </button>
              <span className="text-[var(--text-muted)]">&middot;</span>
              <button
                onClick={() => setConfirming(true)}
                className="text-xs font-medium text-[var(--text-muted)] hover:text-red-500 px-2 py-1"
              >
                Disconnect Medicare
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
