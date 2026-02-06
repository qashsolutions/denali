"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface EmailOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  sendEmailOTP: (email: string) => Promise<boolean>;
  verifyEmailOTP: (email: string, code: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

type Step = "email" | "code";

export function EmailOTPModal({
  isOpen,
  onClose,
  onVerified,
  sendEmailOTP,
  verifyEmailOTP,
  isLoading,
  error,
  clearError,
}: EmailOTPModalProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("email");
      setEmail("");
      setCode(["", "", "", "", "", ""]);
      clearError();
    }
  }, [isOpen, clearError]);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSendCode = async () => {
    if (!isValidEmail(email)) return;

    const success = await sendEmailOTP(email);
    if (success) {
      setStep("code");
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6);
      const newCode = [...code];
      for (let i = 0; i < digits.length; i++) {
        if (index + i < 6) {
          newCode[index + i] = digits[i];
        }
      }
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      codeInputRefs.current[nextIndex]?.focus();
    } else {
      const newCode = [...code];
      newCode[index] = value.replace(/\D/g, "");
      setCode(newCode);
      if (value && index < 5) {
        codeInputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) return;

    const success = await verifyEmailOTP(email, fullCode);
    if (success) {
      onVerified();
      onClose();
    }
  };

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.every((digit) => digit) && step === "code") {
      handleVerifyCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step === "email" && isValidEmail(email) && !isLoading) {
      handleSendCode();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-xl font-semibold text-slate-100">
            {step === "email" ? "Verify Your Email" : "Enter Code"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "email" ? (
            <div className="space-y-4" onKeyDown={handleKeyDown}>
              <p className="text-slate-300 text-sm">
                Enter your email to receive a verification code. This helps us
                keep your appeal letters secure.
              </p>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-400 mb-2"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={cn(
                    "w-full px-4 py-3 bg-slate-800 border rounded-xl text-slate-100 placeholder-slate-500",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500",
                    "transition-all text-lg",
                    error ? "border-red-500/50" : "border-slate-600"
                  )}
                  autoFocus
                />
                {error && (
                  <p className="mt-2 text-sm text-red-400">{error}</p>
                )}
              </div>

              <button
                onClick={handleSendCode}
                disabled={!isValidEmail(email) || isLoading}
                className={cn(
                  "w-full py-3 px-4 rounded-xl font-medium transition-all",
                  "bg-gradient-to-r from-blue-600 to-violet-600",
                  "hover:from-blue-500 hover:to-violet-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "text-white"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  "Send Verification Code"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm">
                We sent a 6-digit code to{" "}
                <span className="text-slate-100 font-medium">{email}</span>
              </p>
              <p className="text-slate-400 text-xs">
                Check your inbox (and spam folder)
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Verification Code
                </label>
                <div className="flex gap-2 justify-center">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        codeInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      className={cn(
                        "w-12 h-14 text-center text-2xl font-semibold",
                        "bg-slate-800 border rounded-xl text-slate-100",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500",
                        "transition-all",
                        error ? "border-red-500/50" : "border-slate-600"
                      )}
                    />
                  ))}
                </div>
                {error && (
                  <p className="mt-2 text-sm text-red-400 text-center">
                    {error}
                  </p>
                )}
              </div>

              <button
                onClick={handleVerifyCode}
                disabled={code.join("").length !== 6 || isLoading}
                className={cn(
                  "w-full py-3 px-4 rounded-xl font-medium transition-all",
                  "bg-gradient-to-r from-blue-600 to-violet-600",
                  "hover:from-blue-500 hover:to-violet-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "text-white"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  "Verify"
                )}
              </button>

              <button
                onClick={() => {
                  setStep("email");
                  setCode(["", "", "", "", "", ""]);
                  clearError();
                }}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Didn&apos;t get the code? Send again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailOTPModal;
