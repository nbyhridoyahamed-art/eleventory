"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Package } from "lucide-react";

import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllWarehouses } from "@/hooks/use-warehouses";
import {
  useExportProductPerformance,
  useExportProductPerformancePdf,
  useProductPerformance,
} from "@/hooks/use-reports";
import { PermissionDenied } from "@/components/permission-denied";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductPerformanceRow } from "@/types/report";

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export default function ProductPerformanceReportPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: warehousesData } = useAllWarehouses(storeId);
  const warehouses = warehousesData?.data ?? [];

  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const filters = { dateFrom: dateRange.from, dateTo: dateRange.to, warehouseId };
  const { data, isLoading } = useProductPerformance(storeId, filters, page);
  const exportCsv = useExportProductPerformance();
  const exportPdf = useExportProductPerformancePdf();

  if (currentUser && !can(currentUser, "reports.view")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<ProductPerformanceRow>[] = [
    {
      id: "product",
      header: "Product",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-text-muted">{row.sku}</p>
        </div>
      ),
    },
    { id: "units", header: "Units sold", cell: (row) => row.units_sold },
    { id: "revenue", header: "Revenue", cell: (row) => formatMoney(row.revenue_amount, "BDT") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="From date"
            value={dateRange.from}
            max={dateRange.to}
            onChange={(event) => {
              setDateRange((prev) => ({ ...prev, from: event.target.value }));
              setPage(1);
            }}
            className="w-40"
          />
          <span className="text-sm text-text-muted">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={dateRange.to}
            min={dateRange.from}
            onChange={(event) => {
              setDateRange((prev) => ({ ...prev, to: event.target.value }));
              setPage(1);
            }}
            className="w-40"
          />
          <Select
            value={warehouseId ? String(warehouseId) : "all"}
            onValueChange={(value) => {
              setWarehouseId(value === "all" ? null : Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by warehouse">
              <SelectValue placeholder="All warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" loading={exportCsv.isPending || exportPdf.isPending}>
              <Download />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => storeId && exportCsv.mutate({ storeId, filters })}>
              <FileSpreadsheet />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => storeId && exportPdf.mutate({ storeId, filters })}>
              <FileText />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(row) => row.product_id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState icon={<Package />} title="No sales in range" description="Try a different date range or warehouse." />
        }
      />
    </div>
  );
}
