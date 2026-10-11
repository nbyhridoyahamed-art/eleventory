import type { Metadata } from "next";

import { breadcrumbJsonLd, disabledSchemas, JsonLd } from "@/lib/json-ld";
import { storefrontApi } from "@/lib/storefront-api";
import { buildStorefrontMetadata, resolveRedirectOrNotFound } from "@/lib/storefront-seo";
import { ApiError } from "@/types/api";
import type { StorefrontBlogPostSummary, StorefrontBlogTag } from "@/types/storefront";
import { BlogTagClient } from "./blog-tag-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function getBlogTag(slug: string): Promise<StorefrontBlogTag | null> {
  try {
    const data = await storefrontApi.get<{
      tag: StorefrontBlogTag;
      posts: StorefrontBlogPostSummary[];
    }>(`/storefront/blog/tag/${slug}`);
    return data.tag;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/blog/tag/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getBlogTag(slug);

  if (!tag) {
    return { title: "Tag not found" };
  }

  return buildStorefrontMetadata({
    seo: tag.seo,
    fallbackTitle: tag.name,
    path: `/blog/tag/${tag.slug}`,
  });
}

export default async function BlogTagPage({ params }: PageProps<"/blog/tag/[slug]">) {
  const { slug } = await params;
  const tag = await getBlogTag(slug);

  if (!tag) {
    await resolveRedirectOrNotFound(`/blog/tag/${slug}`);
    throw new Error("unreachable");
  }

  const url = `${SITE_URL}/blog/tag/${tag.slug}`;

  return (
    <>
      <JsonLd
        disabled={disabledSchemas(tag.seo)}
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          { name: tag.name, url },
        ])}
      />
      <BlogTagClient slug={slug} />
    </>
  );
}
