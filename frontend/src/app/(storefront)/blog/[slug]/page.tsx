import type { Metadata } from "next";

import { articleJsonLd, breadcrumbJsonLd, FaqJsonLd, disabledSchemas, JsonLd } from "@/lib/json-ld";
import { storefrontApi } from "@/lib/storefront-api";
import { buildStorefrontMetadata, resolveRedirectOrNotFound } from "@/lib/storefront-seo";
import { ApiError } from "@/types/api";
import type { StorefrontBlogPostDetail, StorefrontBlogPostSummary } from "@/types/storefront";
import { BlogPostClient } from "./blog-post-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function getBlogPost(slug: string): Promise<StorefrontBlogPostDetail | null> {
  try {
    const data = await storefrontApi.get<{
      post: StorefrontBlogPostDetail;
      related_posts: StorefrontBlogPostSummary[];
    }>(`/storefront/blog/${slug}`);
    return data.post;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return { title: "Post not found" };
  }

  return buildStorefrontMetadata({
    seo: post.seo,
    fallbackTitle: post.title,
    fallbackDescription: post.excerpt,
    path: `/blog/${post.slug}`,
    image: post.featured_image_url,
  });
}

export default async function BlogPostDetailPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    await resolveRedirectOrNotFound(`/blog/${slug}`);
    throw new Error("unreachable");
  }

  const url = `${SITE_URL}/blog/${post.slug}`;

  return (
    <>
      <JsonLd
        disabled={disabledSchemas(post.seo)}
        data={articleJsonLd({
          headline: post.title,
          description: post.excerpt,
          image: post.featured_image_url,
          datePublished: post.published_at,
          url,
        })}
      />
      <JsonLd
        disabled={disabledSchemas(post.seo)}
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          ...(post.category
            ? [{ name: post.category.name, url: `${SITE_URL}/blog/category/${post.category.slug}` }]
            : []),
          { name: post.title, url },
        ])}
      />
      <FaqJsonLd seo={post.seo} />
      <BlogPostClient slug={slug} />
    </>
  );
}
