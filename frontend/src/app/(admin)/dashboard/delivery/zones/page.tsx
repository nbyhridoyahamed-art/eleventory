"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeleteDeliveryZone, useDeliveryZones } from "@/hooks/use-delivery-zones";
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
import type { DeliveryZone } from "@/types/delivery-zone";

function coverage(zone: DeliveryZone): string {
  if (!zone.bd_division_id) {
    return "Store default (all other locations)";
  }

  return zone.bd_district_id ? `${zone.district_name}, ${zone.division_name}` : `All of ${zone.division_name}`;
}

export default function DeliveryZonesPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);
  const [zoneToDelete, setZoneToDelete] = useState<DeliveryZone | null>(null);

  const { data, isLoading } = useDeliveryZones(storeId, page);
  const deleteZone = useDeleteDeliveryZone();

  if (currentUser && !can(currentUser, "delivery_zones.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "delivery_zones.create");
  const canDelete = can(currentUser, "delivery_zones.delete");

  const columns: DataTableColumn<DeliveryZone>[] = [
    { id: "name", header: "Name", cell: (z) => <span className="font-medium">{z.name}</span> },
    { id: "coverage", header: "Coverage", cell: (z) => coverage(z) },
    {
      id: "rate",
      header: "Base rate",
      cell: (z) => {
        const base = z.rates.find((r) => r.min_order_subtotal === 0) ?? z.rates[0];
        if (!base) {
          return "—";
        }

        return z.rates.length > 1
          ? `${formatMoney(base.rate_amount, base.currency_code)} (+${z.rates.length - 1} tier${z.rates.length > 2 ? "s" : ""})`
          : formatMoney(base.rate_amount, base.currency_code);
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (z) => <Badge variant={z.status === "active" ? "success" : "warning"}>{z.status}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (z) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${z.name}`}>
            <Link href={`/dashboard/delivery/zones/${z.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button variant="ghost" size="icon" aria-label={`Delete ${z.name}`} onClick={() => setZoneToDelete(z)}>
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
        <p className="text-sm text-text-secondary">
          Shipping charges are calculated automatically from the matching zone — most specific location wins.
        </p>
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/delivery/zones/new">
              <Plus />
              Add zone
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(z) => z.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={<MapPin />}
            title="No delivery zones yet"
            description="Without a zone, checkout and the order form treat shipping as free/manual, same as before."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/delivery/zones/new">Add zone</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(zoneToDelete)} onOpenChange={(open) => !open && setZoneToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete delivery zone</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteZone.isPending}
              onClick={() => {
                if (zoneToDelete) {
                  deleteZone.mutate(zoneToDelete.id, {
                    onSuccess: () => setZoneToDelete(null),
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
