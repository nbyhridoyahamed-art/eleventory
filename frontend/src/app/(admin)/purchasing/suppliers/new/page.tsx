"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateSupplier } from "@/hooks/use-suppliers";
import { PermissionDenied } from "@/components/permission-denied";
import { SupplierForm } from "@/components/purchasing/supplier-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewSupplierPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createSupplier = useCreateSupplier();

  if (currentUser && !can(currentUser, "suppliers.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add supplier</CardTitle>
      </CardHeader>
      <CardContent>
        <SupplierForm
          storeId={storeId}
          isPending={createSupplier.isPending}
          submitLabel="Create supplier"
          serverError={createSupplier.error instanceof ApiError ? createSupplier.error.message : null}
          onSubmit={(values) =>
            createSupplier.mutate(values, {
              onSuccess: () => router.push("/purchasing/suppliers"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
