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
    <section className="py-24 sm:py-36">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="font-[var(--font-serif)] text-2xl sm:text-3xl lg:text-4xl font-normal text-[var(--text-primary)] mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Start with a free 14-day trial. Only pay when you need more appeal
            letters.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col bg-[var(--bg-secondary)] rounded-xl p-6 sm:p-8 border border-[var(--border)] hover:border-[var(--accent-primary)]/40 transition-colors"
            >
              {/* Plan Name */}
              <h3 className="font-[var(--font-serif)] text-xl font-normal text-[var(--text-primary)] mb-2">
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mb-6">
                <span className="font-[var(--font-mono)] text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
                  {formatPrice(plan.price_cents)}
                </span>
                <span className="font-[var(--font-mono)] text-sm text-[var(--text-muted)] ml-1">
                  {getBillingLabel(plan.billing_period)}
                </span>
              </div>

              {/* Features */}
              <ul className="space-y-3 flex-1">
                {Array.isArray(plan.features) &&
                  plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckIcon className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                      <span className="text-[var(--text-secondary)]">
                        {feature}
                      </span>
                    </li>
                  ))}
              </ul>

              {/* CTA Button — pinned to bottom */}
              <Link
                href="/app"
                className="group w-full flex items-center justify-center gap-2 py-3 mt-8 rounded-lg font-medium text-sm tracking-wide transition-colors bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)]"
              >
                {plan.price_cents === 0
                  ? "Start Free Trial"
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
          All plans include coverage guidance and Medicare policy lookups. No
          credit card required for trial.
        </p>
      </div>
    </section>
  );
}
