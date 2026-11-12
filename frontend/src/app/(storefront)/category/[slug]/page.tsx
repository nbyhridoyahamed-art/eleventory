import type { Metadata } from "next";

import { breadcrumbJsonLd, disabledSchemas, JsonLd } from "@/lib/json-ld";
import { storefrontApi } from "@/lib/storefront-api";
import { getSiteUrl } from "@/lib/store-host";
import { buildStorefrontMetadata, resolveRedirectOrNotFound } from "@/lib/storefront-seo";
import { ApiError } from "@/types/api";
import type { StorefrontCategory, StorefrontProduct } from "@/types/storefront";
import { CategoryClient } from "./category-client";


async function getCategory(slug: string): Promise<StorefrontCategory | null> {
  try {
    const data = await storefrontApi.get<{ category: StorefrontCategory; products: StorefrontProduct[] }>(
      `/storefront/categories/${slug}`,
    );
    return data.category;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    return { title: "Category not found" };
  }

  return buildStorefrontMetadata({
    seo: category.seo,
    fallbackTitle: category.name,
    fallbackDescription: category.description,
    path: `/category/${category.slug}`,
    image: category.image_url,
  });
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    await resolveRedirectOrNotFound(`/category/${slug}`);
    throw new Error("unreachable");
  }

  const SITE_URL = await getSiteUrl();
  const url = `${SITE_URL}/category/${category.slug}`;

  return (
    <>
      <JsonLd
        disabled={disabledSchemas(category.seo)}
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          { name: category.name, url },
        ])}
      />
      <CategoryClient slug={slug} />
    </>
  );
}
