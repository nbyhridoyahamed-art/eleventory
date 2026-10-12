"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, Warehouse as WarehouseIcon } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeleteWarehouse, useWarehouses } from "@/hooks/use-warehouses";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { Warehouse } from "@/types/warehouse";

const TYPE_LABELS: Record<string, string> = {
  main: "Main",
  branch: "Branch",
  pickup_point: "Pickup point",
  temporary: "Temporary",
};

export default function WarehousesPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);

  const { data, isLoading } = useWarehouses(storeId, page, search);
  const deleteWarehouse = useDeleteWarehouse();

  if (currentUser && !can(currentUser, "warehouses.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "warehouses.create");
  const canDelete = can(currentUser, "warehouses.delete");

  const columns: DataTableColumn<Warehouse>[] = [
    { id: "name", header: "Name", cell: (w) => <span className="font-medium">{w.name}</span> },
    { id: "code", header: "Code", cell: (w) => w.code },
    { id: "type", header: "Type", cell: (w) => TYPE_LABELS[w.type] },
    {
      id: "status",
      header: "Status",
      cell: (w) => <Badge variant={w.status === "active" ? "success" : "warning"}>{w.status}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (w) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${w.name}`}>
            <Link href={`/dashboard/inventory/warehouses/${w.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button variant="ghost" size="icon" aria-label={`Delete ${w.name}`} onClick={() => setWarehouseToDelete(w)}>
              <Trash2 className="text-danger" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search warehouses..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/inventory/warehouses/new">
              <Plus />
              Add warehouse
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(w) => w.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={<WarehouseIcon />}
            title="No warehouses yet"
            description="Add a warehouse to start tracking stock levels and transfers."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/inventory/warehouses/new">Add warehouse</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(warehouseToDelete)} onOpenChange={(open) => !open && setWarehouseToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete warehouse</DialogTitle>
            <DialogDescription>
              This will permanently remove {warehouseToDelete?.name}. Any recorded stock at this warehouse
              stays in the movement ledger, but this warehouse can no longer be selected. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteWarehouse.isPending}
              onClick={() => {
                if (warehouseToDelete) {
                  deleteWarehouse.mutate(warehouseToDelete.id, {
                    onSuccess: () => setWarehouseToDelete(null),
                  });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
