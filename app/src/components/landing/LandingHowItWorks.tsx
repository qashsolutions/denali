import {
  ChatBubbleIcon,
  MagnifyingGlassIcon,
  ClipboardCheckIcon,
} from "../icons";
import type { LandingSection, HowItWorksStep } from "@/types/cms";

interface LandingHowItWorksProps {
  section: LandingSection | undefined;
}

export function LandingHowItWorks({ section }: LandingHowItWorksProps) {
  if (!section) return null;

  const steps = section.content as unknown as HowItWorksStep[];

  // Step icons
  const stepIcons = [ChatBubbleIcon, MagnifyingGlassIcon, ClipboardCheckIcon];

  return (
    <section id="how-it-works" className="py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {section.title}
          </h2>
          {section.subtitle && (
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
              {section.subtitle}
            </p>
          )}
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-24 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-[var(--accent-primary)] via-[var(--accent-secondary)] to-[var(--accent-primary)]" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            {Array.isArray(steps) &&
              steps.map((step, index) => {
                const IconComponent = stepIcons[index] || ChatBubbleIcon;

                return (
                  <div key={index} className="relative text-center">
                    {/* Step Number Badge */}
                    <div className="relative z-10 mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center mb-6 shadow-lg shadow-[var(--accent-primary)]/25">
                      <IconComponent className="w-9 h-9 text-white" />
                      {/* Step Number */}
                      <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[var(--bg-primary)] border-2 border-[var(--accent-primary)] flex items-center justify-center text-sm font-bold text-[var(--text-primary)]">
                        {step.step}
                      </span>
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
                      {step.title}
                    </h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                      {step.description}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </section>
  );
}
