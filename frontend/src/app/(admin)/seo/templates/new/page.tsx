"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateSeoTemplate } from "@/hooks/use-seo-templates";
import { PermissionDenied } from "@/components/permission-denied";
import { SeoTemplateForm } from "@/components/content/seo-template-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function NewSeoTemplatePage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createTemplate = useCreateSeoTemplate();

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return <Skeleton className="h-64 w-full max-w-2xl" />;
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Add SEO template</CardTitle>
      </CardHeader>
      <CardContent>
        <SeoTemplateForm
          storeId={storeId}
          isPending={createTemplate.isPending}
          submitLabel="Create template"
          serverError={createTemplate.error instanceof ApiError ? createTemplate.error.message : null}
          onSubmit={(values) =>
            createTemplate.mutate(values, {
              onSuccess: () => router.push("/seo/templates"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
