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
    <section className="relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)]/10 via-transparent to-[var(--accent-secondary)]/10" />

      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[var(--accent-primary)]/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[var(--accent-secondary)]/20 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
        <div className="max-w-3xl mx-auto text-center">
          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-[var(--text-primary)] leading-tight mb-6">
            {section.title}
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto">
            {section.subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Primary CTA */}
            <Link
              href={content?.cta_primary_link || "/chat"}
              className="group flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-semibold text-lg transition-all hover:shadow-lg hover:shadow-[var(--accent-primary)]/25 hover:scale-[1.02]"
            >
              {content?.cta_primary || "Ask About Coverage"}
              <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>

            {/* Secondary CTA */}
            <Link
              href={content?.cta_secondary_link || "#how-it-works"}
              className="flex items-center gap-2 px-8 py-4 rounded-full border border-[var(--border)] text-[var(--text-primary)] font-semibold text-lg transition-colors hover:bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)]"
            >
              {content?.cta_secondary || "Learn How It Works"}
            </Link>
          </div>

          {/* Trust Indicator */}
          <p className="mt-8 text-sm text-[var(--text-muted)]">
            Coverage guidance is always free. No signup required.
          </p>
        </div>
      </div>
    </section>
  );
}
