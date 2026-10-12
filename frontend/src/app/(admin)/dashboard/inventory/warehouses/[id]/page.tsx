"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useUpdateWarehouse, useWarehouse } from "@/hooks/use-warehouses";
import { PermissionDenied } from "@/components/permission-denied";
import { WarehouseForm } from "@/components/inventory/warehouse-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditWarehousePage({ params }: PageProps<"/dashboard/inventory/warehouses/[id]">) {
  const { id } = use(params);
  const warehouseId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: warehouse, isLoading, isError } = useWarehouse(warehouseId);
  const updateWarehouse = useUpdateWarehouse(warehouseId);

  if (currentUser && !can(currentUser, "warehouses.update")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !warehouse) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this warehouse. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {warehouse.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <WarehouseForm
          storeId={storeId}
          defaultValues={warehouse}
          isPending={updateWarehouse.isPending}
          submitLabel="Save changes"
          serverError={updateWarehouse.error instanceof ApiError ? updateWarehouse.error.message : null}
          onSubmit={(values) =>
            updateWarehouse.mutate(values, {
              onSuccess: () => router.push("/dashboard/inventory/warehouses"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
