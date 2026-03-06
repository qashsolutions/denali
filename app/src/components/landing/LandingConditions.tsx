"use client";

import Image from "next/image";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

const CONDITIONS = [
  {
    title: "Pre-Diabetes",
    description:
      "Your Medicare claims can reveal early warning signs. We detect pre-diabetes indicators, track your screening history, and connect you with the Medicare Diabetes Prevention Program.",
    image: "/PreDiabetes.png",
    alt: "A vibrant field of flowers representing early health awareness",
  },
  {
    title: "Diabetes",
    description:
      "We monitor your diabetes medications, refill gaps, and screening schedule from your claims — A1C, eye exams, kidney tests, glucose supplies — so nothing falls through the cracks.",
    image: "/Diabetes.png",
    alt: "A molecular visualization representing diabetes care science",
  },
  {
    title: "Obesity",
    description:
      "We track your weight management journey through your claims — GLP-1 medications, counseling visits, and coverage for bariatric surgery, behavioral therapy, and nutrition counseling.",
    image: "/Obesity.png",
    alt: "Chocolates and strawberries representing mindful nutrition choices",
  },
] as const;

function ConditionRow({
  condition,
  index,
}: {
  condition: (typeof CONDITIONS)[number];
  index: number;
}) {
  const { ref, isVisible } = useIntersectionObserver();
  const imageFirst = index % 2 === 0; // 0, 2 = image left; 1 = image right

  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center
        transition-all duration-600 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      {/* Image */}
      <div
        className={`relative rounded-2xl overflow-hidden aspect-[4/3] ${
          imageFirst ? "md:order-1" : "md:order-2"
        }`}
      >
        <Image
          src={condition.image}
          alt={condition.alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Text */}
      <div
        className={`flex flex-col justify-center ${
          imageFirst ? "md:order-2" : "md:order-1"
        }`}
      >
        <h3 className="font-[var(--font-serif)] text-2xl sm:text-3xl font-normal text-[var(--text-primary)] mb-3">
          {condition.title}
        </h3>
        <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed">
          {condition.description}
        </p>
      </div>
    </div>
  );
}

export function LandingConditions() {
  return (
    <section className="py-24 sm:py-36 bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="font-[var(--font-serif)] text-2xl sm:text-3xl lg:text-4xl font-normal text-[var(--text-primary)] mb-4">
            Analysis grounded in your{" "}
            <span className="text-[var(--accent-primary)]">Blue Button 2.0</span> data
          </h2>
        </div>

        <div className="space-y-16 sm:space-y-24">
          {CONDITIONS.map((condition, index) => (
            <ConditionRow
              key={condition.title}
              condition={condition}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
