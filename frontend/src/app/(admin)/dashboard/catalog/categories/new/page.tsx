"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import { PermissionDenied } from "@/components/permission-denied";
import { CategoryForm } from "@/components/settings/category-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function NewCategoryPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: categories, isLoading } = useCategories(storeId);
  const createCategory = useCreateCategory();

  if (currentUser && !can(currentUser, "categories.create")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add category</CardTitle>
      </CardHeader>
      <CardContent>
        <CategoryForm
          storeId={storeId}
          parentOptions={categories ?? []}
          isPending={createCategory.isPending}
          submitLabel="Create category"
          serverError={createCategory.error instanceof ApiError ? createCategory.error.message : null}
          onSubmit={(values) =>
            createCategory.mutate(values, {
              onSuccess: () => router.push("/dashboard/catalog/categories"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
