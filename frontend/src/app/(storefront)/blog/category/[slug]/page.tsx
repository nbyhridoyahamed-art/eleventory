import type { Metadata } from "next";

import { breadcrumbJsonLd, disabledSchemas, JsonLd } from "@/lib/json-ld";
import { storefrontApi } from "@/lib/storefront-api";
import { buildStorefrontMetadata, resolveRedirectOrNotFound } from "@/lib/storefront-seo";
import { ApiError } from "@/types/api";
import type { StorefrontBlogCategory, StorefrontBlogPostSummary } from "@/types/storefront";
import { BlogCategoryClient } from "./blog-category-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function getBlogCategory(slug: string): Promise<StorefrontBlogCategory | null> {
  try {
    const data = await storefrontApi.get<{
      category: StorefrontBlogCategory;
      posts: StorefrontBlogPostSummary[];
    }>(`/storefront/blog/category/${slug}`);
    return data.category;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/blog/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getBlogCategory(slug);

  if (!category) {
    return { title: "Category not found" };
  }

  return buildStorefrontMetadata({
    seo: category.seo,
    fallbackTitle: category.name,
    fallbackDescription: category.description,
    path: `/blog/category/${category.slug}`,
  });
}

export default async function BlogCategoryPage({ params }: PageProps<"/blog/category/[slug]">) {
  const { slug } = await params;
  const category = await getBlogCategory(slug);

  if (!category) {
    await resolveRedirectOrNotFound(`/blog/category/${slug}`);
    throw new Error("unreachable");
  }

  const url = `${SITE_URL}/blog/category/${category.slug}`;

  return (
    <>
      <JsonLd
        disabled={disabledSchemas(category.seo)}
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          { name: category.name, url },
        ])}
      />
      <BlogCategoryClient slug={slug} />
    </>
  );
}
