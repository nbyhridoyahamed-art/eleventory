"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllCustomers } from "@/hooks/use-customers";
import { useAllWarehouses } from "@/hooks/use-warehouses";
import { useAllProducts } from "@/hooks/use-products";
import { useCreateOrder } from "@/hooks/use-orders";
import { PermissionDenied } from "@/components/permission-denied";
import { OrderForm } from "@/components/orders/order-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewOrderPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: customersData } = useAllCustomers(storeId);
  const { data: warehousesData } = useAllWarehouses(storeId);
  const { data: productsData } = useAllProducts(storeId);
  const createOrder = useCreateOrder();

  if (currentUser && !can(currentUser, "orders.create")) {
    return <PermissionDenied />;
  }

  const customers = customersData?.data ?? [];
  const warehouses = warehousesData?.data ?? [];
  const products = productsData?.data ?? [];

  if (!storeId) {
    return null;
  }

  if (customers.length === 0 || warehouses.length === 0 || products.length === 0) {
    return (
      <Alert variant="info">
        <AlertDescription>
          You need at least one customer, one warehouse, and one product to create an order.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New order</CardTitle>
      </CardHeader>
      <CardContent>
        <OrderForm
          storeId={storeId}
          customers={customers}
          warehouses={warehouses}
          products={products}
          isPending={createOrder.isPending}
          submitLabel="Create order"
          serverError={createOrder.error instanceof ApiError ? createOrder.error.message : null}
          onSubmit={(values) =>
            createOrder.mutate(values, {
              onSuccess: (order) => router.push(`/dashboard/orders/orders/${order.id}`),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
