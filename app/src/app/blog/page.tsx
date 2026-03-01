import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getBlogPosts, getDefaultBlogPosts, getPersonalizedBlogPosts, getUserTopics } from "@/lib/cms";
import { BlogGrid } from "@/components/blog";
import { LandingFooter } from "@/components/landing";
import { getSiteSettings } from "@/lib/cms";
import { query } from "@/lib/db";
import type { BlogPost, GroupedBlogContent } from "@/types/cms";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Medicare Blog | Denali Health",
  description:
    "Plain-English guides to Medicare denial codes, coverage questions, appeals, and prior authorization. No jargon, just answers.",
};

interface BlogPageProps {
  searchParams: Promise<{ category?: string }>;
}

/**
 * Lightweight user ID extraction from access_token cookie.
 * Does NOT validate the JWT — just reads the sub claim for personalization.
 * Blog is public, so worst case = no personalization (not a security issue).
 */
async function getUserIdFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    if (!accessToken) return null;

    // Decode JWT payload (middle segment) without verification
    const parts = accessToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const cognitoSub = payload.sub;
    if (!cognitoSub) return null;

    // Look up user_id from cognito sub
    const result = await query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 LIMIT 1`,
      [cognitoSub]
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const category = params.category;

  // Determine display mode:
  // 1. Category filter active → show all posts in that category (with category tabs)
  // 2. Signed-in user with topic preferences → personalized grouped view
  // 3. Default (anonymous / signed-in without prefs) → 3 rotating posts (one per topic, weekly)
  let personalizedGroups: GroupedBlogContent[] | null = null;
  let defaultPosts: BlogPost[] | null = null;

  if (!category) {
    try {
      const userId = await getUserIdFromCookie();
      if (userId) {
        const topics = await getUserTopics(userId);
        if (topics.length > 0) {
          personalizedGroups = await getPersonalizedBlogPosts(topics);
        }
      }
    } catch {
      // Silently fall back to default blog view
    }

    // If no personalized content, get weekly-rotating defaults
    if (!personalizedGroups || personalizedGroups.length === 0) {
      try {
        defaultPosts = await getDefaultBlogPosts();
      } catch {
        // Falls through to full post list
      }
    }
  }

  const [allPosts, settings] = await Promise.all([
    getBlogPosts(category),
    getSiteSettings(),
  ]);

  // Default view: show rotating picks (3 posts). Category view: show all in category.
  const displayPosts = (!category && defaultPosts && defaultPosts.length > 0)
    ? defaultPosts
    : allPosts;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            Medicare, Explained
          </h1>
          <p className="mt-2 text-lg text-[var(--text-secondary)]">
            Plain-English guides to help you navigate Medicare with confidence.
          </p>
        </div>

        {personalizedGroups && personalizedGroups.length > 0 ? (
          <BlogGrid posts={allPosts} activeCategory={category} groupedContent={personalizedGroups} />
        ) : (
          <BlogGrid
            posts={displayPosts}
            activeCategory={category}
            showBrowseAll={!category && defaultPosts !== null && defaultPosts.length > 0}
          />
        )}
      </main>

      <LandingFooter settings={settings} />
    </div>
  );
}
