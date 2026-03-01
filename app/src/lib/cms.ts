import { query } from "./db";
import type {
  BlogPost,
  GroupedBlogContent,
  LandingPageData,
  LandingSection,
  PricingPlan,
  SiteSetting,
  Testimonial,
} from "@/types/cms";

/**
 * Fetch all landing page data in one call (for SSR).
 * Returns empty defaults if DB is unreachable (Docker build time).
 */
export async function getLandingPageData(): Promise<LandingPageData> {
  try {
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
  } catch {
    // DB not available at build time — render with defaults, ISR fills in at runtime
    return { settings: {}, sections: [], pricing: [], testimonials: [] };
  }
}

/**
 * Get site settings as key-value object
 */
export async function getSiteSettings(): Promise<Record<string, string>> {
  try {
    const result = await query<SiteSetting>(`SELECT * FROM site_settings`);
    const settings: Record<string, string> = {};
    for (const setting of result.rows) {
      settings[setting.key] = setting.value;
    }
    return settings;
  } catch {
    return {};
  }
}

/**
 * Get all landing sections
 */
export async function getLandingSections(): Promise<LandingSection[]> {
  try {
    const result = await query<LandingSection>(
      `SELECT * FROM landing_content ORDER BY display_order`
    );
    return result.rows;
  } catch {
    return [];
  }
}

/**
 * Get a specific landing section by key
 */
export async function getLandingSection(
  sectionKey: string
): Promise<LandingSection | null> {
  try {
    const result = await query<LandingSection>(
      `SELECT * FROM landing_content WHERE section_key = $1 LIMIT 1`,
      [sectionKey]
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get all pricing plans
 */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  try {
    const result = await query<PricingPlan>(
      `SELECT * FROM pricing_plans WHERE is_active = true ORDER BY display_order`
    );
    return result.rows;
  } catch {
    return [];
  }
}

/**
 * Get featured testimonials
 */
export async function getTestimonials(limit = 6): Promise<Testimonial[]> {
  try {
    const result = await query<Testimonial>(
      `SELECT * FROM testimonials WHERE is_published = true AND is_featured = true ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch {
    return [];
  }
}

/**
 * Get all published blog posts, optionally filtered by category
 */
export async function getBlogPosts(category?: string): Promise<BlogPost[]> {
  try {
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
  } catch {
    return [];
  }
}

/**
 * Get a single blog post by slug
 */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const result = await query<BlogPost>(
      `SELECT * FROM blog_posts WHERE slug = $1 AND published = true LIMIT 1`,
      [slug]
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get all published blog post slugs (for generateStaticParams).
 * Returns [] if DB unreachable at build time — posts render on-demand via ISR.
 */
export async function getBlogSlugs(): Promise<string[]> {
  try {
    const result = await query<{ slug: string }>(
      `SELECT slug FROM blog_posts WHERE published = true`
    );
    return result.rows.map((row) => row.slug);
  } catch {
    return [];
  }
}

/**
 * Get user's topic preferences (server-side, for SSR blog page)
 */
export async function getUserTopics(userId: string): Promise<string[]> {
  try {
    const result = await query<{ topic: string }>(
      `SELECT topic FROM user_topic_preferences WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    );
    return result.rows.map((r) => r.topic);
  } catch {
    return [];
  }
}

/**
 * Get the ISO week number for a date (1-53).
 * Used for deterministic weekly rotation of default blog posts.
 */
function getISOWeekNumber(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get default blog posts for anonymous / no-preferences users.
 * Returns 1 post per topic (diabetes, obesity, medicare-general),
 * rotating weekly based on ISO week number.
 */
export async function getDefaultBlogPosts(): Promise<BlogPost[]> {
  const defaultTopics = ["diabetes", "obesity", "medicare-general"];
  const weekNum = getISOWeekNumber();

  try {
    const picks: BlogPost[] = [];
    for (const topic of defaultTopics) {
      const result = await query<BlogPost>(
        `SELECT * FROM blog_posts
         WHERE published = true AND $1 = ANY(tags)
         ORDER BY published_at ASC`,
        [topic]
      );
      if (result.rows.length > 0) {
        // Rotate pick based on week number
        const idx = weekNum % result.rows.length;
        picks.push(result.rows[idx]);
      }
    }
    return picks;
  } catch {
    return [];
  }
}

/**
 * Get personalized blog posts grouped by topic.
 * - If topics provided: 3 posts per topic, grouped
 * - If no topics (default): 3 most recent posts
 */
export async function getPersonalizedBlogPosts(
  topics?: string[]
): Promise<GroupedBlogContent[]> {
  try {
    if (topics && topics.length > 0) {
      const topicLabels: Record<string, string> = {
        diabetes: "Diabetes",
        obesity: "Obesity",
        "medicare-general": "Medicare General",
      };

      const groups: GroupedBlogContent[] = [];
      for (const topic of topics) {
        const result = await query<BlogPost>(
          `SELECT * FROM blog_posts
           WHERE published = true AND $1 = ANY(tags)
           ORDER BY published_at DESC LIMIT 3`,
          [topic]
        );
        if (result.rows.length > 0) {
          groups.push({
            topic,
            label: topicLabels[topic] || topic,
            posts: result.rows,
          });
        }
      }
      return groups;
    }

    // Default: 3 most recent posts (no grouping, returned as single group)
    const result = await query<BlogPost>(
      `SELECT * FROM blog_posts WHERE published = true ORDER BY published_at DESC LIMIT 3`
    );
    return [{ topic: "recent", label: "Latest Articles", posts: result.rows }];
  } catch {
    return [];
  }
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
