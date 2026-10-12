"use client";

import { useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, FileText } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useExportLowStockReport, useExportLowStockReportPdf, useLowStockReport } from "@/hooks/use-reports";
import { PermissionDenied } from "@/components/permission-denied";
import { StockOverviewPanel } from "@/components/reports/report-insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import type { LowStockReportRow } from "@/types/report";

export default function LowStockReportPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);

  const { data, isLoading } = useLowStockReport(storeId, page);
  const exportCsv = useExportLowStockReport();
  const exportPdf = useExportLowStockReportPdf();

  if (currentUser && !can(currentUser, "reports.view")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<LowStockReportRow>[] = [
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
    { id: "quantity", header: "On hand", cell: (row) => row.total_quantity },
    { id: "reserved", header: "Reserved", cell: (row) => row.total_reserved },
    { id: "available", header: "Available", cell: (row) => row.total_available },
    { id: "threshold", header: "Threshold", cell: (row) => row.low_stock_threshold },
    {
      id: "status",
      header: "Status",
      cell: () => <Badge variant="danger">Low stock</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <StockOverviewPanel storeId={storeId} />
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" loading={exportCsv.isPending || exportPdf.isPending}>
              <Download />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => storeId && exportCsv.mutate({ storeId })}>
              <FileSpreadsheet />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => storeId && exportPdf.mutate({ storeId })}>
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
          <EmptyState
            icon={<AlertTriangle />}
            title="Nothing is low on stock"
            description="Products at or below their low stock threshold will show up here."
          />
        }
      />
    </div>
  );
}
