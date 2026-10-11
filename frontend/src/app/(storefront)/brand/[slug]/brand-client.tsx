"use client";

import { ShopListing } from "@/components/storefront/shop-listing";

/**
 * The brand page — the same shop listing (filter sidebar, toolbar, product
 * grid) pinned to this brand. Its parent page.tsx is a Server Component that
 * fetches the brand server-side purely to build real <head> metadata and
 * JSON-LD, and to 404 unknown slugs — see ARCHITECTURE.md's "fetch twice,
 * once per side" note.
 */
export function BrandClient({ slug }: { slug: string }) {
  return <ShopListing basePath={`/brand/${slug}`} lockedBrand={slug} />;
}
