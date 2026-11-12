import { cache } from "react";

import { serverHeaders } from "@/lib/storefront-api";
import { getStoreHost } from "@/lib/store-host";
import type { PublicTheme } from "@/types/theme";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Same freshness as the SEO settings: a published theme shows within a minute. */
const REVALIDATE_SECONDS = 60;

export const DEFAULT_THEME: PublicTheme = { vars: {}, font_stack: null, topbar: true, custom_css: null, logo_url: null, favicon_url: null };

/**
 * The store's published theme for server rendering. Falls back to the built-in look if the API is
 * unreachable, so a theme hiccup can never take a page down.
 */
export const getPublicTheme = cache(async (): Promise<PublicTheme> => {
  const host = await getStoreHost();

  try {
    // Host in the URL: Next's data cache must never hand one store's theme to another store.
    const query = host ? `?host=${encodeURIComponent(host)}` : "";
    const response = await fetch(`${API_BASE_URL}/storefront/theme${query}`, {
      headers: await serverHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return ((await response.json()) as { data: PublicTheme }).data;
  } catch {
    return DEFAULT_THEME;
  }
});
