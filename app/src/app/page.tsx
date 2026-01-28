import { getLandingPageData } from "@/lib/cms";
import {
  LandingHeader,
  LandingHero,
  LandingFeatures,
  LandingHowItWorks,
  LandingPricing,
  LandingTestimonials,
  LandingFooter,
} from "@/components/landing";

export const revalidate = 3600; // Revalidate every hour

export default async function LandingPage() {
  const data = await getLandingPageData();

  const heroSection = data.sections.find((s) => s.section_key === "hero");
  const featuresSection = data.sections.find(
    (s) => s.section_key === "features"
  );
  const howItWorksSection = data.sections.find(
    (s) => s.section_key === "how_it_works"
  );

  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader settings={data.settings} />

      <main className="flex-1">
        <LandingHero section={heroSection} />
        <LandingFeatures section={featuresSection} />
        <LandingHowItWorks section={howItWorksSection} />
        <LandingPricing plans={data.pricing} />
        <LandingTestimonials testimonials={data.testimonials} />
      </main>

      <LandingFooter settings={data.settings} />
    </div>
  );
}
