"use client";

import { useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllCouriers } from "@/hooks/use-couriers";
import { useShipments } from "@/hooks/use-shipments";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Shipment, ShipmentStatus } from "@/types/shipment";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending_pickup: "Pending pickup",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  failed_delivery: "Failed delivery",
  returned_to_seller: "Returned to seller",
};

const STATUS_VARIANTS: Record<ShipmentStatus, BadgeVariant> = {
  pending_pickup: "neutral",
  picked_up: "info",
  in_transit: "info",
  delivered: "success",
  failed_delivery: "danger",
  returned_to_seller: "warning",
};

export default function ShipmentsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: couriersData } = useAllCouriers(storeId);
  const couriers = couriersData?.data ?? [];

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [courierId, setCourierId] = useState("all");

  const { data, isLoading } = useShipments(storeId, {
    page,
    status: status !== "all" ? status : null,
    courierId: courierId !== "all" ? Number(courierId) : null,
  });

  if (currentUser && !can(currentUser, "shipments.view")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<Shipment>[] = [
    {
      id: "tracking",
      header: "Tracking #",
      cell: (row) => (
        <Link href={`/dashboard/delivery/shipments/${row.id}`} className="font-medium text-primary hover:underline">
          {row.tracking_number}
        </Link>
      ),
    },
    {
      id: "order",
      header: "Order",
      cell: (row) => (
        <Link href={`/dashboard/orders/orders/${row.order.id}`} className="text-text-primary hover:underline">
          {row.order.order_number}
        </Link>
      ),
    },
    { id: "customer", header: "Customer", cell: (row) => row.order.customer_name ?? "—" },
    { id: "courier", header: "Courier", cell: (row) => row.courier.name },
    {
      id: "cod",
      header: "COD collected",
      cell: (row) => (row.cod_amount_collected !== null ? formatMoney(row.cod_amount_collected, "BDT") : "—"),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter by status">
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
          value={courierId}
          onValueChange={(v) => {
            setCourierId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter by courier">
            <SelectValue placeholder="All couriers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All couriers</SelectItem>
            {couriers.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
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
            icon={<Truck />}
            title="No shipments yet"
            description="Assign a courier to a shipped order to see it here."
          />
        }
      />
    </div>
  );
}
