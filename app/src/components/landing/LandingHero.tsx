import Link from "next/link";
import { ArrowRightIcon } from "../icons";
import type { LandingSection, HeroContent } from "@/types/cms";

interface LandingHeroProps {
  section: LandingSection | undefined;
}

export function LandingHero({ section }: LandingHeroProps) {
  if (!section) return null;

  const content = section.content as unknown as HeroContent;

  return (
    <section className="relative overflow-hidden bg-[var(--bg-primary)]">
      {/* Subtle mountain silhouette */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full pointer-events-none"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        style={{ height: "60%" }}
        aria-hidden="true"
      >
        <path
          d="M0,320 L0,220 Q120,180 240,200 Q360,220 420,160 Q480,100 560,120 Q640,140 720,80 Q800,20 880,60 Q960,100 1040,40 Q1120,0 1200,50 Q1280,100 1360,70 Q1400,55 1440,80 L1440,320 Z"
          fill="var(--border)"
          opacity="0.04"
        />
        <path
          d="M0,320 L0,260 Q180,230 300,250 Q420,270 520,200 Q620,130 720,170 Q820,210 920,140 Q1020,70 1120,110 Q1220,150 1320,100 Q1380,75 1440,120 L1440,320 Z"
          fill="var(--border)"
          opacity="0.06"
        />
      </svg>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-36 lg:py-44">
        <div className="text-center">
          {/* Main Headline */}
          <h1 className="font-[var(--font-serif)] text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-normal text-[var(--text-primary)] leading-[1.1] tracking-tight mb-6">
            {section.title}
          </h1>

          {/* Decorative line */}
          <div className="w-16 h-px bg-[var(--accent-primary)] mx-auto mb-8" />

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-[var(--text-secondary)] mb-12 max-w-xl mx-auto leading-relaxed">
            {section.subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Primary CTA */}
            <Link
              href={content?.cta_primary_link || "/app"}
              className="group flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--accent-primary)] text-white font-medium text-base tracking-wide transition-opacity hover:opacity-90"
            >
              {content?.cta_primary || "Ask About Coverage"}
              <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>

            {/* Secondary CTA */}
            <Link
              href={content?.cta_secondary_link || "#how-it-works"}
              className="flex items-center gap-2 px-8 py-4 rounded-full border border-[var(--border)] text-[var(--text-secondary)] font-medium text-base tracking-wide transition-colors hover:border-[var(--text-muted)]"
            >
              {content?.cta_secondary || "Learn How It Works"}
            </Link>
          </div>

          {/* Trust Indicator */}
          <p className="mt-10 uppercase tracking-wide font-medium text-sm text-[var(--text-muted)]">
            Coverage guidance is always free. No signup required.
          </p>
        </div>
      </div>
    </section>
  );
}
