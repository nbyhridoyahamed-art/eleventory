import { cache } from "react";

import { serverHeaders } from "@/lib/storefront-api";
import type { SeoSettings } from "@/types/seo-settings";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  site: { site_name: null, default_og_image: null, twitter_handle: null },
  homepage: { title: null, description: null, focus_keyword: null, og_image: null },
  blog: { title: null, description: null, focus_keyword: null, og_image: null },
  robots: { mode: "default", custom: null, extra_disallow: [] },
  sitemap: { enabled: true, products: true, categories: true, brands: true, pages: true, blog: true },
  schema: {
    organization: true,
    website_search: true,
    product: true,
    breadcrumb: true,
    blog: true,
    org_name: null,
    org_logo: null,
    org_phone: null,
    org_email: null,
    org_address: null,
    social_profiles: [],
  },
  verification: { google: null, bing: null, yandex: null, pinterest: null, facebook: null, baidu: null },
  analytics: { ga4_id: null, gtm_id: null, meta_pixel_id: null, clarity_id: null },
  indexnow: { key: null },
};

export interface PublicSeo {
  storeName: string;
  settings: SeoSettings;
  siteUrl: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** How long a saved SEO change can take to show on the storefront. Every page render reads these settings, so they are cached rather than fetched per view. */
const REVALIDATE_SECONDS = 60;

/**
 * The store's SEO configuration for server rendering (metadata, robots,
 * sitemap, JSON-LD, tracking scripts). Memoised per request with React's
 * cache() and cached across requests for a minute with Next's data cache,
 * since every storefront page needs it and the API rate-limits the single
 * address server rendering calls from. Falls back to safe defaults if the
 * API is unreachable so a SEO hiccup never takes a page down.
 */
export const getPublicSeo = cache(async (): Promise<PublicSeo> => {
  try {
    const response = await fetch(`${API_BASE_URL}/storefront/seo-settings`, {
      headers: serverHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = (await response.json()) as { data: { store_name: string; settings: SeoSettings } };

    return { storeName: json.data.store_name, settings: json.data.settings, siteUrl: SITE_URL };
  } catch {
    return { storeName: "Store", settings: DEFAULT_SEO_SETTINGS, siteUrl: SITE_URL };
  }
});
