import Link from "next/link";

import { SectionHeading } from "@/components/homepage-blocks/section-heading";
import { BlogPostCard } from "@/components/storefront/blog-post-card";
import type { LimitOnlySettings } from "@/types/homepage-block";
import type { StorefrontBlogPostSummary } from "@/types/storefront";

/** Latest posts, with a "View all posts" link so the homepage hands visitors (and link equity) to the blog. */
export function BlogPostsBlock({ settings, posts }: { settings: LimitOnlySettings; posts: StorefrontBlogPostSummary[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="@container space-y-4">
      <SectionHeading title={settings.heading}>
        <Link href="/blog" className="text-sm font-medium text-shop-ink hover:underline">
          View all posts &rarr;
        </Link>
      </SectionHeading>
      <div className="grid grid-cols-1 gap-6 @xl:grid-cols-2 @4xl:grid-cols-3">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
