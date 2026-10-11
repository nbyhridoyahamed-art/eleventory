"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Newspaper, Search } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BlogPostCard } from "@/components/storefront/blog-post-card";
import { PageBanner } from "@/components/storefront/page-banner";
import { StorefrontPagination } from "@/components/storefront/storefront-pagination";
import { useStorefrontBlogPosts } from "@/hooks/use-storefront-blog";

function BlogGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2 desktop:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="aspect-[4/3] w-full rounded-none" />
      ))}
    </div>
  );
}

function BlogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const [searchInput, setSearchInput] = useState(search);

  const { data, isLoading } = useStorefrontBlogPosts(page, search || undefined);
  const posts = data?.data ?? [];

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") {
      params.delete("page");
    }
    router.push(`/blog?${params.toString()}`);
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    updateParam("search", searchInput.trim() || null);
  };

  return (
    <div>
      <PageBanner
        title={search ? `Search results for “${search}”` : "Blog"}
        crumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]}
      >
        <p className="max-w-xl text-sm text-text-secondary">News, guides, and updates from our team.</p>
      </PageBanner>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
        <form
          onSubmit={submitSearch}
          role="search"
          className="flex h-11 max-w-md items-stretch overflow-hidden border-2 border-shop-accent bg-surface"
        >
          <input
            type="search"
            placeholder="Search posts..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search posts"
            className="min-w-0 flex-1 bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex shrink-0 items-center gap-2 bg-shop-accent px-4 text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
          >
            <Search className="size-4" />
            <span className="hidden tablet:inline">Search</span>
          </button>
        </form>

        {isLoading ? (
          <BlogGridSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState icon={<Newspaper />} title="No posts found" description="Try a different search." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2 desktop:grid-cols-3">
              {posts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
            <StorefrontPagination
              meta={data?.meta}
              itemLabel="posts"
              onPageChange={(newPage) => updateParam("page", String(newPage))}
            />
          </>
        )}

        {/* Hands readers back to the store so the blog and the shop link to each other. */}
        <aside className="flex flex-col items-start gap-4 border border-border bg-shop-tint p-6 tablet:flex-row tablet:items-center tablet:justify-between">
          <div>
            <p className="text-lg font-semibold text-text-primary">Ready to shop?</p>
            <p className="text-sm text-text-secondary">Browse the latest products, deals and new arrivals.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="bg-shop-accent px-6 py-3 text-xs font-semibold uppercase tracking-wide text-shop-on-accent transition-colors hover:bg-shop-accent-hover"
            >
              Shop now
            </Link>
            <Link
              href="/"
              className="border border-border bg-surface px-6 py-3 text-xs font-semibold uppercase tracking-wide text-text-primary transition-colors hover:border-shop-accent"
            >
              Back to home
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function BlogIndexClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1400px] px-4 py-8">
          <BlogGridSkeleton />
        </div>
      }
    >
      <BlogPageContent />
    </Suspense>
  );
}
