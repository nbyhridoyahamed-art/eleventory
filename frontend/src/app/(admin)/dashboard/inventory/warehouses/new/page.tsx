"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateWarehouse } from "@/hooks/use-warehouses";
import { PermissionDenied } from "@/components/permission-denied";
import { WarehouseForm } from "@/components/inventory/warehouse-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewWarehousePage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createWarehouse = useCreateWarehouse();

  if (currentUser && !can(currentUser, "warehouses.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add warehouse</CardTitle>
      </CardHeader>
      <CardContent>
        <WarehouseForm
          storeId={storeId}
          isPending={createWarehouse.isPending}
          submitLabel="Create warehouse"
          serverError={createWarehouse.error instanceof ApiError ? createWarehouse.error.message : null}
          onSubmit={(values) =>
            createWarehouse.mutate(values, {
              onSuccess: () => router.push("/dashboard/inventory/warehouses"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
