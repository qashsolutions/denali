"use client";

import type { LandingSection } from "@/types/cms";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { PriorAuthIllustration } from "./illustrations/PriorAuthIllustration";
import { CoverageCheckIllustration } from "./illustrations/CoverageCheckIllustration";
import { AppealIllustration } from "./illustrations/AppealIllustration";

interface LandingFeaturesProps {
  section: LandingSection | undefined;
}

const FEATURES = [
  {
    step: "01",
    audience: "FOR PROVIDERS",
    title: "File Prior Authorization",
    description:
      "Know before you go. We check if your procedure needs pre-approval and walk your doctor through every requirement so nothing gets rejected.",
    tags: ["CPT/ICD-10", "CMS-1500", "Live Tracking"],
    color: "auth-blue" as const,
    Illustration: PriorAuthIllustration,
  },
  {
    step: "02",
    audience: "FOR EVERYONE",
    title: "Check Coverage Requirements",
    description:
      "Plain-English guidance on what Medicare covers and what your doctor needs to document. No codes, no jargon — just a clear checklist.",
    tags: ["NCD/LCD", "Part A & B", "Plain Language"],
    color: "check-teal" as const,
    Illustration: CoverageCheckIllustration,
  },
  {
    step: "03",
    audience: "WHEN DENIED",
    title: "Appeal a Denial",
    description:
      "Denied? We look up exactly why, build your appeal letter with the right codes and citations, and track your deadline so you never miss it.",
    tags: ["5 Appeal Levels", "Auto-Templates", "Deadline Alerts"],
    color: "appeal-coral" as const,
    Illustration: AppealIllustration,
  },
] as const;

const COLOR_CLASSES = {
  "auth-blue": {
    accent: "var(--auth-blue)",
    accentLight: "var(--auth-blue-light)",
    bg: "bg-[var(--auth-blue-bg)]",
    text: "text-[var(--auth-blue)]",
    tagBg: "bg-[var(--auth-blue)]/10",
    barFrom: "from-[var(--auth-blue)]",
    barTo: "to-[var(--auth-blue-light)]",
  },
  "check-teal": {
    accent: "var(--check-teal)",
    accentLight: "var(--check-teal-light)",
    bg: "bg-[var(--check-teal-bg)]",
    text: "text-[var(--check-teal)]",
    tagBg: "bg-[var(--check-teal)]/10",
    barFrom: "from-[var(--check-teal)]",
    barTo: "to-[var(--check-teal-light)]",
  },
  "appeal-coral": {
    accent: "var(--appeal-coral)",
    accentLight: "var(--appeal-coral-light)",
    bg: "bg-[var(--appeal-coral-bg)]",
    text: "text-[var(--appeal-coral)]",
    tagBg: "bg-[var(--appeal-coral)]/10",
    barFrom: "from-[var(--appeal-coral)]",
    barTo: "to-[var(--appeal-coral-light)]",
  },
};

const SECTION_WORDS = [
  { text: "Authorize.", color: "var(--auth-blue)" },
  { text: "Verify.", color: "var(--check-teal)" },
  { text: "Appeal.", color: "var(--appeal-coral)" },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[number];
  index: number;
}) {
  const { ref, isVisible } = useIntersectionObserver();
  const colors = COLOR_CLASSES[feature.color];
  const { Illustration } = feature;

  return (
    <article
      ref={ref}
      className={`group relative bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] overflow-hidden
        transition-all duration-600 ease-out
        hover:-translate-y-1 hover:shadow-xl
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Accent bar */}
      <div
        className={`h-1 bg-gradient-to-r ${colors.barFrom} ${colors.barTo}`}
      />

      {/* Illustration area */}
      <div className={`${colors.bg} flex items-center justify-center py-8`}>
        <Illustration className="w-full max-w-[240px] h-auto" />
      </div>

      {/* Content area */}
      <div className="p-6">
        {/* Step + audience */}
        <p className="font-mono text-xs tracking-wider text-[var(--text-muted)] mb-2">
          {feature.step} — {feature.audience}
        </p>

        {/* Title */}
        <h3 className="font-[var(--font-serif)] text-xl font-semibold text-[var(--text-primary)] mb-3">
          {feature.title}
        </h3>

        {/* Description */}
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">
          {feature.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {feature.tags.map((tag) => (
            <span
              key={tag}
              className={`${colors.text} ${colors.tagBg} text-xs font-medium rounded-full px-3 py-1`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function LandingFeatures({ section: _section }: LandingFeaturesProps) {
  return (
    <section className="py-16 sm:py-24 bg-[var(--bg-secondary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
            {SECTION_WORDS.map((word, i) => (
              <span key={i}>
                <span
                  className="font-[var(--font-serif)]"
                  style={{ color: word.color }}
                >
                  {word.text}
                </span>
                {i < SECTION_WORDS.length - 1 && " "}
              </span>
            ))}
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            From pre-approval to appeal, we make sure Medicare works for you.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.step} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
