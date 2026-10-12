"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllWarehouses } from "@/hooks/use-warehouses";
import { useAllProducts } from "@/hooks/use-products";
import { useCreateStockAdjustmentSession } from "@/hooks/use-inventory";
import { PermissionDenied } from "@/components/permission-denied";
import { StockAdjustmentSessionForm } from "@/components/inventory/stock-adjustment-session-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewStockAdjustmentSessionPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultWarehouseId = searchParams.get("warehouse_id") ? Number(searchParams.get("warehouse_id")) : null;
  const { data: warehousesData } = useAllWarehouses(storeId);
  const { data: productsData } = useAllProducts(storeId);
  const createSession = useCreateStockAdjustmentSession();

  if (currentUser && !can(currentUser, "inventory.adjust")) {
    return <PermissionDenied />;
  }

  const warehouses = warehousesData?.data ?? [];
  const products = productsData?.data ?? [];

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New stocktake</CardTitle>
      </CardHeader>
      <CardContent>
        <StockAdjustmentSessionForm
          storeId={storeId}
          warehouses={warehouses}
          products={products}
          defaultWarehouseId={defaultWarehouseId}
          isPending={createSession.isPending}
          serverError={createSession.error instanceof ApiError ? createSession.error.message : null}
          onSubmit={(values) =>
            createSession.mutate(values, {
              onSuccess: (session) => router.push(`/dashboard/inventory/stocktakes/${session.id}`),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
