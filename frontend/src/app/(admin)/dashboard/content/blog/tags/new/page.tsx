"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateBlogTag } from "@/hooks/use-blog-tags";
import { PermissionDenied } from "@/components/permission-denied";
import { BlogTagForm } from "@/components/content/blog-tag-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function NewBlogTagPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createTag = useCreateBlogTag();

  if (currentUser && !can(currentUser, "blog.manage")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add tag</CardTitle>
      </CardHeader>
      <CardContent>
        <BlogTagForm
          storeId={storeId}
          isPending={createTag.isPending}
          submitLabel="Create tag"
          serverError={createTag.error instanceof ApiError ? createTag.error.message : null}
          onSubmit={(values) =>
            createTag.mutate(values, {
              onSuccess: () => router.push("/dashboard/content/blog/tags"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
