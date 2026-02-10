"use client";

import { HeartPulseIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";

interface ConnectMedicareProps {
  onConnect: () => void;
}

export function ConnectMedicare({ onConnect }: ConnectMedicareProps) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-8 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-[var(--health-red)]/15 flex items-center justify-center mx-auto mb-5">
        <HeartPulseIcon className="w-8 h-8 text-[var(--health-red)]" />
      </div>

      <h2 className="text-xl font-bold text-[var(--text-primary)] text-center mb-2">
        Connect Your Medicare
      </h2>
      <p className="text-[var(--text-secondary)] text-center mb-6 text-sm">
        See your claims, coverage, and health info in plain English.
        Your data stays private and encrypted.
      </p>

      <div className="flex flex-col gap-3 mb-6">
        {[
          { step: "1", text: "Sign in with your Medicare account" },
          { step: "2", text: "Approve read-only access to your data" },
          { step: "3", text: "See your claims and coverage here" },
        ].map(({ step, text }) => (
          <div
            key={step}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] text-left"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--health-red)]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[var(--health-red)] text-sm font-semibold">{step}</span>
            </div>
            <span className="text-sm text-[var(--text-secondary)]">{text}</span>
          </div>
        ))}
      </div>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={onConnect}
      >
        Connect Medicare
      </Button>

      <p className="text-xs text-[var(--text-muted)] text-center mt-4">
        Powered by the official Medicare API. We only read your data — we never modify it.
      </p>
    </div>
  );
}
