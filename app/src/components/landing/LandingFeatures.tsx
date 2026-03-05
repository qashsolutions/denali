"use client";

/* Feature cards — text on top, UI mockup illustrations below */
import Link from "next/link";
import type { LandingSection } from "@/types/cms";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { DiabetesCareIllustration } from "./illustrations/DiabetesCareIllustration";
import { WeightManagementIllustration } from "./illustrations/WeightManagementIllustration";
import { HealthRecordsIllustration } from "./illustrations/HealthRecordsIllustration";

interface LandingFeaturesProps {
  section: LandingSection | undefined;
}

const FEATURES = [
  {
    step: "01",
    audience: "DIABETES",
    title: "Diabetes Care",
    kicker: "Track A1C over time.",
    href: "/app/chat?topic=diabetes",
    Illustration: DiabetesCareIllustration,
  },
  {
    step: "02",
    audience: "WEIGHT MANAGEMENT",
    title: "Obesity Care",
    kicker: "Know your coverage options.",
    href: "/app/chat?topic=obesity",
    Illustration: WeightManagementIllustration,
  },
  {
    step: "03",
    audience: "YOUR MEDICARE",
    title: "Claims & Appeals",
    kicker: "Fight denials with evidence.",
    href: "/app/health",
    Illustration: HealthRecordsIllustration,
  },
] as const;

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[number];
  index: number;
}) {
  const { ref, isVisible } = useIntersectionObserver();
  const { Illustration } = feature;

  return (
    <div
      ref={ref}
      className={`transition-all duration-600 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
    <Link
      href={feature.href}
      className="group relative block bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] overflow-hidden
        transition-colors duration-300 ease-out
        hover:border-[var(--accent-primary)]/40"
    >
      {/* Content area — text on top */}
      <div className="p-8 pb-4 text-center">
        {/* Step label */}
        <p className="font-[var(--font-mono)] text-2xl font-bold tracking-[0.1em] uppercase text-[var(--accent-primary)] mb-3">
          {feature.step}
        </p>

        {/* Title */}
        <h3 className="font-[var(--font-serif)] text-2xl sm:text-3xl font-normal text-[var(--text-primary)] mb-2">
          {feature.title}
        </h3>

        {/* Kicker */}
        <p className="text-[var(--text-primary)] text-base">
          {feature.kicker}
        </p>
      </div>

      {/* Illustration area — below text */}
      <div className="bg-[var(--bg-tertiary)] flex items-center justify-center py-12 sm:py-16 mx-4 mb-4 rounded-lg">
        <Illustration className="w-full max-w-[600px] h-auto px-4" />
      </div>
    </Link>
    </div>
  );
}

export function LandingFeatures({ section: _section }: LandingFeaturesProps) {
  return (
    <section className="py-24 sm:py-36 bg-[var(--bg-secondary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="font-[var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl font-normal text-[var(--text-primary)] mb-4">
            Personalized support for{" "}
            <span className="text-[var(--accent-primary)]">diabetes</span> and{" "}
            <span className="text-[var(--accent-primary)]">obesity</span>
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Tailored guidance with your Medicare data — direct assistance when appropriate, direction to your doctor when needed.
          </p>
        </div>

        {/* Features Grid — 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.step} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
