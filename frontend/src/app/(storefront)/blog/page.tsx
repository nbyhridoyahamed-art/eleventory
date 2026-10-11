import type { Metadata } from "next";

import { blogJsonLd, breadcrumbJsonLd, JsonLd } from "@/lib/json-ld";
import { getPublicSeo } from "@/lib/seo-settings";
import { storefrontApi } from "@/lib/storefront-api";
import type { StorefrontBlogPostSummary } from "@/types/storefront";
import { BlogIndexClient } from "./blog-index-client";

/**
 * The blog landing page's title, description and image come from the SEO
 * section (Site & Homepage tab), so it can be optimised separately from the
 * individual posts. Blank fields fall back to "Blog | <store>".
 */
export async function generateMetadata(): Promise<Metadata> {
  const { settings, storeName, siteUrl } = await getPublicSeo();
  const blog = settings.blog;

  const title = blog.title || `Blog | ${storeName}`;
  const description = blog.description || `News, guides and updates from ${storeName}.`;
  const image = blog.og_image || settings.site.default_og_image || undefined;
  const url = `${siteUrl}/blog`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", images: image ? [image] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function BlogPage() {
  const { settings, storeName, siteUrl } = await getPublicSeo();
  const posts = await storefrontApi
    .get<StorefrontBlogPostSummary[]>("/storefront/blog?per_page=10")
    .catch(() => [] as StorefrontBlogPostSummary[]);

  const blog = settings.blog;

  return (
    <>
      <JsonLd
        data={blogJsonLd({
          name: blog.title || `${storeName} Blog`,
          description: blog.description,
          url: `${siteUrl}/blog`,
          posts: posts.map((post) => ({
            title: post.title,
            url: `${siteUrl}/blog/${post.slug}`,
            datePublished: post.published_at,
          })),
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: siteUrl },
          { name: "Blog", url: `${siteUrl}/blog` },
        ])}
      />
      <BlogIndexClient />
    </>
  );
}
