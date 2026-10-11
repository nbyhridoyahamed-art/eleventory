import type { Metadata } from "next";

import { breadcrumbJsonLd, FaqJsonLd, disabledSchemas, JsonLd } from "@/lib/json-ld";
import { storefrontApi } from "@/lib/storefront-api";
import { buildStorefrontMetadata, resolveRedirectOrNotFound } from "@/lib/storefront-seo";
import { ApiError } from "@/types/api";
import type { StorefrontPage } from "@/types/storefront";
import { StorefrontPageClient } from "./storefront-page-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function getPage(slug: string): Promise<StorefrontPage | null> {
  try {
    return await storefrontApi.get<StorefrontPage>(`/storefront/pages/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/pages/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) {
    return { title: "Page not found" };
  }

  return buildStorefrontMetadata({
    seo: page.seo,
    fallbackTitle: page.title,
    path: `/pages/${page.slug}`,
  });
}

export default async function StorefrontPageDetail({ params }: PageProps<"/pages/[slug]">) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) {
    await resolveRedirectOrNotFound(`/pages/${slug}`);
    throw new Error("unreachable");
  }

  const url = `${SITE_URL}/pages/${page.slug}`;

  return (
    <>
      <JsonLd
        disabled={disabledSchemas(page.seo)}
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          { name: page.title, url },
        ])}
      />
      <FaqJsonLd seo={page.seo} />
      <StorefrontPageClient slug={slug} />
    </>
  );
}
