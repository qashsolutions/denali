"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PRICING, formatPrice } from "@/config";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appealCount: number;
}

type PlanType = "single" | "unlimited";

/**
 * PaywallModal Component
 *
 * Shows pricing options for appeal letters.
 * Prices are configured via PRICING config.
 */
export function PaywallModal({
  isOpen,
  onClose,
  onSuccess,
  appealCount,
}: PaywallModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("single");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Create checkout session
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: selectedPlan,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout session");
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        // For development/testing, simulate success
        console.log("[DEV] Would redirect to Stripe checkout");
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setIsProcessing(false);
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
      <div className="relative z-10 w-full max-w-lg mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-slate-700/50 bg-gradient-to-r from-blue-600/10 to-violet-600/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 transition-colors"
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

          <h2 className="text-xl font-semibold text-slate-100">
            Get Your Appeal Letter
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose how you&apos;d like to access appeal letters
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Free tier info */}
          {appealCount === 0 && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-green-400">First One Free!</p>
                  <p className="text-sm text-slate-400">
                    Your first appeal letter is on us
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Plan options */}
          <div className="space-y-3">
            {/* Single appeal option */}
            <button
              onClick={() => setSelectedPlan("single")}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-left transition-all",
                selectedPlan === "single"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">
                      Pay Per Appeal
                    </span>
                    {selectedPlan === "single" && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    One appeal letter, no commitment
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-100">
                    {formatPrice(PRICING.SINGLE_APPEAL.amount)}
                  </div>
                  <div className="text-xs text-slate-500">{PRICING.SINGLE_APPEAL.label}</div>
                </div>
              </div>
            </button>

            {/* Unlimited option */}
            <button
              onClick={() => setSelectedPlan("unlimited")}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-left transition-all relative",
                selectedPlan === "unlimited"
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
              )}
            >
              {/* Best value badge */}
              <div className="absolute -top-3 right-4">
                <span className="px-3 py-1 text-xs font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-full">
                  Best Value
                </span>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">
                      Unlimited
                    </span>
                    {selectedPlan === "unlimited" && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-violet-500/20 text-violet-400 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    Unlimited appeals, cancel anytime
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li className="flex items-center gap-2 text-xs text-slate-400">
                      <svg
                        className="w-3 h-3 text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Unlimited appeal letters
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-400">
                      <svg
                        className="w-3 h-3 text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Priority support
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-400">
                      <svg
                        className="w-3 h-3 text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Appeal tracking
                    </li>
                  </ul>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-100">
                    {formatPrice(PRICING.UNLIMITED_MONTHLY.amount)}
                  </div>
                  <div className="text-xs text-slate-500">/{PRICING.UNLIMITED_MONTHLY.label}</div>
                </div>
              </div>
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handlePurchase}
            disabled={isProcessing}
            className={cn(
              "w-full py-4 px-6 rounded-xl font-semibold transition-all",
              "bg-gradient-to-r from-blue-600 to-violet-600",
              "hover:from-blue-500 hover:to-violet-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "text-white"
            )}
          >
            {isProcessing ? (
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
                Processing...
              </span>
            ) : (
              <>
                {selectedPlan === "single"
                  ? `Pay ${formatPrice(PRICING.SINGLE_APPEAL.amount)} & Get Letter`
                  : `Subscribe for ${formatPrice(PRICING.UNLIMITED_MONTHLY.amount)}/month`}
              </>
            )}
          </button>

          {/* Security note */}
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Secure payment powered by Stripe</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaywallModal;
