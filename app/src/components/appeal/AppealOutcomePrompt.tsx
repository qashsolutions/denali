"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface AppealOutcomePromptProps {
  onSubmit: (outcome: "approved" | "denied" | "partial") => void;
  onCancel: () => void;
}

export function AppealOutcomePrompt({
  onSubmit,
  onCancel,
}: AppealOutcomePromptProps) {
  const [selected, setSelected] = useState<"approved" | "denied" | "partial" | null>(null);

  const handleSubmit = () => {
    if (selected) {
      onSubmit(selected);
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)] mt-4">
      <h3 className="text-[var(--text-primary)] font-medium mb-2">
        How did your appeal turn out?
      </h3>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Your feedback helps us improve recommendations for others.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelected("approved")}
          className={`min-h-[44px] px-4 py-2 rounded-lg font-medium text-sm transition-colors border ${
            selected === "approved"
              ? "bg-green-600 text-white border-green-600"
              : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border)] hover:border-green-500"
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setSelected("denied")}
          className={`min-h-[44px] px-4 py-2 rounded-lg font-medium text-sm transition-colors border ${
            selected === "denied"
              ? "bg-red-600 text-white border-red-600"
              : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border)] hover:border-red-500"
          }`}
        >
          Denied
        </button>
        <button
          onClick={() => setSelected("partial")}
          className={`min-h-[44px] px-4 py-2 rounded-lg font-medium text-sm transition-colors border ${
            selected === "partial"
              ? "bg-yellow-600 text-white border-yellow-600"
              : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border)] hover:border-yellow-500"
          }`}
        >
          Partially Approved
        </button>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!selected}
        >
          Submit
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Skip
        </Button>
      </div>
    </div>
  );
}
