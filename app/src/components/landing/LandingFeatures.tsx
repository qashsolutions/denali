import {
  ShieldCheckIcon,
  DocumentTextIcon,
  ScaleIcon,
  getIconByName,
} from "../icons";
import type { LandingSection, FeatureItem } from "@/types/cms";

interface LandingFeaturesProps {
  section: LandingSection | undefined;
}

export function LandingFeatures({ section }: LandingFeaturesProps) {
  if (!section) return null;

  const features = section.content as unknown as FeatureItem[];

  // Default icon mapping
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    shield: ShieldCheckIcon,
    document: DocumentTextIcon,
    appeal: ScaleIcon,
  };

  return (
    <section className="py-16 sm:py-24 bg-[var(--bg-secondary)]">
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

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {Array.isArray(features) &&
            features.map((feature, index) => {
              const IconComponent =
                iconMap[feature.icon] ||
                getIconByName(feature.icon) ||
                ShieldCheckIcon;

              return (
                <div
                  key={index}
                  className="group relative bg-[var(--bg-primary)] rounded-2xl p-6 sm:p-8 border border-[var(--border)] transition-all hover:border-[var(--accent-primary)]/50 hover:shadow-lg hover:shadow-[var(--accent-primary)]/5"
                >
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 flex items-center justify-center mb-5 transition-transform group-hover:scale-110">
                    <IconComponent className="w-7 h-7 text-[var(--accent-primary)]" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
}
