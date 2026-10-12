"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePage, useUpdatePage } from "@/hooks/use-pages";
import { PermissionDenied } from "@/components/permission-denied";
import { PageForm } from "@/components/content/page-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditPagePage({ params }: PageProps<"/dashboard/content/pages/[id]">) {
  const { id } = use(params);
  const pageId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: page, isLoading, isError } = usePage(pageId);
  const updatePage = useUpdatePage(pageId);

  if (currentUser && !can(currentUser, "pages.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !page) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this page. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {page.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <PageForm
          storeId={storeId}
          defaultValues={page}
          isPending={updatePage.isPending}
          submitLabel="Save changes"
          serverError={updatePage.error instanceof ApiError ? updatePage.error.message : null}
          onSubmit={(values) =>
            updatePage.mutate(values, {
              onSuccess: () => router.push("/dashboard/content/pages"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
