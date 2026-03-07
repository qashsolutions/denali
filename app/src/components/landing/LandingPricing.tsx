import Link from "next/link";
import { CheckIcon, ArrowRightIcon } from "../icons";

interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  href: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free Trial",
    price: "$0",
    period: "14 days",
    features: [
      "10 messages per day, 1 day/week",
      "Coverage, diabetes & obesity guidance",
      "No appeal letters",
      "No credit card required",
    ],
    cta: "Try It Free",
    href: "/app/chat",
  },
  {
    name: "Starter",
    price: "$10",
    period: "/month",
    features: [
      "20 messages per day, 1 day/week",
      "1 appeal credit per month",
      "Appeal letters with citations",
      "Coverage, diabetes & obesity guidance",
    ],
    cta: "Get Started",
    href: "/app",
  },
  {
    name: "Plus",
    price: "$20",
    period: "/month",
    popular: true,
    features: [
      "20 messages per day, every day",
      "2 appeal credits per month",
      "Appeal letters with citations",
      "Email alerts for deadlines & denials",
    ],
    cta: "Subscribe",
    href: "/app",
  },
  {
    name: "Unlimited",
    price: "$60",
    period: "/month",
    features: [
      "Unlimited messages every day",
      "Unlimited appeal letters",
      "Email alerts for all Medicare updates",
      "No daily or weekly limits",
    ],
    cta: "Go Unlimited",
    href: "/app",
  },
];

export function LandingPricing() {
  return (
    <section className="py-24 sm:py-36">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="font-[var(--font-serif)] text-2xl sm:text-3xl lg:text-4xl font-normal text-[var(--text-primary)] mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Start with a free 14-day trial. Upgrade when you need appeal
            letters or more access.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-6xl mx-auto items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col bg-[var(--bg-secondary)] rounded-xl p-6 sm:p-8 border transition-colors ${
                plan.popular
                  ? "border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/30"
                  : "border-[var(--border)] hover:border-[var(--accent-primary)]/40"
              }`}
            >
              {/* Plan Name */}
              <h3 className="font-[var(--font-serif)] text-xl font-normal text-[var(--text-primary)] mb-2">
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mb-6">
                <span className="font-[var(--font-mono)] text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="font-[var(--font-mono)] text-sm text-[var(--text-muted)] ml-1">
                    {plan.period}
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckIcon className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                    <span className="text-[var(--text-primary)]">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Link
                href={plan.href}
                className={`group w-full flex items-center justify-center gap-2 py-3 mt-8 rounded-lg font-medium text-sm tracking-wide transition-colors ${
                  plan.popular
                    ? "bg-[var(--accent-primary)] text-white hover:opacity-90"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)]"
                }`}
              >
                {plan.cta}
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          ))}
        </div>

        {/* Note */}
        <p className="text-center text-sm text-[var(--text-muted)] mt-8">
          All plans include coverage guidance, diabetes & obesity support, and
          Medicare policy lookups. Plus and Unlimited plans include proactive email alerts. No credit card required for trial.
        </p>
      </div>
    </section>
  );
}
