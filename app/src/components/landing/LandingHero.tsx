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
      {/* Mountain range silhouette */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full pointer-events-none"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        style={{ height: "70%" }}
        aria-hidden="true"
      >
        {/* Far range — lighter */}
        <path
          d="M0,400 L0,280 Q80,260 160,270 Q240,280 320,220 Q400,160 480,180 Q560,200 640,140 Q720,80 800,120 Q880,160 960,90 Q1040,20 1120,60 Q1200,100 1280,50 Q1360,0 1440,40 L1440,400 Z"
          fill="var(--text-muted)"
          opacity="0.08"
        />
        {/* Near range — darker */}
        <path
          d="M0,400 L0,320 Q120,290 240,310 Q360,330 460,260 Q560,190 660,230 Q760,270 860,200 Q960,130 1060,170 Q1160,210 1260,150 Q1360,100 1440,140 L1440,400 Z"
          fill="var(--text-muted)"
          opacity="0.12"
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
          <p className="text-lg sm:text-xl text-[var(--text-secondary)] mb-4 max-w-xl mx-auto leading-relaxed">
            {section.subtitle}
          </p>

          {/* Tagline */}
          <p className="text-base text-[var(--text-muted)] mb-12 max-w-2xl mx-auto leading-relaxed">
            DenaliHealth helps Medicare patients with diabetes and obesity navigate coverage, prevent claim denials, and appeal rejections.
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
