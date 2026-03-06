"use client";

import Link from "next/link";
import type { LandingSection } from "@/types/cms";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

interface LandingHowItWorksProps {
  section: LandingSection | undefined;
}

const STEPS = [
  {
    number: "01",
    label: "Connect Medicare",
    hint: "Link your Medicare account",
    href: "/app/health",
  },
  {
    number: "02",
    label: "Ask Denali",
    hint: "Grounded analysis",
    href: "/app/chat",
  },
  {
    number: "03",
    label: "Appeal Denials",
    hint: "Auto-built letters with citations",
    href: "/app/chat",
  },
];

function StepNode({
  step,
  index,
}: {
  step: (typeof STEPS)[number];
  index: number;
}) {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <Link
        href={step.href}
        className="group flex flex-col items-center text-center transition-transform duration-300 ease-out hover:-translate-y-1"
      >
        {/* Monospace step number */}
        <span className="font-[var(--font-mono)] text-3xl sm:text-4xl font-semibold text-[var(--accent-primary)] mb-3 tracking-tight">
          {step.number}
        </span>

        {/* Serif label */}
        <p className="font-[var(--font-serif)] text-lg sm:text-xl font-normal text-[var(--text-primary)] mb-1">
          {step.label}
        </p>

        {/* Sans hint */}
        <p className="text-sm text-[var(--text-secondary)] max-w-[180px]">
          {step.hint}
        </p>
      </Link>
    </div>
  );
}

export function LandingHowItWorks({ section: _section }: LandingHowItWorksProps) {
  return (
    <section id="how-it-works" className="py-24 sm:py-36 bg-[var(--bg-secondary)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="font-[var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl font-normal text-[var(--text-primary)] mb-3">
            How It Works
          </h2>
          <p className="text-lg sm:text-xl text-[var(--text-secondary)]">
            Three steps. One app.
          </p>
        </div>

        {/* Typographic steps with separators */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-0">
          {STEPS.map((step, i) => (
            <div key={step.number} className="contents">
              <StepNode step={step} index={i} />
              {i < STEPS.length - 1 && (
                <>
                  {/* Desktop: vertical separator */}
                  <div className="hidden lg:block w-px h-16 bg-[var(--border)] mx-12" />
                  {/* Mobile: horizontal separator */}
                  <div className="lg:hidden w-12 h-px bg-[var(--border)]" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
