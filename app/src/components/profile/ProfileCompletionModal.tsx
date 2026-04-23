"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * ProfileCompletionModal
 *
 * Foundation Stage 1.C — post-verification birth_year capture.
 *
 * Shown once per session when the authenticated user has a null
 * `birthYear` (design doc v1.3 Part 2 — soft gate). Dismissible with
 * "Remind me later" — no persisted dismiss state. On save, calls
 * PATCH /api/profile and closes on success; parent prevents re-open
 * for the remainder of the session.
 */

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;

export function ProfileCompletionModal({
  isOpen,
  onClose,
}: ProfileCompletionModalProps) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Early return unmounts the component when closed, so state is fresh
  // on next open — no reset effect needed.
  if (!isOpen) return null;

  function validate(value: string): { ok: true; year: number } | { ok: false; error: string } {
    const trimmed = value.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      return { ok: false, error: "Please enter a 4-digit year." };
    }
    const year = parseInt(trimmed, 10);
    if (year < MIN_YEAR || year > CURRENT_YEAR) {
      return { ok: false, error: `Year must be between ${MIN_YEAR} and ${CURRENT_YEAR}.` };
    }
    return { ok: true, year };
  }

  async function handleSave() {
    const result = validate(input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birth_year: result.year }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? "We couldn't save that. Please try again.");
        setSubmitting(false);
        return;
      }
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !submitting) {
      handleSave();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border border-[var(--border)]">
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Help us tailor your experience
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            We use your birth year to personalize Medicare coverage guidance and
            relevant health insights.
          </p>

          <div>
            <label
              htmlFor="birth-year"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-2"
            >
              Birth year
            </label>
            <input
              id="birth-year"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={input}
              onChange={(e) => {
                setInput(e.target.value.replace(/\D/g, ""));
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="YYYY"
              disabled={submitting}
              autoFocus
              className={cn(
                "w-full px-4 py-3 rounded-xl text-lg",
                "bg-[var(--bg-primary)] border text-[var(--text-primary)]",
                "placeholder-[var(--text-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                error
                  ? "border-red-500/60"
                  : "border-[var(--border)] focus:border-[var(--accent-primary)]",
              )}
            />
            {error && (
              <p
                role="alert"
                className="mt-2 text-sm font-medium text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            >
              Remind me later
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || input.length === 0}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-semibold",
                "bg-[var(--accent-primary)] text-white",
                "hover:opacity-90",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-opacity",
              )}
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileCompletionModal;
