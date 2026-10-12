"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllSuppliers } from "@/hooks/use-suppliers";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/purchase-order";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  ordered: "Ordered",
  partially_received: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<PurchaseOrderStatus, BadgeVariant> = {
  draft: "neutral",
  pending_approval: "warning",
  ordered: "info",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
};

export default function PurchaseOrdersPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: suppliersData } = useAllSuppliers(storeId);
  const suppliers = suppliersData?.data ?? [];

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [supplierId, setSupplierId] = useState("all");

  const { data, isLoading } = usePurchaseOrders(storeId, {
    page,
    status: status !== "all" ? status : null,
    supplierId: supplierId !== "all" ? Number(supplierId) : null,
  });

  if (currentUser && !can(currentUser, "purchase_orders.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "purchase_orders.create");

  const columns: DataTableColumn<PurchaseOrder>[] = [
    {
      id: "number",
      header: "PO #",
      cell: (row) => (
        <Link href={`/dashboard/purchasing/purchase-orders/${row.id}`} className="font-medium text-primary hover:underline">
          {row.po_number}
        </Link>
      ),
    },
    { id: "supplier", header: "Supplier", cell: (row) => row.supplier.name },
    { id: "warehouse", header: "Warehouse", cell: (row) => row.warehouse.name },
    { id: "items", header: "Items", cell: (row) => row.items.length },
    { id: "total", header: "Total", cell: (row) => formatMoney(row.total_amount, row.currency_code) },
    {
      id: "status",
      header: "Status",
      cell: (row) => <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
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
            value={supplierId}
            onValueChange={(v) => {
              setSupplierId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Filter by supplier">
              <SelectValue placeholder="All suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/purchasing/purchase-orders/new">
              <Plus />
              New purchase order
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
            icon={<ClipboardList />}
            title="No purchase orders yet"
            description="Create a purchase order to start restocking from a supplier."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/purchasing/purchase-orders/new">New purchase order</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
