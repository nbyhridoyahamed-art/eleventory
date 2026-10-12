"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useReturns } from "@/hooks/use-returns";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OrderReturn, ReturnStatus } from "@/types/return";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  received: "Received",
  refunded: "Refunded",
};

const STATUS_VARIANTS: Record<ReturnStatus, BadgeVariant> = {
  requested: "neutral",
  approved: "info",
  rejected: "danger",
  received: "warning",
  refunded: "success",
};

export default function ReturnsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useReturns(storeId, {
    page,
    status: status !== "all" ? status : null,
  });

  if (currentUser && !can(currentUser, "returns.view")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<OrderReturn>[] = [
    {
      id: "return_number",
      header: "Return #",
      cell: (row) => (
        <Link href={`/dashboard/orders/returns/${row.id}`} className="font-medium text-primary hover:underline">
          {row.return_number}
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
    {
      id: "refund",
      header: "Refund amount",
      cell: (row) => (row.refund_amount !== null ? formatMoney(row.refund_amount, "BDT") : "—"),
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
            icon={<RotateCcw />}
            title="No returns yet"
            description="Returns requested from a delivered order will appear here."
          />
        }
      />
    </div>
  );
}
