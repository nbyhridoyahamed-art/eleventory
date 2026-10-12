"use client";

import { useState } from "react";
import { History } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllWarehouses } from "@/hooks/use-warehouses";
import { useStockMovements } from "@/hooks/use-inventory";
import { variantLabel } from "@/lib/variant";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StockMovement, StockMovementType } from "@/types/inventory";

type BadgeVariant = BadgeProps["variant"];

const TYPE_LABELS: Record<StockMovementType, string> = {
  adjustment_increase: "Adjustment (increase)",
  adjustment_decrease: "Adjustment (decrease)",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  purchase_receipt: "Purchase receipt",
  sale: "Sale",
  return: "Return",
};

const TYPE_VARIANTS: Record<StockMovementType, BadgeVariant> = {
  adjustment_increase: "success",
  adjustment_decrease: "warning",
  transfer_in: "success",
  transfer_out: "warning",
  purchase_receipt: "success",
  sale: "warning",
  return: "success",
};

export default function StockMovementsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: warehousesData } = useAllWarehouses(storeId);
  const warehouses = warehousesData?.data ?? [];

  const [page, setPage] = useState(1);
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const { data, isLoading } = useStockMovements(storeId, {
    page,
    warehouseId: warehouseId !== "all" ? Number(warehouseId) : null,
    type: type !== "all" ? type : null,
  });

  if (currentUser && !can(currentUser, "inventory.view")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<StockMovement>[] = [
    {
      id: "product",
      header: "Product",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.product.name}</p>
          <p className="text-xs text-text-muted">{variantLabel(row.product_variant) ?? row.product.sku}</p>
        </div>
      ),
    },
    { id: "warehouse", header: "Warehouse", cell: (row) => row.warehouse.name },
    {
      id: "type",
      header: "Type",
      cell: (row) => <Badge variant={TYPE_VARIANTS[row.type]}>{TYPE_LABELS[row.type]}</Badge>,
    },
    {
      id: "change",
      header: "Change",
      cell: (row) => (
        <span>
          {row.quantity_before} &rarr; {row.quantity_after}
        </span>
      ),
    },
    { id: "reason", header: "Reason", cell: (row) => row.reason ?? "—" },
    { id: "by", header: "By", cell: (row) => row.created_by ?? "—" },
    { id: "when", header: "When", cell: (row) => new Date(row.created_at).toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v); setPage(1); }}>
          <SelectTrigger className="w-48" aria-label="Filter by warehouse">
            <SelectValue placeholder="All warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-56" aria-label="Filter by movement type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            icon={<History />}
            title="No stock movements yet"
            description="Adjustments and transfers will show up here as they happen."
          />
        }
      />
    </div>
  );
}
