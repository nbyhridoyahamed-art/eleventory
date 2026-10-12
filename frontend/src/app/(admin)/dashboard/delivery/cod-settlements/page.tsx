"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, Plus } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllCouriers } from "@/hooks/use-couriers";
import { useCodSettlements } from "@/hooks/use-cod-settlements";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CodSettlement } from "@/types/cod-settlement";

export default function CodSettlementsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: couriersData } = useAllCouriers(storeId);
  const couriers = couriersData?.data ?? [];

  const [page, setPage] = useState(1);
  const [courierId, setCourierId] = useState("all");

  const { data, isLoading } = useCodSettlements(storeId, page, courierId !== "all" ? Number(courierId) : null);

  if (currentUser && !can(currentUser, "cod_settlements.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "cod_settlements.create");

  const columns: DataTableColumn<CodSettlement>[] = [
    {
      id: "number",
      header: "Settlement #",
      cell: (row) => (
        <Link href={`/dashboard/delivery/cod-settlements/${row.id}`} className="font-medium text-primary hover:underline">
          {row.settlement_number}
        </Link>
      ),
    },
    { id: "courier", header: "Courier", cell: (row) => row.courier.name },
    { id: "shipments", header: "Shipments", cell: (row) => row.shipments.length },
    { id: "expected", header: "Expected", cell: (row) => formatMoney(row.amount_expected, "BDT") },
    { id: "received", header: "Received", cell: (row) => formatMoney(row.amount_received, "BDT") },
    { id: "when", header: "Recorded", cell: (row) => new Date(row.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/delivery/cod-settlements/new">
              <Plus />
              Record settlement
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
            icon={<Banknote />}
            title="No COD settlements yet"
            description="Record a settlement once a courier remits collected cash."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/delivery/cod-settlements/new">Record settlement</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
