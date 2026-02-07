"use client";

import type { LandingSection } from "@/types/cms";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { HealthRecordsIllustration } from "./illustrations/HealthRecordsIllustration";
import { CoverageCheckIllustration } from "./illustrations/CoverageCheckIllustration";
import { DiabetesCareIllustration } from "./illustrations/DiabetesCareIllustration";
import { AppealIllustration } from "./illustrations/AppealIllustration";

interface LandingFeaturesProps {
  section: LandingSection | undefined;
}

const FEATURES = [
  {
    step: "01",
    audience: "FOR EVERYONE",
    title: "Health Records in Plain English",
    description:
      "Connect your clinic or Medicare.gov and see your conditions, medications, and lab results explained in words you understand.",
    tags: ["EHR Connect", "Blue Button 2.0", "Plain Language"],
    color: "health-red" as const,
    Illustration: HealthRecordsIllustration,
  },
  {
    step: "02",
    audience: "FOR EVERYONE",
    title: "AI Health Assistant",
    description:
      "Ask anything about Medicare coverage. Get a clear checklist of what your doctor needs to document so your claim gets approved.",
    tags: ["NCD/LCD", "Part A & B", "Coverage Check"],
    color: "check-teal" as const,
    Illustration: CoverageCheckIllustration,
  },
  {
    step: "03",
    audience: "PREVENTION",
    title: "Diabetes & Prevention Coaching",
    description:
      "Personalized coaching from your own A1C and glucose results. Track trends, get reminders, and stay ahead of diabetes.",
    tags: ["A1C Tracking", "Med Reminders", "MDPP"],
    color: "diabetes-violet" as const,
    Illustration: DiabetesCareIllustration,
  },
  {
    step: "04",
    audience: "WHEN DENIED",
    title: "Claims & Appeals That Work",
    description:
      "Denied? We look up exactly why, build your appeal letter with the right codes and citations, and track your deadline so you never miss it.",
    tags: ["5 Appeal Levels", "Auto-Templates", "Deadline Alerts"],
    color: "appeal-coral" as const,
    Illustration: AppealIllustration,
  },
] as const;

const COLOR_CLASSES = {
  "health-red": {
    accent: "var(--health-red)",
    accentLight: "var(--health-red-light)",
    bg: "bg-[var(--health-red-bg)]",
    text: "text-[var(--health-red)]",
    tagBg: "bg-[var(--health-red)]/10",
    barFrom: "from-[var(--health-red)]",
    barTo: "to-[var(--health-red-light)]",
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
  "diabetes-violet": {
    accent: "var(--diabetes-violet)",
    accentLight: "var(--diabetes-violet-light)",
    bg: "bg-[var(--diabetes-violet-bg)]",
    text: "text-[var(--diabetes-violet)]",
    tagBg: "bg-[var(--diabetes-violet)]/10",
    barFrom: "from-[var(--diabetes-violet)]",
    barTo: "to-[var(--diabetes-violet-light)]",
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
  { text: "Connect.", color: "var(--health-red)" },
  { text: "Understand.", color: "var(--check-teal)" },
  { text: "Prevent.", color: "var(--diabetes-violet)" },
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
            Your complete Medicare health companion — from records to prevention
            to appeals.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.step} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
