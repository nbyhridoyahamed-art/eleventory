"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useRedirect, useUpdateRedirect } from "@/hooks/use-redirects";
import { PermissionDenied } from "@/components/permission-denied";
import { RedirectForm } from "@/components/content/redirect-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditRedirectPage({ params }: PageProps<"/dashboard/seo/redirects/[id]">) {
  const { id } = use(params);
  const redirectId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: redirect, isLoading, isError } = useRedirect(redirectId);
  const updateRedirect = useUpdateRedirect(redirectId);

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !redirect) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this redirect. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {redirect.from_path}</CardTitle>
      </CardHeader>
      <CardContent>
        <RedirectForm
          storeId={storeId}
          defaultValues={redirect}
          isPending={updateRedirect.isPending}
          submitLabel="Save changes"
          serverError={updateRedirect.error instanceof ApiError ? updateRedirect.error.message : null}
          onSubmit={(values) =>
            updateRedirect.mutate(values, {
              onSuccess: () => router.push("/dashboard/seo/redirects"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
