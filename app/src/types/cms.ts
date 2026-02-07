/**
 * CMS Types for Landing Page
 */

export interface SiteSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface LandingSection {
  id: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  content: Record<string, unknown>;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price_cents: number;
  billing_period: "one_time" | "monthly" | null;
  features: string[];
  is_popular: boolean;
  display_order: number;
  stripe_price_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Testimonial {
  id: string;
  author_name: string;
  author_title: string | null;
  content: string;
  rating: number;
  is_featured: boolean;
  is_published: boolean;
  source: string | null;
  created_at: string;
}

export interface LandingPageData {
  settings: Record<string, string>;
  sections: LandingSection[];
  pricing: PricingPlan[];
  testimonials: Testimonial[];
}

// Content type definitions for specific sections
export interface HeroContent {
  cta_primary: string;
  cta_primary_link: string;
  cta_secondary: string;
  cta_secondary_link: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface HowItWorksStep {
  step: number;
  title: string;
  description: string;
}

export interface CTAContent {
  cta_text: string;
  cta_link: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  kicker: string;
  key_message: string;
  body: string;
  category: "denial-codes" | "coverage" | "appeals" | "prior-auth";
  cta_text: string;
  cta_url: string;
  sources: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
