"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreatePage } from "@/hooks/use-pages";
import { PermissionDenied } from "@/components/permission-denied";
import { PageForm } from "@/components/content/page-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function NewPagePage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createPage = useCreatePage();

  if (currentUser && !can(currentUser, "pages.manage")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add page</CardTitle>
      </CardHeader>
      <CardContent>
        <PageForm
          storeId={storeId}
          isPending={createPage.isPending}
          submitLabel="Create page"
          serverError={createPage.error instanceof ApiError ? createPage.error.message : null}
          onSubmit={(values) =>
            createPage.mutate(values, {
              onSuccess: () => router.push("/content/pages"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
