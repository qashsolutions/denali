import type { BlogPost, GroupedBlogContent } from "@/types/cms";
import { BlogCard } from "./BlogCard";

const categories = [
  { value: "", label: "All" },
  { value: "denial-codes", label: "Denial Codes" },
  { value: "coverage", label: "Coverage" },
  { value: "appeals", label: "Appeals" },
  { value: "prior-auth", label: "Prior Auth" },
] as const;

interface BlogGridProps {
  posts: BlogPost[];
  activeCategory?: string;
  groupedContent?: GroupedBlogContent[];
  /** When true, shows a curated default view with a "Browse all" link instead of category tabs */
  showBrowseAll?: boolean;
}

export function BlogGrid({ posts, activeCategory = "", groupedContent, showBrowseAll }: BlogGridProps) {
  // Personalized grouped view — no category tabs, just topic sections
  if (groupedContent && groupedContent.length > 0) {
    return (
      <div>
        {/* "For You" badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Based on your interests
          </span>
        </div>

        {/* Topic groups */}
        {groupedContent.map((group) => (
          <div key={group.topic} className="mb-10">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
              {group.label}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.posts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        ))}

        {/* Separator + all posts below */}
        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">
            All Articles
          </h2>
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.value;
              return (
                <a
                  key={cat.value}
                  href={cat.value ? `/blog?category=${cat.value}` : "/blog"}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--accent-primary)] text-white"
                      : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                  }`}
                >
                  {cat.label}
                </a>
              );
            })}
          </div>
          {posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="text-center text-[var(--text-muted)] py-12">
              No posts found in this category.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Curated default view — weekly rotating picks, no category tabs
  if (showBrowseAll) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-tertiary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            This Week&apos;s Picks
          </span>
        </div>

        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--text-muted)] py-12">
            No posts available.
          </p>
        )}

        {/* Browse all link */}
        <div className="mt-8 text-center">
          <a
            href="/blog?view=all"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-primary)] hover:underline"
          >
            Browse all articles
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    );
  }

  // Default non-personalized view — category tabs + grid
  return (
    <div>
      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.value;
          return (
            <a
              key={cat.value}
              href={cat.value ? `/blog?category=${cat.value}` : "/blog"}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
              }`}
            >
              {cat.label}
            </a>
          );
        })}
      </div>

      {/* Post grid */}
      {posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-center text-[var(--text-muted)] py-12">
          No posts found in this category.
        </p>
      )}
    </div>
  );
}
