import Link from "next/link";
import type { BlogPost } from "@/types/cms";

const categoryLabels: Record<BlogPost["category"], string> = {
  "denial-codes": "Denial Codes",
  coverage: "Coverage",
  appeals: "Appeals",
  "prior-auth": "Prior Auth",
};

const categoryColors: Record<BlogPost["category"], string> = {
  "denial-codes":
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  coverage:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  appeals:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "prior-auth":
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 transition-shadow hover:shadow-lg"
    >
      <span
        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${categoryColors[post.category]}`}
      >
        {categoryLabels[post.category]}
      </span>

      <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors leading-snug">
        {post.title}
      </h3>

      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2">
        {post.kicker}
      </p>

      <span className="mt-4 inline-block text-sm font-medium text-[var(--accent-primary)]">
        Read more &rarr;
      </span>
    </Link>
  );
}
