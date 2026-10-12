import { getPublicSeo } from "@/lib/seo-settings";

/**
 * robots.txt, driven by the SEO section's Technical tab. A route handler
 * rather than Next's robots.ts convention because that one can only emit
 * structured rules — it can't carry a hand-written robots.txt.
 *
 * This one Next.js app serves both the storefront and the admin/account
 * areas on the same domain; those route groups use no URL prefix of their
 * own, so their real top-level segments are disallowed explicitly.
 */
const DISALLOWED_PATHS = [
  "/dashboard",
  "/account",
  "/login",
  "/register",
  "/cart",
  "/checkout",
  "/order-confirmation",
];

export const dynamic = "force-dynamic";

export async function GET() {
  const { settings, siteUrl } = await getPublicSeo();
  const { robots, sitemap } = settings;
  const sitemapLine = `Sitemap: ${siteUrl}/sitemap.xml`;

  let body: string;

  if (robots.mode === "block_all") {
    body = ["User-agent: *", "Disallow: /"].join("\n");
  } else if (robots.mode === "custom" && robots.custom?.trim()) {
    const custom = robots.custom.trim();
    body = /^\s*sitemap:/im.test(custom) || !sitemap.enabled ? custom : `${custom}\n\n${sitemapLine}`;
  } else {
    const disallow = [...DISALLOWED_PATHS, ...robots.extra_disallow.filter((path) => path.startsWith("/"))];
    body = ["User-agent: *", "Allow: /", ...disallow.map((path) => `Disallow: ${path}`), ...(sitemap.enabled ? ["", sitemapLine] : [])].join("\n");
  }

  return new Response(`${body}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
