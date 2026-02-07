import Link from "next/link";
import type { BlogPost } from "@/types/cms";
import { Button } from "@/components/ui/Button";

const categoryLabels: Record<BlogPost["category"], string> = {
  "denial-codes": "Denial Codes",
  coverage: "Coverage",
  appeals: "Appeals",
  "prior-auth": "Prior Auth",
};

interface BlogArticleProps {
  post: BlogPost;
}

export function BlogArticle({ post }: BlogArticleProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.meta_description || post.kicker,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    publisher: {
      "@type": "Organization",
      name: "Denali Health",
      url: "https://denali.health",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors mb-8"
        >
          &larr; Back to Blog
        </Link>

        {/* Category badge */}
        <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold bg-[var(--bg-tertiary)] text-[var(--text-secondary)] mb-4">
          {categoryLabels[post.category]}
        </span>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] leading-tight">
          {post.title}
        </h1>

        {/* Kicker */}
        <p className="mt-3 text-lg text-[var(--text-secondary)] leading-relaxed">
          {post.kicker}
        </p>

        {/* Key message callout */}
        <div className="mt-8 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-6">
          <p className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
            Key Takeaway
          </p>
          <p className="text-[var(--text-primary)] font-medium leading-relaxed">
            {post.key_message}
          </p>
        </div>

        {/* Body */}
        <div className="mt-8 text-[var(--text-primary)] leading-relaxed text-[17px] whitespace-pre-line">
          {post.body}
        </div>

        {/* Sources */}
        {post.sources && post.sources.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text-muted)] mb-2">
              Sources
            </p>
            <ul className="list-disc list-inside text-sm text-[var(--text-secondary)] space-y-1">
              {post.sources.map((source, i) => (
                <li key={i}>{source}</li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-6 text-center">
          <p className="text-[var(--text-primary)] font-medium mb-4">
            {post.cta_text}
          </p>
          <Link href={post.cta_url}>
            <Button variant="primary" size="lg">
              Start a conversation
            </Button>
          </Link>
        </div>
      </article>
    </>
  );
}
