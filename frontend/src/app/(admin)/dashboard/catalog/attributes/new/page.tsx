"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateAttribute } from "@/hooks/use-attributes";
import { PermissionDenied } from "@/components/permission-denied";
import { AttributeForm } from "@/components/catalog/attribute-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewAttributePage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createAttribute = useCreateAttribute();

  if (currentUser && !can(currentUser, "attributes.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add attribute</CardTitle>
      </CardHeader>
      <CardContent>
        <AttributeForm
          storeId={storeId}
          isPending={createAttribute.isPending}
          submitLabel="Create attribute"
          serverError={createAttribute.error instanceof ApiError ? createAttribute.error.message : null}
          onSubmit={(values) =>
            createAttribute.mutate(values, {
              // Straight to the edit page — that's where values get added.
              onSuccess: (attribute) => router.push(`/dashboard/catalog/attributes/${attribute.id}`),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
