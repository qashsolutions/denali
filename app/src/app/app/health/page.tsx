"use client";

import { HeartPulseIcon } from "@/components/icons";

export default function HealthPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <div className="w-20 h-20 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-6">
        <HeartPulseIcon className="w-10 h-10 text-red-500" />
      </div>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
        My Health
      </h1>
      <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
        Connect your clinic to see your health records, medications, and lab
        results in plain English.
      </p>

      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-8">
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Coming soon — we&apos;re building secure connections to OpenEMR and
          Medicare Blue Button 2.0.
        </p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] text-left">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 text-sm">1</span>
            </div>
            <span className="text-sm text-[var(--text-secondary)]">
              Connect your clinic or Medicare.gov
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] text-left">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 text-sm">2</span>
            </div>
            <span className="text-sm text-[var(--text-secondary)]">
              See your conditions, meds, and labs
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] text-left">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 text-sm">3</span>
            </div>
            <span className="text-sm text-[var(--text-secondary)]">
              AI explains everything in plain English
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
