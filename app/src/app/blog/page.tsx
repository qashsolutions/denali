import type { Metadata } from "next";
import { getBlogPosts } from "@/lib/cms";
import { BlogGrid } from "@/components/blog";
import { LandingHeader, LandingFooter } from "@/components/landing";
import { getSiteSettings } from "@/lib/cms";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Medicare Blog | Denali Health",
  description:
    "Plain-English guides to Medicare denial codes, coverage questions, appeals, and prior authorization. No jargon, just answers.",
};

interface BlogPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const category = params.category;
  const [posts, settings] = await Promise.all([
    getBlogPosts(category),
    getSiteSettings(),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader settings={settings} />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            Medicare, Explained
          </h1>
          <p className="mt-2 text-lg text-[var(--text-secondary)]">
            Plain-English guides to help you navigate Medicare with confidence.
          </p>
        </div>

        <BlogGrid posts={posts} activeCategory={category} />
      </main>

      <LandingFooter settings={settings} />
    </div>
  );
}
