import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import type { Metadata } from "next";

import { storefrontApi } from "@/lib/storefront-api";
import type { Seo } from "@/types/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface RedirectLookupResult {
  to_path: string;
  status_code: number;
}

/**
 * Checked only when a leaf page's own by-slug lookup already 404s — never as
 * global middleware, so a normal request never pays for a redirects-table
 * lookup it doesn't need. The App Router's redirect()/permanentRedirect()
 * only ever emit 307/308 (see Next's own redirect() docs on why), so a
 * stored 301/302 maps to the closest of the two rather than being dropped.
 */
export async function resolveRedirectOrNotFound(path: string): Promise<never> {
  const match = await storefrontApi
    .get<RedirectLookupResult>(`/storefront/redirects/lookup?path=${encodeURIComponent(path)}`)
    .catch(() => null);

  if (match) {
    if (match.status_code === 301 || match.status_code === 308) {
      permanentRedirect(match.to_path);
    }
    redirect(match.to_path);
  }

  // Record the miss for the SEO 404 monitor; never let logging break the 404 itself.
  try {
    const referrer = (await headers()).get("referer");
    await storefrontApi.post("/storefront/seo/not-found", { path, referrer });
  } catch {
    // ignore
  }

  notFound();
}

interface BuildStorefrontMetadataOptions {
  seo: Seo | null | undefined;
  fallbackTitle: string;
  fallbackDescription?: string | null;
  path: string;
  image?: string | null;
}

/** Falls back to the entity's own name/excerpt when it has no SEO override — never a blank title. */
export function buildStorefrontMetadata({
  seo,
  fallbackTitle,
  fallbackDescription,
  path,
  image,
}: BuildStorefrontMetadataOptions): Metadata {
  const title = seo?.title || fallbackTitle;
  const description = seo?.description || fallbackDescription || undefined;
  const canonical = seo?.canonical_url || `${SITE_URL}${path}`;
  const ogImage = seo?.og_image || image || undefined;
  const twitterImage = seo?.twitter_image || ogImage;

  return {
    title,
    description,
    alternates: { canonical },
    robots: seo?.robots || undefined,
    openGraph: {
      title: seo?.og_title || title,
      description: seo?.og_description || description,
      url: canonical,
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: seo?.twitter_title || title,
      description: seo?.twitter_description || description,
      images: twitterImage ? [twitterImage] : undefined,
    },
  };
}
