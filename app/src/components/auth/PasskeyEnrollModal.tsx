"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

interface PasskeyEnrollModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PasskeyEnrollModal({ open, onClose, onSuccess }: PasskeyEnrollModalProps) {
  const [status, setStatus] = useState<"idle" | "enrolling" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleEnroll = async () => {
    setStatus("enrolling");
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "webauthn",
      });

      if (enrollError) {
        setError(enrollError.message);
        setStatus("error");
        return;
      }

      if (data) {
        setStatus("success");
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll passkey");
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Set Up Passkey
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Add a passkey for stronger security. Your device will prompt you to
          verify with Face ID, Touch ID, or your device PIN.
        </p>

        {status === "success" ? (
          <div className="text-center py-4">
            <p className="text-sm text-green-600 font-medium mb-4">
              Passkey enrolled successfully
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {error && (
              <p className="text-sm text-red-500 mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleEnroll}
                disabled={status === "enrolling"}
                className="flex-1 py-2.5 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium disabled:opacity-50"
              >
                {status === "enrolling" ? "Setting up..." : "Set Up Passkey"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
