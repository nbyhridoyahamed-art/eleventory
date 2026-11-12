import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server (server.js + only the dependencies it needs) for shared hosting.
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    // IndexNow ownership file: /<key>.txt is answered by app/indexnow/[key]/route.ts.
    const afterFiles = [{ source: "/:key([a-f0-9]{32}).txt", destination: "/indexnow/:key" }];
    const beforeFiles: { source: string; destination: string }[] = [];

    // SaaS platform site: show the marketing landing page at the root instead of a store.
    // Off by default so the live single-store site is unchanged.
    if (process.env.PLATFORM_LANDING === "true") {
      beforeFiles.push({ source: "/", destination: "/platform" });
    }

    return { beforeFiles, afterFiles };
  },
  async redirects() {
    const sections = ["analytics", "catalog", "content", "delivery", "inventory", "orders", "purchasing", "reports", "seo", "settings"];

    return [
      // SEO used to be a tab under Content; it has its own section now.
      { source: "/content/seo", destination: "/dashboard/seo/overview", permanent: true },
      { source: "/content/seo/:path*", destination: "/dashboard/seo/:path*", permanent: true },
      // Admin pages moved under /dashboard; old bookmarks still work.
      ...sections.flatMap((section) => [
        { source: `/${section}`, destination: `/dashboard/${section}`, permanent: true },
        { source: `/${section}/:path*`, destination: `/dashboard/${section}/:path*`, permanent: true },
      ]),
    ];
  },
};

export default nextConfig;
