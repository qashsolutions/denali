"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * ProfileCompletionModal
 *
 * Foundation Stage 1.C — birth-year capture with cadence cadence-aware
 * UX. Three actions:
 *   - Save: PATCH /api/profile { birth_year }, then close
 *   - Not now: POST /api/profile/birth-year-reminder/dismiss (7-day cooldown), then close
 *   - Don't show this again: POST /api/profile/birth-year-reminder/disable (permanent), then close
 *
 * Eligibility (whether the modal should be open) is determined
 * by the parent via canShowBirthYearModal() in lib/profile-cadence.
 * This component is a presentation layer that calls handler
 * props for the three actions; the parent owns the API calls
 * and any local fast-path dismiss state.
 */

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onSave: (birthYear: number) => Promise<void>;
  onDismiss: () => Promise<void>;
  onDisable: () => Promise<void>;
  onClose: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;

type ActiveAction = "save" | "dismiss" | "disable" | null;

export function ProfileCompletionModal({
  isOpen,
  onSave,
  onDismiss,
  onDisable,
  onClose,
}: ProfileCompletionModalProps) {
  const [input, setInput] = useState("");
  const [active, setActive] = useState<ActiveAction>(null);
  const [error, setError] = useState<string | null>(null);

  // Early return unmounts the component when closed, so state is fresh
  // on next open — no reset effect needed.
  if (!isOpen) return null;

  const submitting = active !== null;

  function validate(
    value: string,
  ): { ok: true; year: number } | { ok: false; error: string } {
    const trimmed = value.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      return { ok: false, error: "Please enter a 4-digit year." };
    }
    const year = parseInt(trimmed, 10);
    if (year < MIN_YEAR || year > CURRENT_YEAR) {
      return {
        ok: false,
        error: `Year must be between ${MIN_YEAR} and ${CURRENT_YEAR}.`,
      };
    }
    return { ok: true, year };
  }

  async function handleSave() {
    const result = validate(input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setActive("save");
    setError(null);
    try {
      await onSave(result.year);
      onClose();
    } catch {
      setError("We couldn't save that. Please try again.");
      setActive(null);
    }
  }

  async function handleDismiss() {
    setActive("dismiss");
    setError(null);
    try {
      await onDismiss();
    } catch {
      // Don't block close on a failed dismiss write — the
      // session-only fast-path in the parent still closes the
      // modal, and the server state will be retried on next
      // page load (gate stays inert because user just clicked).
    }
    onClose();
  }

  async function handleDisable() {
    setActive("disable");
    setError(null);
    try {
      await onDisable();
    } catch {
      // Same rationale as handleDismiss.
    }
    onClose();
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
            A quick question to help us serve you better
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Could you share your year of birth? It helps us:
          </p>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1 list-disc pl-5">
            <li>Show Medicare information that&apos;s relevant to your age</li>
            <li>Tailor health guidance appropriately</li>
          </ul>
          <p className="text-xs text-[var(--text-muted)] italic">
            Year only — we don&apos;t ask for month or day.
          </p>

          <div>
            <label
              htmlFor="birth-year"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-2"
            >
              Year of birth
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
              placeholder="e.g., 1953"
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
              onClick={handleDisable}
              disabled={submitting}
              className={cn(
                "px-3 py-2 rounded-xl text-sm font-medium",
                "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                "hover:underline",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            >
              {active === "disable" ? "Saving..." : "Don't show this again"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={submitting}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "border border-[var(--border)] hover:bg-[var(--bg-tertiary)]",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            >
              {active === "dismiss" ? "Saving..." : "Not now"}
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
              {active === "save" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileCompletionModal;
