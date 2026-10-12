"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateBlogPost } from "@/hooks/use-blog-posts";
import { PermissionDenied } from "@/components/permission-denied";
import { BlogPostForm } from "@/components/content/blog-post-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function NewBlogPostPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createPost = useCreateBlogPost();

  if (currentUser && !can(currentUser, "blog.manage")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add post</CardTitle>
      </CardHeader>
      <CardContent>
        <BlogPostForm
          storeId={storeId}
          isPending={createPost.isPending}
          submitLabel="Create post"
          serverError={createPost.error instanceof ApiError ? createPost.error.message : null}
          onSubmit={(values) =>
            createPost.mutate(values, {
              onSuccess: (post) => router.push(`/dashboard/content/blog/posts/${post.id}`),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
