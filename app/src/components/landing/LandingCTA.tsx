import Link from "next/link";
import { ArrowRightIcon } from "../icons";
import type { LandingSection, CTAContent } from "@/types/cms";

interface LandingCTAProps {
  section: LandingSection | undefined;
}

export function LandingCTA({ section }: LandingCTAProps) {
  if (!section) return null;

  const content = section.content as unknown as CTAContent;

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Headline */}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
          {section.title}
        </h2>

        {/* Subtitle */}
        {section.subtitle && (
          <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            {section.subtitle}
          </p>
        )}

        {/* CTA Button */}
        <Link
          href={content?.cta_link || "/chat"}
          className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[var(--accent-primary)] font-semibold text-lg transition-all hover:shadow-xl hover:shadow-black/20 hover:scale-[1.02]"
        >
          {content?.cta_text || "Ask Your First Question"}
          <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
