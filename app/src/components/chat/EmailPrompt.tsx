"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface EmailPromptProps {
  existingEmail?: string | null;
  onConfirm: (email: string) => void;
  onCancel: () => void;
}

/**
 * Prompt for email collection or confirmation
 */
export function EmailPrompt({
  existingEmail,
  onConfirm,
  onCancel,
}: EmailPromptProps) {
  const [email, setEmail] = useState(existingEmail || "");
  const [error, setError] = useState("");

  const isConfirmMode = !!existingEmail;

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSubmit = () => {
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }
    onConfirm(email);
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)] mt-4">
      <h3 className="text-[var(--text-primary)] font-medium mb-2">
        {isConfirmMode ? "Confirm your email" : "Enter your email"}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        {isConfirmMode
          ? `We'll send the checklist to ${existingEmail}. Is this correct?`
          : "We'll send the checklist to this email address."}
      </p>

      {!isConfirmMode || email !== existingEmail ? (
        <div className="mb-4">
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="your.email@example.com"
            error={error}
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        {isConfirmMode && email === existingEmail ? (
          <>
            <Button variant="primary" onClick={() => onConfirm(email)}>
              Yes, send it
            </Button>
            <Button
              variant="secondary"
              onClick={() => setEmail("")}
            >
              Use different email
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={handleSubmit}>
              {isConfirmMode ? "Send to this email" : "Send"}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
