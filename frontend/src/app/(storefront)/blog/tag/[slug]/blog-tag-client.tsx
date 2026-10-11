"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { Newspaper } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BlogPostCard } from "@/components/storefront/blog-post-card";
import { PageBanner } from "@/components/storefront/page-banner";
import { StorefrontPagination } from "@/components/storefront/storefront-pagination";
import { useStorefrontBlogTag } from "@/hooks/use-storefront-blog";
import { ApiError } from "@/types/api";

/**
 * The interactive blog tag listing — a Client Component so it can fetch
 * live data (TanStack Query) and handle pagination. Its parent page.tsx is
 * a Server Component that fetches the same tag once more, server-side,
 * purely to build real <head> metadata and JSON-LD — see ARCHITECTURE.md's
 * "fetch twice, once per side" note on why this app's storefront can't yet
 * share one fetch across both.
 */
export function BlogTagClient({ slug }: { slug: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useStorefrontBlogTag(slug, page);

  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2 desktop:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full rounded-none" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 text-center">
        <p className="text-text-secondary">Something went wrong loading this tag. Please try again.</p>
      </div>
    );
  }

  const { tag, posts } = data.data;

  return (
    <div>
      <PageBanner
        title={`Tag: ${tag.name}`}
        crumbs={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: tag.name }]}
      />

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
        {posts.length === 0 ? (
          <EmptyState icon={<Newspaper />} title="No posts with this tag yet" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2 desktop:grid-cols-3">
              {posts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
            <StorefrontPagination meta={data.meta} itemLabel="posts" onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
