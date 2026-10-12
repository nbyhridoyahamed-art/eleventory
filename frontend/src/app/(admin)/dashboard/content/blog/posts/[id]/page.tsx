"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useBlogPost, useUpdateBlogPost } from "@/hooks/use-blog-posts";
import { PermissionDenied } from "@/components/permission-denied";
import { BlogPostForm } from "@/components/content/blog-post-form";
import { BlogPostVersionHistorySheet } from "@/components/content/blog-post-version-history-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditBlogPostPage({ params }: PageProps<"/dashboard/content/blog/posts/[id]">) {
  const { id } = use(params);
  const postId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: post, isLoading, isError } = useBlogPost(postId);
  const updatePost = useUpdateBlogPost(postId);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (currentUser && !can(currentUser, "blog.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !post) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this post. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Edit {post.title}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          <History className="size-3.5" />
          Version history
        </Button>
      </CardHeader>
      <CardContent>
        <BlogPostForm
          storeId={storeId}
          defaultValues={post}
          isPending={updatePost.isPending}
          submitLabel="Save changes"
          serverError={updatePost.error instanceof ApiError ? updatePost.error.message : null}
          onSubmit={(values) =>
            updatePost.mutate(values, {
              onSuccess: () => router.push("/dashboard/content/blog/posts"),
            })
          }
        />
      </CardContent>

      <BlogPostVersionHistorySheet postId={postId} open={historyOpen} onOpenChange={setHistoryOpen} canEdit />
    </Card>
  );
}
