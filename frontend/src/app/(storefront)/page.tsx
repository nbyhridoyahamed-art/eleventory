import type { Metadata } from "next";

import { JsonLd, organizationAndWebsiteJsonLd } from "@/lib/json-ld";
import { getPublicSeo } from "@/lib/seo-settings";
import { StorefrontHomeClient } from "./home-client";

/**
 * The homepage has no entity of its own to carry SEO, so its title,
 * description, social image and structured data come from the SEO section
 * (Site & Homepage tab). Blank fields fall back to the store name so the
 * title is never empty.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { settings, storeName, siteUrl } = await getPublicSeo();
  const home = settings.homepage;

  const title = home.title || storeName;
  const description = home.description || undefined;
  const image = home.og_image || settings.site.default_og_image || undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: siteUrl },
    openGraph: { title, description, url: siteUrl, type: "website", images: image ? [image] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function StorefrontHomePage() {
  const { settings, storeName, siteUrl } = await getPublicSeo();

  return (
    <>
      <JsonLd data={organizationAndWebsiteJsonLd({ name: storeName, url: siteUrl }, settings.schema)} />
      <StorefrontHomeClient />
    </>
  );
}
