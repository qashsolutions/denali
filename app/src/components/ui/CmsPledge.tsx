"use client";

import { useState } from "react";

const PLEDGES = {
  ai: {
    label: "CMS Health AI Pledge",
    title: "Conversational AI Assistant",
    text: "COMPANY PLEDGE: We pledge to build conversational AI assistants that connect to CMS Aligned Networks or personal health record apps, and with patient consent, securely access relevant health information and use this information to deliver personalized, helpful support. Our tools will clearly distinguish educational content from clinical guidance, assist patients directly when appropriate and guide them to care from a health professional when needed.",
  },
  diabetes: {
    label: "CMS Health AI Pledge",
    title: "Diabetes & Obesity",
    text: "COMPANY PLEDGE: We pledge to connect to CMS Aligned Networks or personal health apps and, with patient consent, securely access relevant health data to deliver personalized support. Our diabetes and obesity tools will use this history to provide tailored guidance\u2014offering direct assistance when appropriate and directing patients to care from a health professional when needed.",
  },
} as const;

type PledgeType = keyof typeof PLEDGES;

export function CmsPledge({ type }: { type: PledgeType }) {
  const [open, setOpen] = useState(false);
  const pledge = PLEDGES[type];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <InfoIcon className="w-3.5 h-3.5" />
        <span>{pledge.label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Sheet */}
          <div
            className="relative w-full sm:max-w-lg mx-auto bg-[var(--bg-primary)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-[var(--text-muted)]/30" />
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    {pledge.title}
                  </p>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {pledge.label}
                  </h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 -mr-2 -mt-1 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                  aria-label="Close"
                >
                  <CloseIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                </button>
              </div>

              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {pledge.text}
              </p>

              <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)]">
                  Required by the Centers for Medicare & Medicaid Services (CMS)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
