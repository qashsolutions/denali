"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  alreadyAnswered: boolean;
}

/**
 * Pure fetch helper — extracted for testability.
 * Submits the Medicare yes/no answer to /api/profile.
 */
export async function submitMedicareAnswer(value: boolean): Promise<Response> {
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ is_on_medicare: value }),
  });
}

/**
 * Pure fetch helper — extracted for testability.
 * Touches /api/profile GET to heal the medicare_status cookie for
 * legacy sessions that never got it set by verify-otp.
 */
export async function healMedicareCookie(): Promise<Response | null> {
  try {
    return await fetch("/api/profile", { credentials: "include" });
  } catch {
    return null;
  }
}

export default function MedicareOnboardingForm({ alreadyAnswered }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the server-side DB check sees is_on_medicare is already set, the
  // browser may still be missing the medicare_status cookie (pre-gate
  // session). Touch /api/profile so its GET handler heals the cookie, then
  // redirect — subsequent /app navigation skips the gate.
  useEffect(() => {
    if (!alreadyAnswered) return;
    healMedicareCookie().finally(() => router.replace("/app/chat"));
  }, [alreadyAnswered, router]);

  async function handleAnswer(value: boolean) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitMedicareAnswer(value);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error || "Could not save your answer. Please try again.",
        );
      }
      router.replace("/app/chat");
    } catch (e) {
      setSubmitting(false);
      setError(
        e instanceof Error
          ? e.message
          : "Could not save your answer. Please try again.",
      );
    }
  }

  if (alreadyAnswered) return null;

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          One quick question
        </h1>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
          Are you enrolled in Medicare? This helps us give you the right
          information. You can change this anytime in Settings.
        </p>
        {error && (
          <div role="alert" className="text-sm text-red-600">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleAnswer(true)}
            disabled={submitting}
            className="w-full py-3 px-4 rounded-lg font-medium text-white bg-[var(--accent-primary)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Yes, I have Medicare
          </button>
          <button
            type="button"
            onClick={() => handleAnswer(false)}
            disabled={submitting}
            className="w-full py-3 px-4 rounded-lg font-medium border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
          >
            No, I don&apos;t have Medicare
          </button>
        </div>
      </div>
    </div>
  );
}
