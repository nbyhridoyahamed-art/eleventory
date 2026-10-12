"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useBlogCategory, useUpdateBlogCategory } from "@/hooks/use-blog-categories";
import { PermissionDenied } from "@/components/permission-denied";
import { BlogCategoryForm } from "@/components/content/blog-category-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditBlogCategoryPage({ params }: PageProps<"/dashboard/content/blog/categories/[id]">) {
  const { id } = use(params);
  const categoryId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: category, isLoading, isError } = useBlogCategory(categoryId);
  const updateCategory = useUpdateBlogCategory(categoryId);

  if (currentUser && !can(currentUser, "blog.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !category) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this category. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {category.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <BlogCategoryForm
          storeId={storeId}
          defaultValues={category}
          isPending={updateCategory.isPending}
          submitLabel="Save changes"
          serverError={updateCategory.error instanceof ApiError ? updateCategory.error.message : null}
          onSubmit={(values) =>
            updateCategory.mutate(values, {
              onSuccess: () => router.push("/dashboard/content/blog/categories"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
