"use client";

import { DiabetesIcon } from "@/components/icons";
import { CmsPledge } from "@/components/ui";

export default function DiabetesPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <div className="w-20 h-20 rounded-2xl bg-violet-500/15 flex items-center justify-center mx-auto mb-6">
        <DiabetesIcon className="w-10 h-10 text-violet-500" />
      </div>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
        Diabetes Care
      </h1>
      <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
        Personalized coaching from your own lab results. Track A1C, glucose,
        medications, and get AI-powered guidance.
      </p>

      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-8">
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Coming soon — connect your health records first to unlock diabetes
          coaching.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <FeaturePreview
            icon="📊"
            label="A1C Trends"
          />
          <FeaturePreview
            icon="💊"
            label="Med Reminders"
          />
          <FeaturePreview
            icon="🏃"
            label="Activity Log"
          />
          <FeaturePreview
            icon="🍎"
            label="Nutrition Log"
          />
        </div>
      </div>

      <div className="mt-6">
        <CmsPledge type="diabetes" />
      </div>
    </div>
  );
}

function FeaturePreview({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-tertiary)]">
      <span className="text-lg">{icon}</span>
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}
