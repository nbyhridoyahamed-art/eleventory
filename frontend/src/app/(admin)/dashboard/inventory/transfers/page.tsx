"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useStockTransfers } from "@/hooks/use-inventory";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StockTransfer, StockTransferStatus } from "@/types/inventory";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<StockTransferStatus, string> = {
  pending: "Pending",
  in_transit: "In transit",
  received: "Received",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<StockTransferStatus, BadgeVariant> = {
  pending: "neutral",
  in_transit: "info",
  received: "success",
  cancelled: "danger",
};

export default function StockTransfersPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useStockTransfers(storeId, page, null, status !== "all" ? status : null);

  if (currentUser && !can(currentUser, "inventory.transfer")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<StockTransfer>[] = [
    {
      id: "number",
      header: "Transfer #",
      cell: (row) => (
        <Link href={`/dashboard/inventory/transfers/${row.id}`} className="font-medium text-primary hover:underline">
          {row.transfer_number}
        </Link>
      ),
    },
    { id: "from", header: "From", cell: (row) => row.from_warehouse.name },
    { id: "to", header: "To", cell: (row) => row.to_warehouse.name },
    { id: "items", header: "Items", cell: (row) => row.items.length },
    {
      id: "status",
      header: "Status",
      cell: (row) => <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
    },
    { id: "by", header: "By", cell: (row) => row.created_by ?? "—" },
    { id: "when", header: "When", cell: (row) => new Date(row.created_at).toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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

        <Button asChild>
          <Link href="/dashboard/inventory/transfers/new">
            <Plus />
            New transfer
          </Link>
        </Button>
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
            icon={<ArrowLeftRight />}
            title="No transfers yet"
            description="Move stock between warehouses and it'll show up here."
            action={
              <Button asChild size="sm">
                <Link href="/dashboard/inventory/transfers/new">New transfer</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
