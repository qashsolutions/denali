"use client";

import Link from "next/link";
import type { LandingSection } from "@/types/cms";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import {
  HeartPulseIcon,
  ChatBubbleIcon,
  DiabetesIcon,
  ClaimsIcon,
} from "../icons";

interface LandingHowItWorksProps {
  section: LandingSection | undefined;
}

const STEPS = [
  {
    step: 1,
    label: "Connect Medicare",
    hint: "Link your Medicare account",
    Icon: HeartPulseIcon,
    color: "var(--accent-primary)",
    colorLight: "#60a5fa",
    href: "/app/health",
  },
  {
    step: 2,
    label: "Ask Denali",
    hint: "Coverage questions in plain English",
    Icon: ChatBubbleIcon,
    color: "var(--accent-primary)",
    colorLight: "#60a5fa",
    href: "/app/chat",
  },
  {
    step: 3,
    label: "Track Diabetes",
    hint: "A1C trends, screenings, reminders",
    Icon: DiabetesIcon,
    color: "var(--accent-primary)",
    colorLight: "#60a5fa",
    href: "/app/diabetes",
  },
  {
    step: 4,
    label: "Appeal Denials",
    hint: "Auto-built letters with citations",
    Icon: ClaimsIcon,
    color: "var(--accent-primary)",
    colorLight: "#60a5fa",
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
  const { Icon } = step;

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <Link
        href={step.href}
        className="group flex flex-col items-center text-center"
      >
        {/* Circle with icon */}
        <div
          className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-105 shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${step.color}, ${step.colorLight})`,
            boxShadow: `0 8px 24px ${step.color}33`,
          }}
        >
          <Icon className="w-9 h-9 sm:w-10 sm:h-10 text-white" />
          {/* Step number badge */}
          <span
            className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[var(--bg-primary)] border-2 flex items-center justify-center text-xs font-bold text-[var(--text-primary)]"
            style={{ borderColor: step.color }}
          >
            {step.step}
          </span>
        </div>

        {/* Label */}
        <p className="text-base sm:text-lg font-semibold text-[var(--text-primary)] mb-1">
          {step.label}
        </p>
        {/* Hint */}
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-[160px]">
          {step.hint}
        </p>
      </Link>
    </div>
  );
}

/* Arrow between steps — desktop only */
function FlowArrow({ color }: { color: string }) {
  return (
    <div className="hidden lg:flex items-center justify-center self-start mt-10 sm:mt-12 -mx-2">
      <svg
        width="40"
        height="16"
        viewBox="0 0 40 16"
        fill="none"
        className="opacity-50"
      >
        <path
          d="M0 8h32m0 0l-6-6m6 6l-6 6"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function LandingHowItWorks({ section: _section }: LandingHowItWorksProps) {
  return (
    <section id="how-it-works" className="py-20 sm:py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--text-primary)] mb-3">
            How It Works
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            Four tools, one app. Start anywhere.
          </p>
        </div>

        {/* Visual Flow — horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-0">
          {STEPS.map((step, i) => (
            <div key={step.step} className="contents">
              <StepNode step={step} index={i} />
              {i < STEPS.length - 1 && (
                <>
                  {/* Desktop arrow */}
                  <FlowArrow color={STEPS[i + 1].color} />
                  {/* Mobile down arrow */}
                  <div className="lg:hidden flex justify-center">
                    <svg
                      width="16"
                      height="28"
                      viewBox="0 0 16 28"
                      fill="none"
                      className="opacity-30"
                    >
                      <path
                        d="M8 0v20m0 0l-6-6m6 6l6-6"
                        stroke="var(--text-tertiary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Subtle helper */}
        <p className="text-center text-xs text-[var(--text-muted)] mt-10">
          No medical codes. No jargon. Just plain English.
        </p>
      </div>
    </section>
  );
}
