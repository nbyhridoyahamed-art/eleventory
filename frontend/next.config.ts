import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server (server.js + only the dependencies it needs) for shared hosting.
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    // IndexNow ownership file: /<key>.txt is answered by app/indexnow/[key]/route.ts.
    return [{ source: "/:key([a-f0-9]{32}).txt", destination: "/indexnow/:key" }];
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
