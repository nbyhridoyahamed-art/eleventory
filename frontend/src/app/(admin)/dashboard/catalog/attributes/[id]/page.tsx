"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAttribute, useUpdateAttribute } from "@/hooks/use-attributes";
import { PermissionDenied } from "@/components/permission-denied";
import { AttributeForm } from "@/components/catalog/attribute-form";
import { AttributeValuesManager } from "@/components/catalog/attribute-values-manager";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditAttributePage({ params }: PageProps<"/dashboard/catalog/attributes/[id]">) {
  const { id } = use(params);
  const attributeId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: attribute, isLoading, isError } = useAttribute(attributeId);
  const updateAttribute = useUpdateAttribute(attributeId);

  if (currentUser && !can(currentUser, "attributes.update")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !attribute) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this attribute. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/catalog/attributes">
          <ArrowLeft />
          Back to attributes
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit {attribute.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <AttributeForm
            storeId={storeId}
            defaultValues={attribute}
            isPending={updateAttribute.isPending}
            submitLabel="Save changes"
            serverError={updateAttribute.error instanceof ApiError ? updateAttribute.error.message : null}
            onSubmit={(values) => updateAttribute.mutate(values)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Values</CardTitle>
        </CardHeader>
        <CardContent>
          <AttributeValuesManager
            attributeId={attribute.id}
            values={attribute.values}
            canEdit={can(currentUser, "attributes.update")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
