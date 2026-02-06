"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TOTPEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrolled: () => void;
  onSkip: () => void;
  enrollTOTP: () => Promise<{ qrCode: string; secret: string } | null>;
  challengeAndVerifyTOTP: (code: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

type Step = "intro" | "qr" | "verify";

export function TOTPEnrollModal({
  isOpen,
  onClose,
  onEnrolled,
  onSkip,
  enrollTOTP,
  challengeAndVerifyTOTP,
  isLoading,
  error,
  clearError,
}: TOTPEnrollModalProps) {
  const [step, setStep] = useState<Step>("intro");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [showSecret, setShowSecret] = useState(false);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep("intro");
      setQrCode("");
      setSecret("");
      setCode(["", "", "", "", "", ""]);
      setShowSecret(false);
      clearError();
    }
  }, [isOpen, clearError]);

  const handleSetup = async () => {
    const result = await enrollTOTP();
    if (result) {
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setStep("qr");
    }
  };

  const handleScanned = () => {
    setStep("verify");
    setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
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

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) return;

    const success = await challengeAndVerifyTOTP(fullCode);
    if (success) {
      onEnrolled();
      onClose();
    }
  };

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.every((digit) => digit) && step === "verify") {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50">
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-xl font-semibold text-slate-100">
            {step === "intro"
              ? "Secure Your Account"
              : step === "qr"
                ? "Scan QR Code"
                : "Verify Authenticator"}
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

        <div className="p-6">
          {step === "intro" && (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-600/20 to-violet-600/20 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>

              <p className="text-slate-300 text-sm text-center">
                Set up an authenticator app for faster, more secure access next
                time. Works with Google Authenticator, Authy, or any TOTP app.
              </p>

              <button
                onClick={handleSetup}
                disabled={isLoading}
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
                    Setting up...
                  </span>
                ) : (
                  "Set Up Authenticator"
                )}
              </button>

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <button
                onClick={onSkip}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}

          {step === "qr" && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm text-center">
                Open your authenticator app and scan this QR code.
              </p>

              <div className="flex justify-center p-4 bg-white rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="TOTP QR Code"
                  className="w-48 h-48"
                />
              </div>

              <div className="text-center">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showSecret
                    ? "Hide manual code"
                    : "Can't scan? Enter code manually"}
                </button>
                {showSecret && (
                  <div className="mt-2 p-3 bg-slate-800 rounded-lg">
                    <code className="text-sm text-slate-200 break-all select-all">
                      {secret}
                    </code>
                  </div>
                )}
              </div>

              <button
                onClick={handleScanned}
                className={cn(
                  "w-full py-3 px-4 rounded-xl font-medium transition-all",
                  "bg-gradient-to-r from-blue-600 to-violet-600",
                  "hover:from-blue-500 hover:to-violet-500",
                  "text-white"
                )}
              >
                I&apos;ve scanned the code
              </button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm">
                Enter the 6-digit code from your authenticator app to finish
                setup.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Authenticator Code
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
                onClick={handleVerify}
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
                  "Complete Setup"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TOTPEnrollModal;
