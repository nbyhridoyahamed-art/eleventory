"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCouriers, useDeleteCourier } from "@/hooks/use-couriers";
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
import type { Courier } from "@/types/courier";

export default function CouriersPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [courierToDelete, setCourierToDelete] = useState<Courier | null>(null);

  const { data, isLoading } = useCouriers(storeId, page, search);
  const deleteCourier = useDeleteCourier();

  if (currentUser && !can(currentUser, "couriers.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "couriers.create");
  const canDelete = can(currentUser, "couriers.delete");

  const columns: DataTableColumn<Courier>[] = [
    { id: "name", header: "Name", cell: (c) => <span className="font-medium">{c.name}</span> },
    { id: "contact", header: "Contact", cell: (c) => c.contact_name ?? "—" },
    { id: "phone", header: "Phone", cell: (c) => c.phone ?? "—" },
    { id: "shipments", header: "Shipments", cell: (c) => c.shipments_count ?? 0 },
    {
      id: "status",
      header: "Status",
      cell: (c) => <Badge variant={c.status === "active" ? "success" : "warning"}>{c.status}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${c.name}`}>
            <Link href={`/dashboard/delivery/couriers/${c.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setCourierToDelete(c)}>
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
          placeholder="Search couriers..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/delivery/couriers/new">
              <Plus />
              Add courier
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={<Truck />}
            title="No couriers yet"
            description="Add a courier before assigning shipments to it."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/delivery/couriers/new">Add courier</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(courierToDelete)} onOpenChange={(open) => !open && setCourierToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete courier</DialogTitle>
            <DialogDescription>
              {courierToDelete && (courierToDelete.shipments_count ?? 0) > 0
                ? `${courierToDelete.shipments_count} shipment(s) reference this courier. Deleting it will not delete those shipments, but they will keep a record of a now-deleted courier.`
                : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourierToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteCourier.isPending}
              onClick={() => {
                if (courierToDelete) {
                  deleteCourier.mutate(courierToDelete.id, {
                    onSuccess: () => setCourierToDelete(null),
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
