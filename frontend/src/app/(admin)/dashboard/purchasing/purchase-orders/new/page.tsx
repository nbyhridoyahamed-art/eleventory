"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllWarehouses } from "@/hooks/use-warehouses";
import { useAllSuppliers } from "@/hooks/use-suppliers";
import { useAllProducts } from "@/hooks/use-products";
import { useCreatePurchaseOrder } from "@/hooks/use-purchase-orders";
import { PermissionDenied } from "@/components/permission-denied";
import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewPurchaseOrderPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: warehousesData } = useAllWarehouses(storeId);
  const { data: suppliersData } = useAllSuppliers(storeId);
  const { data: productsData } = useAllProducts(storeId);
  const createOrder = useCreatePurchaseOrder();

  if (currentUser && !can(currentUser, "purchase_orders.create")) {
    return <PermissionDenied />;
  }

  const warehouses = warehousesData?.data ?? [];
  const suppliers = suppliersData?.data ?? [];
  const products = productsData?.data ?? [];

  if (!storeId) {
    return null;
  }

  if (warehouses.length === 0 || suppliers.length === 0) {
    return (
      <Alert variant="info">
        <AlertDescription>You need at least one warehouse and one supplier to create a purchase order.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New purchase order</CardTitle>
      </CardHeader>
      <CardContent>
        <PurchaseOrderForm
          storeId={storeId}
          warehouses={warehouses}
          suppliers={suppliers}
          products={products}
          isPending={createOrder.isPending}
          submitLabel="Create draft"
          serverError={createOrder.error instanceof ApiError ? createOrder.error.message : null}
          onSubmit={(values) =>
            createOrder.mutate(values, {
              onSuccess: (order) => router.push(`/dashboard/purchasing/purchase-orders/${order.id}`),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
