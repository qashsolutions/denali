"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PRICING, formatPrice } from "@/config";
import { SYSTEM } from "@/config/messages";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appealCount: number;
  trialExpired?: boolean;
}

type PlanType = "starter" | "plus" | "unlimited";

const PLAN_OPTIONS: {
  key: PlanType;
  name: string;
  price: number;
  label: string;
  description: string;
  features: string[];
  badge?: string;
  accent?: string;
}[] = [
  {
    key: "starter",
    name: "Starter",
    price: PRICING.STARTER.amount,
    label: PRICING.STARTER.label,
    description: "20 msgs/day, 1 day/week",
    features: [
      "1 appeal credit per month",
      "20 messages per day",
      "1 chat day per week",
    ],
  },
  {
    key: "plus",
    name: "Plus",
    price: PRICING.PLUS.amount,
    label: PRICING.PLUS.label,
    description: "20 msgs/day, every day",
    badge: "Most Popular",
    accent: "violet",
    features: [
      "2 appeal credits per month",
      "20 messages per day",
      "Chat every day",
    ],
  },
  {
    key: "unlimited",
    name: "Unlimited",
    price: PRICING.UNLIMITED.amount,
    label: PRICING.UNLIMITED.label,
    description: "Unlimited everything",
    features: [
      "Unlimited appeal letters",
      "Unlimited messages",
      "Chat every day",
    ],
  },
];

/**
 * PaywallModal Component
 *
 * Shows 3 subscription plan options.
 * Prices are configured via PRICING config.
 */
export function PaywallModal({
  isOpen,
  onClose,
  onSuccess,
  appealCount,
  trialExpired,
}: PaywallModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("plus");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || SYSTEM.CHECKOUT_FAILED);
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error(SYSTEM.CHECKOUT_FAILED);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : SYSTEM.GENERIC_ERROR);
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const selected = PLAN_OPTIONS.find((p) => p.key === selectedPlan)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-[var(--bg-primary)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-[var(--border)]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
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

          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Choose Your Plan
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Unlock appeal letters and more daily messages
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Trial expired banner */}
          {trialExpired && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                Your free trial has ended
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Choose a plan to continue using Denali.
              </p>
            </div>
          )}

          {/* Plan options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLAN_OPTIONS.map((plan) => {
              const isSelected = selectedPlan === plan.key;
              const isPopular = plan.badge;
              return (
                <button
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all relative",
                    isSelected
                      ? isPopular
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)]"
                  )}
                >
                  {isPopular && (
                    <span className="absolute -top-2.5 left-3 px-2 py-0.5 text-xs font-medium bg-violet-500 text-white rounded-full">
                      {plan.badge}
                    </span>
                  )}
                  <div className="text-2xl font-bold text-[var(--text-primary)]">
                    {formatPrice(plan.price)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">/{plan.label}</div>
                  <div className="font-semibold text-sm text-[var(--text-primary)] mt-2">
                    {plan.name}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {plan.description}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <svg
                          className="w-3 h-3 text-green-500 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
              <>Subscribe to {selected.name} &mdash; {formatPrice(selected.price)}/mo</>
            )}
          </button>

          {/* Security note */}
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
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
