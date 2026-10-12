"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useBlogTag, useUpdateBlogTag } from "@/hooks/use-blog-tags";
import { PermissionDenied } from "@/components/permission-denied";
import { BlogTagForm } from "@/components/content/blog-tag-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditBlogTagPage({ params }: PageProps<"/dashboard/content/blog/tags/[id]">) {
  const { id } = use(params);
  const tagId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: tag, isLoading, isError } = useBlogTag(tagId);
  const updateTag = useUpdateBlogTag(tagId);

  if (currentUser && !can(currentUser, "blog.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !tag) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this tag. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {tag.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <BlogTagForm
          storeId={storeId}
          defaultValues={tag}
          isPending={updateTag.isPending}
          submitLabel="Save changes"
          serverError={updateTag.error instanceof ApiError ? updateTag.error.message : null}
          onSubmit={(values) =>
            updateTag.mutate(values, {
              onSuccess: () => router.push("/dashboard/content/blog/tags"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
