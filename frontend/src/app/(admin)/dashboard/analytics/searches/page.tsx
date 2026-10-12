"use client";

import { useState } from "react";
import { Download, Search } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAnalyticsSearches, useExportAnalyticsSearches } from "@/hooks/use-analytics";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { AnalyticsSearchRow } from "@/types/analytics";

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export default function AnalyticsSearchesPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [page, setPage] = useState(1);

  const filters = { dateFrom: dateRange.from, dateTo: dateRange.to };
  const { data, isLoading } = useAnalyticsSearches(storeId, filters, page);
  const exportCsv = useExportAnalyticsSearches();

  if (currentUser && !can(currentUser, "analytics.view")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<AnalyticsSearchRow>[] = [
    { id: "query", header: "Search term", cell: (row) => <p className="font-medium">{row.query}</p> },
    { id: "count", header: "Searches", cell: (row) => row.search_count },
    {
      id: "avg_results",
      header: "Avg results",
      cell: (row) => (row.avg_results_count === null ? "—" : row.avg_results_count),
    },
    {
      id: "zero_results",
      header: "",
      cell: (row) => (row.zero_results ? <Badge variant="danger">No results</Badge> : null),
    },
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
        </div>
        <Button
          variant="outline"
          loading={exportCsv.isPending}
          onClick={() => storeId && exportCsv.mutate({ storeId, filters })}
        >
          <Download />
          Export CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(row) => row.query}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState icon={<Search />} title="No searches in range" description="Try a different date range." />
        }
      />
    </div>
  );
}
