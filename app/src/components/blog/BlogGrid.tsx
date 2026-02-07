import type { BlogPost } from "@/types/cms";
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
}

export function BlogGrid({ posts, activeCategory = "" }: BlogGridProps) {
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
