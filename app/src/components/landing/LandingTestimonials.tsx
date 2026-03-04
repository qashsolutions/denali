import { StarIcon } from "../icons";
import type { Testimonial } from "@/types/cms";

interface LandingTestimonialsProps {
  testimonials: Testimonial[];
}

export function LandingTestimonials({
  testimonials,
}: LandingTestimonialsProps) {
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <section className="py-24 sm:py-36 bg-[var(--bg-secondary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="font-[var(--font-serif)] text-2xl sm:text-3xl lg:text-4xl font-normal text-[var(--text-primary)] mb-4">
            Trusted by Medicare Patients
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            See how we&apos;ve helped others navigate Medicare coverage.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-[var(--bg-primary)] rounded-xl p-6 sm:p-8 border border-[var(--border)]"
            >
              {/* Rating Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    filled={i < testimonial.rating}
                    className={
                      i < testimonial.rating
                        ? "text-[var(--accent-primary)]"
                        : "text-[var(--border)]"
                    }
                  />
                ))}
              </div>

              {/* Quote — serif italic for editorial feel */}
              <blockquote className="font-[var(--font-serif)] italic text-[var(--text-primary)] leading-relaxed mb-6">
                &ldquo;{testimonial.content}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                {/* Avatar — flat bg, no gradient */}
                <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)] font-semibold text-sm">
                  {testimonial.author_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {testimonial.author_name}
                  </p>
                  {testimonial.author_title && (
                    <p className="text-sm text-[var(--text-muted)]">
                      {testimonial.author_title}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
