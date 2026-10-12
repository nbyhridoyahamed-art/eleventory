"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, PackageSearch } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useExportReorderSuggestions,
  useExportReorderSuggestionsPdf,
  useReorderSuggestions,
} from "@/hooks/use-reports";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
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
import type { ReorderSuggestionRow } from "@/types/report";

export default function ReorderSuggestionsReportPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);

  const { data, isLoading } = useReorderSuggestions(storeId, page);
  const exportCsv = useExportReorderSuggestions();
  const exportPdf = useExportReorderSuggestionsPdf();

  if (currentUser && !can(currentUser, "reports.view")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<ReorderSuggestionRow>[] = [
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
    { id: "available", header: "Available", cell: (row) => row.available_quantity },
    { id: "threshold", header: "Threshold", cell: (row) => row.low_stock_threshold },
    { id: "velocity", header: "Avg. daily sales", cell: (row) => row.avg_daily_sales },
    {
      id: "suggested",
      header: "Suggested reorder",
      cell: (row) => <Badge variant="warning">{row.suggested_reorder_quantity}</Badge>,
    },
    { id: "supplier", header: "Last supplier", cell: (row) => row.last_supplier?.name ?? "—" },
    {
      id: "cost",
      header: "Last unit cost",
      cell: (row) => (row.last_unit_cost !== null ? formatMoney(row.last_unit_cost, "BDT") : "—"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          Every product at or below its low-stock threshold, with a reorder quantity suggested from the last 30 days
          of sales plus a 14-day lead-time buffer.
        </p>
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
            icon={<PackageSearch />}
            title="Nothing needs reordering"
            description="Products at or below their low stock threshold will show up here with a suggested reorder quantity."
          />
        }
      />
    </div>
  );
}
