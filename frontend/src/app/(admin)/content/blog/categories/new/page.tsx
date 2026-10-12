"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateBlogCategory } from "@/hooks/use-blog-categories";
import { PermissionDenied } from "@/components/permission-denied";
import { BlogCategoryForm } from "@/components/content/blog-category-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function NewBlogCategoryPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createCategory = useCreateBlogCategory();

  if (currentUser && !can(currentUser, "blog.manage")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add category</CardTitle>
      </CardHeader>
      <CardContent>
        <BlogCategoryForm
          storeId={storeId}
          isPending={createCategory.isPending}
          submitLabel="Create category"
          serverError={createCategory.error instanceof ApiError ? createCategory.error.message : null}
          onSubmit={(values) =>
            createCategory.mutate(values, {
              onSuccess: () => router.push("/content/blog/categories"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
