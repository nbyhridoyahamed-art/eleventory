import type { Metadata } from "next";

import { breadcrumbJsonLd, disabledSchemas, JsonLd } from "@/lib/json-ld";
import { storefrontApi } from "@/lib/storefront-api";
import { buildStorefrontMetadata, resolveRedirectOrNotFound } from "@/lib/storefront-seo";
import { ApiError } from "@/types/api";
import type { StorefrontBrand, StorefrontProduct } from "@/types/storefront";
import { BrandClient } from "./brand-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function getBrand(slug: string): Promise<StorefrontBrand | null> {
  try {
    const data = await storefrontApi.get<{ brand: StorefrontBrand; products: StorefrontProduct[] }>(
      `/storefront/brands/${slug}`,
    );
    return data.brand;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/brand/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug);

  if (!brand) {
    return { title: "Brand not found" };
  }

  return buildStorefrontMetadata({
    seo: brand.seo,
    fallbackTitle: brand.name,
    fallbackDescription: brand.description,
    path: `/brand/${brand.slug}`,
    image: brand.logo_url,
  });
}

export default async function BrandPage({ params }: PageProps<"/brand/[slug]">) {
  const { slug } = await params;
  const brand = await getBrand(slug);

  if (!brand) {
    await resolveRedirectOrNotFound(`/brand/${slug}`);
    throw new Error("unreachable");
  }

  const url = `${SITE_URL}/brand/${brand.slug}`;

  return (
    <>
      <JsonLd
        disabled={disabledSchemas(brand.seo)}
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          { name: brand.name, url },
        ])}
      />
      <BrandClient slug={slug} />
    </>
  );
}
