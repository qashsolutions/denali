"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

interface PasskeyChallengeModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  reason?: string;
}

export function PasskeyChallengeModal({
  open,
  onClose,
  onVerified,
  reason = "This action requires additional verification.",
}: PasskeyChallengeModalProps) {
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleVerify = async () => {
    setStatus("verifying");
    setError(null);

    try {
      const supabase = createClient();

      // List factors to find WebAuthn
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const webauthnFactor = factors?.all?.find(
        (f) => f.factor_type === "webauthn" && f.status === "verified"
      );

      if (!webauthnFactor) {
        setError("No passkey found. Please enroll a passkey first.");
        setStatus("error");
        return;
      }

      // Challenge
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: webauthnFactor.id });

      if (challengeError) {
        setError(challengeError.message);
        setStatus("error");
        return;
      }

      // Verify
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: webauthnFactor.id,
        challengeId: challenge.id,
        code: "", // WebAuthn handles the code internally
      });

      if (verifyError) {
        setError(verifyError.message);
        setStatus("error");
        return;
      }

      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Verify Your Identity
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {reason}
        </p>

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
            onClick={handleVerify}
            disabled={status === "verifying"}
            className="flex-1 py-2.5 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium disabled:opacity-50"
          >
            {status === "verifying" ? "Verifying..." : "Verify with Passkey"}
          </button>
        </div>
      </div>
    </div>
  );
}
