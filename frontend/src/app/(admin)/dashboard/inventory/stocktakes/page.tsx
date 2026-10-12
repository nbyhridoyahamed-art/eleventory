"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useStockAdjustmentSessions } from "@/hooks/use-inventory";
import { PermissionDenied } from "@/components/permission-denied";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { StockAdjustmentSession } from "@/types/inventory";

export default function StockAdjustmentSessionsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);

  const { data, isLoading } = useStockAdjustmentSessions(storeId, page);

  if (currentUser && !can(currentUser, "inventory.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "inventory.adjust");

  const columns: DataTableColumn<StockAdjustmentSession>[] = [
    {
      id: "reference",
      header: "Reference",
      cell: (row) => (
        <Link href={`/dashboard/inventory/stocktakes/${row.id}`} className="font-medium text-primary hover:underline">
          {row.reference}
        </Link>
      ),
    },
    { id: "warehouse", header: "Warehouse", cell: (row) => row.warehouse.name },
    { id: "lines", header: "Lines", cell: (row) => row.movements.length },
    { id: "by", header: "By", cell: (row) => row.created_by ?? "—" },
    { id: "when", header: "When", cell: (row) => new Date(row.created_at).toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/inventory/stocktakes/new">
              <Plus />
              New stocktake
            </Link>
          </Button>
        ) : null}
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
            icon={<ClipboardList />}
            title="No stocktakes yet"
            description="Record a physical count and its adjustments together as one session."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/inventory/stocktakes/new">New stocktake</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
