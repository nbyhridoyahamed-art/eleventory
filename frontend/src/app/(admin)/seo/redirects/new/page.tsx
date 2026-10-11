"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateRedirect } from "@/hooks/use-redirects";
import { PermissionDenied } from "@/components/permission-denied";
import { RedirectForm } from "@/components/content/redirect-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function NewRedirectPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createRedirect = useCreateRedirect();

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return <Skeleton className="h-64 w-full max-w-2xl" />;
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Add redirect</CardTitle>
      </CardHeader>
      <CardContent>
        <RedirectForm
          storeId={storeId}
          isPending={createRedirect.isPending}
          submitLabel="Create redirect"
          serverError={createRedirect.error instanceof ApiError ? createRedirect.error.message : null}
          onSubmit={(values) =>
            createRedirect.mutate(values, {
              onSuccess: () => router.push("/seo/redirects"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
