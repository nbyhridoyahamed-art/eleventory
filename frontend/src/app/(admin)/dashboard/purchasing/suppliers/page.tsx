"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeleteSupplier, useSuppliers } from "@/hooks/use-suppliers";
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
import type { Supplier } from "@/types/supplier";

export default function SuppliersPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const { data, isLoading } = useSuppliers(storeId, page, search);
  const deleteSupplier = useDeleteSupplier();

  if (currentUser && !can(currentUser, "suppliers.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "suppliers.create");
  const canDelete = can(currentUser, "suppliers.delete");

  const columns: DataTableColumn<Supplier>[] = [
    { id: "name", header: "Name", cell: (s) => <span className="font-medium">{s.name}</span> },
    { id: "contact", header: "Contact", cell: (s) => s.contact_name ?? "—" },
    { id: "email", header: "Email", cell: (s) => s.email ?? "—" },
    { id: "orders", header: "Purchase orders", cell: (s) => s.purchase_orders_count ?? 0 },
    {
      id: "status",
      header: "Status",
      cell: (s) => <Badge variant={s.status === "active" ? "success" : "warning"}>{s.status}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${s.name}`}>
            <Link href={`/dashboard/purchasing/suppliers/${s.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => setSupplierToDelete(s)}>
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
          placeholder="Search suppliers..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/purchasing/suppliers/new">
              <Plus />
              Add supplier
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={<Truck />}
            title="No suppliers yet"
            description="Add a supplier before creating your first purchase order."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/purchasing/suppliers/new">Add supplier</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(supplierToDelete)} onOpenChange={(open) => !open && setSupplierToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete supplier</DialogTitle>
            <DialogDescription>
              {supplierToDelete && (supplierToDelete.purchase_orders_count ?? 0) > 0
                ? `${supplierToDelete.purchase_orders_count} purchase order(s) reference this supplier. Deleting it will not delete those orders, but they will keep a record of a now-deleted supplier.`
                : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteSupplier.isPending}
              onClick={() => {
                if (supplierToDelete) {
                  deleteSupplier.mutate(supplierToDelete.id, {
                    onSuccess: () => setSupplierToDelete(null),
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
