"use client";

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
    description:
      "Track screenings, medications, and A1C over time. Personalized guidance when appropriate — direction to your doctor when needed.",
    tags: ["A1C Tracking", "Screenings", "Med Reminders", "Coverage"],
    href: "/app/chat?topic=diabetes",
    Illustration: DiabetesCareIllustration,
  },
  {
    step: "02",
    audience: "WEIGHT MANAGEMENT",
    title: "Obesity Care",
    description:
      "Navigate obesity coverage — GLP-1s, bariatric surgery, nutrition counseling. Know what Medicare covers before you go.",
    tags: ["GLP-1s", "Bariatric", "Counseling", "Coverage"],
    href: "/app/chat?topic=obesity",
    Illustration: WeightManagementIllustration,
  },
  {
    step: "03",
    audience: "YOUR MEDICARE",
    title: "Claims & Appeals",
    description:
      "Claims, coverage, and providers in one place. Denied? We help build the appeal letter with the right codes and citations.",
    tags: ["Claims", "Coverage Check", "Appeal Letters"],
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
      {/* Illustration area */}
      <div className="bg-[var(--bg-tertiary)] flex items-center justify-center py-8">
        <Illustration className="w-full max-w-[240px] h-auto" />
      </div>

      {/* Content area */}
      <div className="p-6">
        {/* Step + audience */}
        <p className="font-[var(--font-mono)] text-[11px] tracking-[0.1em] uppercase text-[var(--text-muted)] mb-2">
          {feature.step} — {feature.audience}
        </p>

        {/* Title */}
        <h3 className="font-[var(--font-serif)] text-xl font-normal text-[var(--text-primary)] mb-3">
          {feature.title}
        </h3>

        {/* Description */}
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">
          {feature.description}
        </p>

        {/* Tags — monochromatic */}
        <div className="flex flex-wrap gap-2">
          {feature.tags.map((tag) => (
            <span
              key={tag}
              className="text-[var(--text-muted)] bg-[var(--bg-tertiary)] text-xs font-medium rounded-full px-3 py-1"
            >
              {tag}
            </span>
          ))}
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.step} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
