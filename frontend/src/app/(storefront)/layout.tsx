import type { Metadata } from "next";

import { AnalyticsPageViewTracker } from "@/components/storefront/analytics-page-view-tracker";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { MobileBottomNav } from "@/components/storefront/mobile-bottom-nav";
import { SeoScripts } from "@/components/storefront/seo-scripts";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { getPublicSeo } from "@/lib/seo-settings";

/**
 * Site-wide SEO that every storefront page inherits: search-engine ownership
 * verification tags and, when the SEO section blocks indexing of the whole
 * site, a noindex directive. Individual pages still set their own title,
 * description and canonical.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getPublicSeo();
  const v = settings.verification;

  const other: Record<string, string> = {};
  if (v.bing) other["msvalidate.01"] = v.bing;
  if (v.pinterest) other["p:domain_verify"] = v.pinterest;
  if (v.facebook) other["facebook-domain-verification"] = v.facebook;
  if (v.baidu) other["baidu-site-verification"] = v.baidu;

  return {
    verification: {
      google: v.google ?? undefined,
      yandex: v.yandex ?? undefined,
      other: Object.keys(other).length > 0 ? other : undefined,
    },
    robots: settings.robots.mode === "block_all" ? { index: false, follow: false } : undefined,
  };
}

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { settings, storeName } = await getPublicSeo();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StorefrontHeader />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
      <MobileBottomNav />
      <CartDrawer />
      <AnalyticsPageViewTracker />
      <SeoScripts settings={settings} siteName={storeName} />
    </div>
  );
}
