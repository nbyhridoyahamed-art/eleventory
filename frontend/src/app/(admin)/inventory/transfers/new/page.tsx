"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllWarehouses } from "@/hooks/use-warehouses";
import { useAllProducts } from "@/hooks/use-products";
import { useCreateStockTransfer } from "@/hooks/use-inventory";
import { PermissionDenied } from "@/components/permission-denied";
import { StockTransferForm } from "@/components/inventory/stock-transfer-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewStockTransferPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: warehousesData } = useAllWarehouses(storeId);
  const { data: productsData } = useAllProducts(storeId);
  const createTransfer = useCreateStockTransfer();

  if (currentUser && !can(currentUser, "inventory.transfer")) {
    return <PermissionDenied />;
  }

  const warehouses = warehousesData?.data ?? [];
  const products = productsData?.data ?? [];

  if (!storeId) {
    return null;
  }

  if (warehouses.length < 2) {
    return (
      <Alert variant="info">
        <AlertDescription>You need at least two warehouses to create a transfer.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New stock transfer</CardTitle>
      </CardHeader>
      <CardContent>
        <StockTransferForm
          storeId={storeId}
          warehouses={warehouses}
          products={products}
          isPending={createTransfer.isPending}
          serverError={createTransfer.error instanceof ApiError ? createTransfer.error.message : null}
          onSubmit={(values) =>
            createTransfer.mutate(values, {
              onSuccess: (transfer) => router.push(`/inventory/transfers/${transfer.id}`),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
