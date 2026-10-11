import type { Metadata } from "next";

import { breadcrumbJsonLd, FaqJsonLd, disabledSchemas, JsonLd, productJsonLd } from "@/lib/json-ld";
import { storefrontApi } from "@/lib/storefront-api";
import { buildStorefrontMetadata, resolveRedirectOrNotFound } from "@/lib/storefront-seo";
import { ApiError } from "@/types/api";
import type { StorefrontProductDetail } from "@/types/storefront";
import { ProductDetailClient } from "./product-detail-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function getProduct(slug: string): Promise<StorefrontProductDetail | null> {
  try {
    return await storefrontApi.get<StorefrontProductDetail>(`/storefront/products/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Product not found" };
  }

  return buildStorefrontMetadata({
    seo: product.seo,
    fallbackTitle: product.name,
    fallbackDescription: product.short_description,
    path: `/products/${product.slug}`,
    image: product.images[0]?.url,
  });
}

export default async function ProductDetailPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    await resolveRedirectOrNotFound(`/products/${slug}`);
    throw new Error("unreachable");
  }

  const url = `${SITE_URL}/products/${product.slug}`;

  return (
    <>
      <JsonLd
        disabled={disabledSchemas(product.seo)}
        data={productJsonLd({
          name: product.name,
          description: product.description,
          images: product.images.map((image) => image.url),
          sku: product.sku,
          price: product.price,
          currencyCode: product.currency_code,
          inStock: product.in_stock,
          url,
        })}
      />
      <JsonLd
        disabled={disabledSchemas(product.seo)}
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          ...(product.category ? [{ name: product.category.name, url: `${SITE_URL}/category/${product.category.slug}` }] : []),
          { name: product.name, url },
        ])}
      />
      <FaqJsonLd seo={product.seo} />
      <ProductDetailClient slug={slug} />
    </>
  );
}
