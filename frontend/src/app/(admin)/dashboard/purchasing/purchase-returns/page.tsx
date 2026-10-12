"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePurchaseReturns } from "@/hooks/use-purchase-returns";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PurchaseReturn, PurchaseReturnStatus } from "@/types/purchase-return";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<PurchaseReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  shipped_back: "Shipped back",
  credited: "Credited",
};

const STATUS_VARIANTS: Record<PurchaseReturnStatus, BadgeVariant> = {
  requested: "neutral",
  approved: "info",
  rejected: "danger",
  shipped_back: "warning",
  credited: "success",
};

export default function PurchaseReturnsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");

  const { data, isLoading } = usePurchaseReturns(storeId, {
    page,
    status: status !== "all" ? status : null,
  });

  if (currentUser && !can(currentUser, "purchase_returns.view")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<PurchaseReturn>[] = [
    {
      id: "return_number",
      header: "Return #",
      cell: (row) => (
        <Link href={`/dashboard/purchasing/purchase-returns/${row.id}`} className="font-medium text-primary hover:underline">
          {row.return_number}
        </Link>
      ),
    },
    {
      id: "purchase_order",
      header: "Purchase order",
      cell: (row) => (
        <Link href={`/dashboard/purchasing/purchase-orders/${row.purchase_order.id}`} className="text-text-primary hover:underline">
          {row.purchase_order.po_number}
        </Link>
      ),
    },
    { id: "supplier", header: "Supplier", cell: (row) => row.purchase_order.supplier_name ?? "—" },
    {
      id: "credit",
      header: "Credit amount",
      cell: (row) => (row.credit_amount !== null ? formatMoney(row.credit_amount, "BDT") : "—"),
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
            title="No purchase returns yet"
            description="Returns requested against a received purchase order will appear here."
          />
        }
      />
    </div>
  );
}
