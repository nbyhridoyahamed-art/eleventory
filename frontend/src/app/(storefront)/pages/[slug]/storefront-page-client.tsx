"use client";

import { notFound } from "next/navigation";

import { ApiError } from "@/types/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorefrontPage } from "@/hooks/use-storefront-pages";

/**
 * The interactive CMS page — a Client Component so it can fetch live data
 * (TanStack Query). Its parent page.tsx is a Server Component that fetches
 * the same page once more, server-side, purely to build real <head>
 * metadata and JSON-LD — see ARCHITECTURE.md's "fetch twice, once per side"
 * note on why this app's storefront can't yet share one fetch across both.
 */
export function StorefrontPageClient({ slug }: { slug: string }) {
  const { data: page, isLoading, error } = useStorefrontPage(slug);

  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-text-secondary">Something went wrong loading this page. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-page-title font-semibold text-text-primary">{page.title}</h1>
      {page.content ? (
        // The API sanitises page HTML; plain-text pages (no tags) keep their line breaks.
        /<[a-z][\s\S]*>/i.test(page.content) ? (
          <div className="rich-text-content text-text-secondary" dangerouslySetInnerHTML={{ __html: page.content }} />
        ) : (
          <p className="whitespace-pre-line text-text-secondary">{page.content}</p>
        )
      ) : null}
    </div>
  );
}
