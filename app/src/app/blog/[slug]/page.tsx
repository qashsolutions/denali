import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogPost, getBlogSlugs, getSiteSettings } from "@/lib/cms";
import { BlogArticle } from "@/components/blog";
import { LandingHeader, LandingFooter } from "@/components/landing";

export const revalidate = 3600;

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Post Not Found" };

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.kicker,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([
    getBlogPost(slug),
    getSiteSettings(),
  ]);

  if (!post) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader settings={settings} />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12">
        <BlogArticle post={post} />
      </main>

      <LandingFooter settings={settings} />
    </div>
  );
}
