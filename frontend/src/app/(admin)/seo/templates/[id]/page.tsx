"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useSeoTemplate, useUpdateSeoTemplate } from "@/hooks/use-seo-templates";
import { PermissionDenied } from "@/components/permission-denied";
import { SeoTemplateForm } from "@/components/content/seo-template-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";
import { ENTITY_TYPE_LABELS } from "@/types/seo-template";

export default function EditSeoTemplatePage({ params }: PageProps<"/seo/templates/[id]">) {
  const { id } = use(params);
  const templateId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: template, isLoading, isError } = useSeoTemplate(templateId);
  const updateTemplate = useUpdateSeoTemplate(templateId);

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !template) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this SEO template. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {ENTITY_TYPE_LABELS[template.entity_type] ?? template.entity_type}</CardTitle>
      </CardHeader>
      <CardContent>
        <SeoTemplateForm
          storeId={storeId}
          defaultValues={template}
          isPending={updateTemplate.isPending}
          submitLabel="Save changes"
          serverError={updateTemplate.error instanceof ApiError ? updateTemplate.error.message : null}
          onSubmit={(values) =>
            updateTemplate.mutate(values, {
              onSuccess: () => router.push("/seo/templates"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
