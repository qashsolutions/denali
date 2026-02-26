import { query } from "./db";
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
  const [settingsResult, sectionsResult, pricingResult, testimonialsResult] =
    await Promise.all([
      query<SiteSetting>(`SELECT * FROM site_settings`),
      query<LandingSection>(
        `SELECT * FROM landing_content WHERE is_published = true ORDER BY display_order`
      ),
      query<PricingPlan>(
        `SELECT * FROM pricing_plans WHERE is_active = true ORDER BY display_order`
      ),
      query<Testimonial>(
        `SELECT * FROM testimonials WHERE is_published = true AND is_featured = true ORDER BY created_at DESC LIMIT 6`
      ),
    ]);

  // Transform settings array to key-value object
  const settings: Record<string, string> = {};
  for (const setting of settingsResult.rows) {
    settings[setting.key] = setting.value;
  }

  return {
    settings,
    sections: sectionsResult.rows,
    pricing: pricingResult.rows,
    testimonials: testimonialsResult.rows,
  };
}

/**
 * Get site settings as key-value object
 */
export async function getSiteSettings(): Promise<Record<string, string>> {
  const result = await query<SiteSetting>(`SELECT * FROM site_settings`);

  const settings: Record<string, string> = {};
  for (const setting of result.rows) {
    settings[setting.key] = setting.value;
  }
  return settings;
}

/**
 * Get all landing sections
 */
export async function getLandingSections(): Promise<LandingSection[]> {
  const result = await query<LandingSection>(
    `SELECT * FROM landing_content ORDER BY display_order`
  );
  return result.rows;
}

/**
 * Get a specific landing section by key
 */
export async function getLandingSection(
  sectionKey: string
): Promise<LandingSection | null> {
  const result = await query<LandingSection>(
    `SELECT * FROM landing_content WHERE section_key = $1 LIMIT 1`,
    [sectionKey]
  );
  return result.rows[0] ?? null;
}

/**
 * Get all pricing plans
 */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  const result = await query<PricingPlan>(
    `SELECT * FROM pricing_plans WHERE is_active = true ORDER BY display_order`
  );
  return result.rows;
}

/**
 * Get featured testimonials
 */
export async function getTestimonials(limit = 6): Promise<Testimonial[]> {
  const result = await query<Testimonial>(
    `SELECT * FROM testimonials WHERE is_published = true AND is_featured = true ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Get all published blog posts, optionally filtered by category
 */
export async function getBlogPosts(category?: string): Promise<BlogPost[]> {
  if (category) {
    const result = await query<BlogPost>(
      `SELECT * FROM blog_posts WHERE published = true AND category = $1 ORDER BY published_at DESC`,
      [category]
    );
    return result.rows;
  }
  const result = await query<BlogPost>(
    `SELECT * FROM blog_posts WHERE published = true ORDER BY published_at DESC`
  );
  return result.rows;
}

/**
 * Get a single blog post by slug
 */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const result = await query<BlogPost>(
    `SELECT * FROM blog_posts WHERE slug = $1 AND published = true LIMIT 1`,
    [slug]
  );
  return result.rows[0] ?? null;
}

/**
 * Get all published blog post slugs (for generateStaticParams).
 * Uses query() directly — runs at build time with DATABASE_URL from env.
 */
export async function getBlogSlugs(): Promise<string[]> {
  const result = await query<{ slug: string }>(
    `SELECT slug FROM blog_posts WHERE published = true`
  );
  return result.rows.map((row) => row.slug);
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
