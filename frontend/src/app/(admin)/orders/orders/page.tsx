"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ShoppingCart, Truck } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllCustomers } from "@/hooks/use-customers";
import { useOrders } from "@/hooks/use-orders";
import { useSyncCourierStatus } from "@/hooks/use-shipments";
import { formatMoney } from "@/lib/money";
import { SendToCourierDialog } from "@/components/orders/send-to-courier-dialog";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Order, OrderStatus } from "@/types/order";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  pending: "neutral",
  processing: "info",
  shipped: "warning",
  delivered: "success",
  cancelled: "danger",
};

export default function OrdersPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: customersData } = useAllCustomers(storeId);
  const customers = customersData?.data ?? [];

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [customerId, setCustomerId] = useState("all");
  const [courierOrder, setCourierOrder] = useState<Order | null>(null);
  const syncCourier = useSyncCourierStatus();

  const { data, isLoading } = useOrders(storeId, {
    page,
    status: status !== "all" ? status : null,
    customerId: customerId !== "all" ? Number(customerId) : null,
  });

  if (currentUser && !can(currentUser, "orders.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "orders.create");
  const canShip = can(currentUser, "shipments.create");

  const columns: DataTableColumn<Order>[] = [
    {
      id: "number",
      header: "Order #",
      cell: (row) => (
        <Link href={`/orders/orders/${row.id}`} className="font-medium text-primary hover:underline">
          {row.order_number}
        </Link>
      ),
    },
    {
      id: "source",
      header: "Source",
      cell: (row) => (
        <Badge variant={row.source === "storefront" ? "info" : "neutral"}>
          {row.source === "storefront" ? "Storefront" : "Admin"}
        </Badge>
      ),
    },
    { id: "customer", header: "Customer", cell: (row) => row.customer.name },
    { id: "warehouse", header: "Warehouse", cell: (row) => row.warehouse.name },
    { id: "items", header: "Items", cell: (row) => row.items.length },
    { id: "total", header: "Total", cell: (row) => formatMoney(row.total_amount, row.currency_code) },
    {
      id: "status",
      header: "Status",
      cell: (row) => <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
    },
    {
      id: "courier",
      header: "Courier",
      cell: (row) => {
        const shipment = row.shipments?.[0];
        const active = shipment && !["failed_delivery", "returned_to_seller"].includes(shipment.status) ? shipment : null;

        if (active) {
          return (
            <div className="text-xs leading-snug">
              <p className="font-medium text-text-primary">{active.courier_name ?? "Courier"}</p>
              <p className="text-text-muted">{active.tracking_number}</p>
              {active.courier_status ? (
                <p className="text-text-muted">
                  {active.courier_status.replace(/_/g, " ")}
                  {active.courier_provider === "steadfast" ? (
                    <button
                      type="button"
                      className="ml-1.5 text-primary hover:underline"
                      onClick={() => syncCourier.mutate(active.id)}
                    >
                      Refresh
                    </button>
                  ) : null}
                </p>
              ) : null}
            </div>
          );
        }

        if (!canShip || row.status === "cancelled" || row.status === "delivered") {
          return shipment ? <span className="text-xs text-text-muted">Re-dispatch from order</span> : <span className="text-text-muted">—</span>;
        }

        return (
          <Button type="button" size="sm" variant="outline" onClick={() => setCourierOrder(row)}>
            <Truck />
            Send to courier
          </Button>
        );
      },
    },
    { id: "when", header: "Created", cell: (row) => new Date(row.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={customerId}
            onValueChange={(v) => {
              setCustomerId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Filter by customer">
              <SelectValue placeholder="All customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/orders/orders/new">
              <Plus />
              New order
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={<ShoppingCart />}
            title="No orders yet"
            description="Create an order to start selling to your customers."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/orders/orders/new">New order</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <SendToCourierDialog order={courierOrder} storeId={storeId} onClose={() => setCourierOrder(null)} />
    </div>
  );
}
