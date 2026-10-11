import Link from "next/link";
import { CalendarDays, Clock, Newspaper } from "lucide-react";

import type { StorefrontBlogPostSummary } from "@/types/storefront";

export function BlogPostCard({ post }: { post: StorefrontBlogPostSummary }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden border border-border bg-surface transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-shop-tint">
        {post.featured_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
          <img
            src={post.featured_image_url}
            alt={post.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Newspaper className="size-10 text-text-muted" />
          </div>
        )}
        {post.category ? (
          <span className="absolute left-3 top-3 bg-shop-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-shop-on-accent">
            {post.category.name}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 text-base font-semibold leading-snug text-text-primary group-hover:text-shop-ink">
          {post.title}
        </p>
        {post.excerpt ? <p className="line-clamp-3 text-sm leading-relaxed text-text-secondary">{post.excerpt}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-text-muted">
          {post.published_at ? (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {new Date(post.published_at).toLocaleDateString()}
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {post.reading_time_minutes} min read
          </span>
        </div>
      </div>
    </Link>
  );
}
