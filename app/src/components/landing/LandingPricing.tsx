import Link from "next/link";
import { CheckIcon, ArrowRightIcon } from "../icons";
import { formatPrice, getBillingLabel } from "@/lib/cms";
import type { PricingPlan } from "@/types/cms";

interface LandingPricingProps {
  plans: PricingPlan[];
}

export function LandingPricing({ plans }: LandingPricingProps) {
  if (!plans || plans.length === 0) return null;

  return (
    <section className="py-16 sm:py-24 bg-[var(--bg-secondary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--text-primary)] mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Coverage guidance is always free. Only pay when you need appeal
            letters.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-[var(--bg-primary)] rounded-2xl p-6 sm:p-8 border transition-all ${
                plan.is_popular
                  ? "border-[var(--accent-primary)] shadow-xl shadow-[var(--accent-primary)]/10 scale-[1.02] md:scale-105"
                  : "border-[var(--border)] hover:border-[var(--accent-primary)]/50"
              }`}
            >
              {/* Popular Badge */}
              {plan.is_popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white text-sm font-semibold">
                  Most Popular
                </div>
              )}

              {/* Plan Name */}
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2 mt-2">
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mb-6">
                <span className="text-4xl font-bold text-[var(--text-primary)]">
                  {formatPrice(plan.price_cents)}
                </span>
                <span className="text-[var(--text-muted)] ml-1">
                  {getBillingLabel(plan.billing_period)}
                </span>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {Array.isArray(plan.features) &&
                  plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckIcon className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" />
                      <span className="text-[var(--text-secondary)]">
                        {feature}
                      </span>
                    </li>
                  ))}
              </ul>

              {/* CTA Button */}
              <Link
                href="/chat"
                className={`group w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
                  plan.is_popular
                    ? "bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white hover:shadow-lg hover:shadow-[var(--accent-primary)]/25"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)]"
                }`}
              >
                {plan.price_cents === 0
                  ? "Start Free"
                  : plan.billing_period === "monthly"
                    ? "Subscribe"
                    : "Get Started"}
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          ))}
        </div>

        {/* Note */}
        <p className="text-center text-sm text-[var(--text-muted)] mt-8">
          All plans include unlimited coverage guidance and Medicare policy
          lookups.
        </p>
      </div>
    </section>
  );
}
