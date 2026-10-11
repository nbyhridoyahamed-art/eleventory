"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock } from "lucide-react";

import { BlogPostCard } from "@/components/storefront/blog-post-card";
import { PageBanner, type Crumb } from "@/components/storefront/page-banner";
import { SectionHeading } from "@/components/homepage-blocks/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorefrontBlogPost } from "@/hooks/use-storefront-blog";
import { ApiError } from "@/types/api";

/**
 * The interactive blog post — a Client Component so it can fetch live data
 * (TanStack Query). Its parent page.tsx is a Server Component that fetches
 * the same post once more, server-side, purely to build real <head>
 * metadata and JSON-LD — see ARCHITECTURE.md's "fetch twice, once per side"
 * note on why this app's storefront can't yet share one fetch across both.
 */
export function BlogPostClient({ slug }: { slug: string }) {
  const { data, isLoading, error } = useStorefrontBlogPost(slug);

  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="aspect-[16/9] w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-text-secondary">Something went wrong loading this post. Please try again.</p>
      </div>
    );
  }

  const { post, related_posts: relatedPosts } = data;

  const crumbs: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    ...(post.category ? [{ label: post.category.name, href: `/blog/category/${post.category.slug}` }] : []),
    { label: post.title },
  ];

  return (
    <div>
      <PageBanner title={post.title} crumbs={crumbs}>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-text-muted">
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
      </PageBanner>

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {post.featured_image_url ? (
          <div className="overflow-hidden border border-border bg-shop-tint">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset */}
            <img src={post.featured_image_url} alt={post.title} className="w-full object-cover" />
          </div>
        ) : null}

        {post.body ? <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: post.body }} /> : null}

        {post.tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Tags</span>
            {post.tags.map((tag) => (
              <Link
                key={tag.slug}
                href={`/blog/tag/${tag.slug}`}
                className="border border-border px-3 py-1 text-xs text-text-secondary transition-colors hover:border-shop-accent hover:text-text-primary"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        ) : null}
      </article>

      {relatedPosts.length > 0 ? (
        <section className="mx-auto max-w-[1400px] space-y-4 px-4 pb-10">
          <SectionHeading title="Related posts" />
          <div className="grid grid-cols-1 gap-6 tablet:grid-cols-3">
            {relatedPosts.map((related) => (
              <BlogPostCard key={related.id} post={related} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
