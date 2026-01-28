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
    <section className="py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--text-primary)] mb-4">
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
              className="bg-[var(--bg-secondary)] rounded-2xl p-6 sm:p-8 border border-[var(--border)] transition-all hover:border-[var(--accent-primary)]/30 hover:shadow-lg"
            >
              {/* Rating Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    filled={i < testimonial.rating}
                    className={
                      i < testimonial.rating
                        ? "text-yellow-400"
                        : "text-[var(--border)]"
                    }
                  />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-[var(--text-primary)] leading-relaxed mb-6">
                &ldquo;{testimonial.content}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                {/* Avatar Placeholder */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white font-semibold text-sm">
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
