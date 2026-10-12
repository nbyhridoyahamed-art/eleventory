"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, ClipboardList, SlidersHorizontal, Warehouse as WarehouseIcon } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllWarehouses } from "@/hooks/use-warehouses";
import { useStockLevels } from "@/hooks/use-inventory";
import { PermissionDenied } from "@/components/permission-denied";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StockLevel } from "@/types/inventory";

export default function StockLevelsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: warehousesData, isLoading: warehousesLoading } = useAllWarehouses(storeId);
  const warehouses = warehousesData?.data ?? [];

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [productToAdjust, setProductToAdjust] = useState<StockLevel | null>(null);

  // Default to the oldest "main" warehouse once the list loads (falling
  // back to the oldest warehouse overall if none is marked main yet) —
  // not just warehouses[0], since the API returns them newest-first and
  // the newest warehouse is rarely the one an operator wants to see by
  // default. This is plain derived state, not a sync with an external
  // system, so no effect is needed.
  const oldestFirst = [...warehouses].sort((a, b) => a.id - b.id);
  const defaultWarehouse = oldestFirst.find((w) => w.type === "main") ?? oldestFirst[0];
  const warehouseId = selectedWarehouseId ?? defaultWarehouse?.id ?? null;

  const { data, isLoading } = useStockLevels(storeId, warehouseId, { page, search, lowStockOnly });

  if (currentUser && !can(currentUser, "inventory.view")) {
    return <PermissionDenied />;
  }

  const canAdjust = can(currentUser, "inventory.adjust");

  if (!warehousesLoading && warehouses.length === 0) {
    return (
      <EmptyState
        icon={<WarehouseIcon />}
        title="No warehouses yet"
        description="Add a warehouse before you can track stock levels."
        action={
          can(currentUser, "warehouses.create") ? (
            <Button asChild size="sm">
              <Link href="/dashboard/inventory/warehouses/new">Add warehouse</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  const columns: DataTableColumn<StockLevel>[] = [
    {
      id: "product",
      header: "Product",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.product_name}</p>
          <p className="text-xs text-text-muted">{row.sku}</p>
        </div>
      ),
    },
    { id: "quantity", header: "On hand", cell: (row) => row.quantity },
    { id: "reserved", header: "Reserved", cell: (row) => row.quantity_reserved },
    { id: "available", header: "Available", cell: (row) => row.quantity_available },
    {
      id: "status",
      header: "Status",
      cell: (row) =>
        row.is_low_stock ? (
          <Badge variant="danger">Low stock</Badge>
        ) : row.track_stock ? (
          <Badge variant="success">In stock</Badge>
        ) : (
          <Badge variant="neutral">Not tracked</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        canAdjust ? (
          <Button variant="outline" size="sm" onClick={() => setProductToAdjust(row)}>
            <SlidersHorizontal />
            Adjust
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={warehouseId ? String(warehouseId) : undefined}
            onValueChange={(v) => {
              setSelectedWarehouseId(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52" aria-label="Select warehouse">
              <SelectValue placeholder="Select warehouse">
                {warehouses.find((w) => w.id === warehouseId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <Checkbox
              checked={lowStockOnly}
              onCheckedChange={(checked) => {
                setLowStockOnly(checked === true);
                setPage(1);
              }}
            />
            Low stock only
          </label>
        </div>
        {can(currentUser, "inventory.adjust") && warehouseId ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/inventory/stocktakes/new?warehouse_id=${warehouseId}`}>
              <ClipboardList />
              Start stocktake
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(row) => row.product_id}
        isLoading={isLoading || warehousesLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState icon={<Boxes />} title="No products found" description="Try a different search or filter." />
        }
      />

      {warehouseId ? (
        <StockAdjustmentDialog product={productToAdjust} warehouseId={warehouseId} onClose={() => setProductToAdjust(null)} />
      ) : null}
    </div>
  );
}
