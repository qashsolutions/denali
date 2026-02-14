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
      {/* Mountain Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/denali-hero.png)" }}
      />
      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-24 sm:h-32 bg-gradient-to-b from-transparent to-[var(--bg-secondary)]" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-44">
        <div className="max-w-3xl mx-auto text-center">
          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-4">
            {section.title}
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            {section.subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Primary CTA */}
            <Link
              href={content?.cta_primary_link || "/app"}
              className="group flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--accent-primary)] text-white font-semibold text-lg transition-all hover:shadow-lg hover:shadow-[var(--accent-primary)]/25 hover:scale-[1.02]"
            >
              {content?.cta_primary || "Ask About Coverage"}
              <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>

            {/* Secondary CTA */}
            <Link
              href={content?.cta_secondary_link || "#how-it-works"}
              className="flex items-center gap-2 px-8 py-4 rounded-full border border-white/40 text-white font-semibold text-lg transition-colors hover:bg-white/10 hover:border-white/60"
            >
              {content?.cta_secondary || "Learn How It Works"}
            </Link>
          </div>

          {/* Trust Indicator */}
          <p className="mt-8 text-sm text-white/60">
            Coverage guidance is always free. No signup required.
          </p>
        </div>
      </div>
    </section>
  );
}
