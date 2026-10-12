"use client";

import { useState } from "react";
import { Download, RefreshCw, Repeat, UserPlus } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useAnalyticsCustomers,
  useExportAnalyticsCustomers,
  type AnalyticsGranularity,
} from "@/hooks/use-analytics";
import { PermissionDenied } from "@/components/permission-denied";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import type { AnalyticsCustomerPoint } from "@/types/analytics";

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(to) };
}

const GRANULARITY_LABELS: Record<AnalyticsGranularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

export default function AnalyticsCustomersPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [granularity, setGranularity] = useState<AnalyticsGranularity>("day");

  const filters = { dateFrom: dateRange.from, dateTo: dateRange.to, granularity };
  const { data: customers, isLoading } = useAnalyticsCustomers(storeId, filters);
  const exportCsv = useExportAnalyticsCustomers();

  if (currentUser && !can(currentUser, "analytics.view")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<AnalyticsCustomerPoint>[] = [
    { id: "date", header: "Date", cell: (row) => row.date },
    { id: "new", header: "New", cell: (row) => row.new },
    { id: "returning", header: "Returning", cell: (row) => row.returning },
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
            onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))}
            className="w-40"
          />
          <span className="text-sm text-text-muted">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={dateRange.to}
            min={dateRange.from}
            onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
            className="w-40"
          />
          <Select value={granularity} onValueChange={(value) => setGranularity(value as AnalyticsGranularity)}>
            <SelectTrigger className="w-32" aria-label="Report granularity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(GRANULARITY_LABELS) as AnalyticsGranularity[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {GRANULARITY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="New customers"
          value={isLoading ? "—" : (customers?.totals.new_customers ?? 0)}
          icon={<UserPlus />}
        />
        <StatCard
          label="Returning customers"
          value={isLoading ? "—" : (customers?.totals.returning_customers ?? 0)}
          icon={<RefreshCw />}
        />
        <StatCard
          label="Repeat purchase rate"
          value={isLoading ? "—" : `${(customers?.totals.repeat_purchase_rate ?? 0).toFixed(1)}%`}
          icon={<Repeat />}
        />
      </div>

      <DataTable
        columns={columns}
        data={customers?.by_period ?? []}
        rowKey={(row) => row.date}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<UserPlus />}
            title="No customer activity in range"
            description="Try a different date range."
          />
        }
      />
    </div>
  );
}
