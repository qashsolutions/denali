import { createServerSupabaseClient } from "./supabase-server";
import type {
  BlogPost,
  LandingPageData,
  LandingSection,
  PricingPlan,
  SiteSetting,
  Testimonial,
} from "@/types/cms";

/**
 * Fetch all landing page data in one call (for SSR)
 */
export async function getLandingPageData(): Promise<LandingPageData> {
  const supabase = await createServerSupabaseClient();

  const [settingsResult, sectionsResult, pricingResult, testimonialsResult] =
    await Promise.all([
      supabase.from("site_settings").select("*"),
      supabase
        .from("landing_content")
        .select("*")
        .eq("is_published", true)
        .order("display_order"),
      supabase
        .from("pricing_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("testimonials")
        .select("*")
        .eq("is_published", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  // Transform settings array to key-value object
  const settings: Record<string, string> = {};
  if (settingsResult.data) {
    for (const setting of settingsResult.data as SiteSetting[]) {
      settings[setting.key] = setting.value;
    }
  }

  return {
    settings,
    sections: (sectionsResult.data as LandingSection[]) || [],
    pricing: (pricingResult.data as PricingPlan[]) || [],
    testimonials: (testimonialsResult.data as Testimonial[]) || [],
  };
}

/**
 * Get site settings as key-value object
 */
export async function getSiteSettings(): Promise<Record<string, string>> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("site_settings").select("*");

  const settings: Record<string, string> = {};
  if (data) {
    for (const setting of data as SiteSetting[]) {
      settings[setting.key] = setting.value;
    }
  }
  return settings;
}

/**
 * Get all landing sections
 */
export async function getLandingSections(): Promise<LandingSection[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("landing_content")
    .select("*")
    .order("display_order");

  return (data as LandingSection[]) || [];
}

/**
 * Get a specific landing section by key
 */
export async function getLandingSection(
  sectionKey: string
): Promise<LandingSection | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("landing_content")
    .select("*")
    .eq("section_key", sectionKey)
    .single();

  return data as LandingSection | null;
}

/**
 * Get all pricing plans
 */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("pricing_plans")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  return (data as PricingPlan[]) || [];
}

/**
 * Get featured testimonials
 */
export async function getTestimonials(limit = 6): Promise<Testimonial[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("testimonials")
    .select("*")
    .eq("is_published", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as Testimonial[]) || [];
}

/**
 * Get all published blog posts, optionally filtered by category
 */
export async function getBlogPosts(category?: string): Promise<BlogPost[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("blog_posts")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data } = await query;
  return (data as BlogPost[]) || [];
}

/**
 * Get a single blog post by slug
 */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  return data as BlogPost | null;
}

/**
 * Get all published blog post slugs (for generateStaticParams)
 */
export async function getBlogSlugs(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("published", true);

  return (data || []).map((row: { slug: string }) => row.slug);
}

/**
 * Format price for display
 */
export function formatPrice(priceCents: number): string {
  if (priceCents === 0) return "$0";
  return `$${(priceCents / 100).toFixed(0)}`;
}

/**
 * Get billing period label
 */
export function getBillingLabel(
  billingPeriod: "one_time" | "monthly" | null
): string {
  switch (billingPeriod) {
    case "monthly":
      return "/month";
    case "one_time":
      return "/appeal";
    default:
      return "";
  }
}
