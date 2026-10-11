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
    return [
      // SEO used to be a tab under Content; it now has its own sidebar entry at /seo.
      { source: "/content/seo", destination: "/seo/overview", permanent: true },
      { source: "/content/seo/:path*", destination: "/seo/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
