"use client";

import { useState } from "react";
import type { ConsentState } from "@/hooks/useConsent";

interface DiabetesConsentCardProps {
  consent: ConsentState;
  onUpdateConsent: (type: keyof ConsentState, granted: boolean) => Promise<void>;
}

export function DiabetesConsentCard({ consent, onUpdateConsent }: DiabetesConsentCardProps) {
  const [aiConsent, setAiConsent] = useState(consent.health_data_ai);
  const [storageConsent, setStorageConsent] = useState(consent.health_data_storage);
  const [saving, setSaving] = useState(false);

  const handleEnable = async () => {
    setSaving(true);
    try {
      if (aiConsent !== consent.health_data_ai) {
        await onUpdateConsent("health_data_ai", aiConsent);
      }
      if (storageConsent !== consent.health_data_storage) {
        await onUpdateConsent("health_data_storage", storageConsent);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Personalize Your Diabetes Care
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Denali can analyze your Medicare health data to provide personalized coaching,
            track trends, and remind you about screenings.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={aiConsent}
            onChange={(e) => setAiConsent(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border)] accent-violet-500"
          />
          <span className="text-sm text-[var(--text-primary)]">
            Allow AI to use my health data
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={storageConsent}
            onChange={(e) => setStorageConsent(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border)] accent-violet-500"
          />
          <span className="text-sm text-[var(--text-primary)]">
            Store my health data for trend tracking
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleEnable}
          disabled={saving || (!aiConsent && !storageConsent)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Enable"}
        </button>
      </div>
    </div>
  );
}
