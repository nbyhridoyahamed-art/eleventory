"use client";

import { useState } from "react";
import { DollarSign, Download, FileSpreadsheet, FileText, Receipt, TrendingUp } from "lucide-react";

import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllWarehouses } from "@/hooks/use-warehouses";
import { useExportSalesReport, useExportSalesReportPdf, useSalesReport } from "@/hooks/use-reports";
import { PermissionDenied } from "@/components/permission-denied";
import { SalesInsightsPanel } from "@/components/reports/report-insights";
import { SalesTrendChart } from "@/components/charts/sales-trend-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import type { ReportGranularity, SalesReportCourier, SalesReportPaymentMethod } from "@/types/report";

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** previous === 0 makes a percent change undefined, not zero — "New" beats a nonsensical +Infinity%. */
function computeTrend(
  current: number,
  previous: number,
  comparisonFrom: string,
  comparisonTo: string,
): { direction: "up" | "down" | "flat"; label: string } {
  const range = `${formatShortDate(comparisonFrom)}–${formatShortDate(comparisonTo)}`;

  if (previous === 0) {
    return current === 0
      ? { direction: "flat", label: `No orders vs ${range}` }
      : { direction: "up", label: `New vs ${range}` };
  }

  const percent = ((current - previous) / previous) * 100;
  const direction = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  const sign = percent > 0 ? "+" : "";
  return { direction, label: `${sign}${percent.toFixed(1)}% vs ${range}` };
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(to) };
}

const GRANULARITY_LABELS: Record<ReportGranularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

export default function SalesReportPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: warehousesData } = useAllWarehouses(storeId);
  const warehouses = warehousesData?.data ?? [];

  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [granularity, setGranularity] = useState<ReportGranularity>("day");

  const filters = { dateFrom: dateRange.from, dateTo: dateRange.to, warehouseId, granularity };
  const { data: report, isLoading } = useSalesReport(storeId, filters);
  const exportCsv = useExportSalesReport();
  const exportPdf = useExportSalesReportPdf();

  if (currentUser && !can(currentUser, "reports.view")) {
    return <PermissionDenied />;
  }

  const paymentMethodColumns: DataTableColumn<SalesReportPaymentMethod>[] = [
    { id: "method", header: "Payment method", cell: (row) => row.payment_method },
    { id: "orders", header: "Orders", cell: (row) => row.orders_count },
    { id: "revenue", header: "Revenue", cell: (row) => formatMoney(row.revenue_amount, "BDT") },
  ];

  const courierColumns: DataTableColumn<SalesReportCourier>[] = [
    { id: "courier", header: "Courier", cell: (row) => row.courier_name },
    { id: "orders", header: "Orders", cell: (row) => row.orders_count },
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
          <Select
            value={warehouseId ? String(warehouseId) : "all"}
            onValueChange={(value) => setWarehouseId(value === "all" ? null : Number(value))}
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
          <Select value={granularity} onValueChange={(value) => setGranularity(value as ReportGranularity)}>
            <SelectTrigger className="w-32" aria-label="Report granularity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(GRANULARITY_LABELS) as ReportGranularity[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {GRANULARITY_LABELS[key]}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Revenue"
          value={isLoading ? "—" : formatMoney(report?.totals.revenue_amount ?? 0, "BDT")}
          icon={<DollarSign />}
          trend={
            report
              ? computeTrend(
                  report.totals.revenue_amount,
                  report.comparison.totals.revenue_amount,
                  report.comparison.date_from,
                  report.comparison.date_to,
                )
              : undefined
          }
        />
        <StatCard
          label="Orders"
          value={isLoading ? "—" : (report?.totals.orders_count ?? 0)}
          icon={<Receipt />}
          trend={
            report
              ? computeTrend(
                  report.totals.orders_count,
                  report.comparison.totals.orders_count,
                  report.comparison.date_from,
                  report.comparison.date_to,
                )
              : undefined
          }
        />
        <StatCard
          label="Average order value"
          value={isLoading ? "—" : formatMoney(report?.totals.average_order_value ?? 0, "BDT")}
          icon={<TrendingUp />}
          trend={
            report
              ? computeTrend(
                  report.totals.average_order_value,
                  report.comparison.totals.average_order_value,
                  report.comparison.date_from,
                  report.comparison.date_to,
                )
              : undefined
          }
        />
      </div>

      <SalesTrendChart data={report?.by_period} isLoading={isLoading} currencyCode="BDT" title="Revenue & orders trend" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By payment method</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={paymentMethodColumns}
              data={report?.by_payment_method ?? []}
              rowKey={(row) => row.payment_method}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By courier</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={courierColumns}
              data={report?.by_courier ?? []}
              rowKey={(row) => row.courier_id}
              isLoading={isLoading}
              emptyState={<p className="text-center text-sm text-text-muted">No dispatched orders in range.</p>}
            />
          </CardContent>
        </Card>
      </div>

      <SalesInsightsPanel
        storeId={storeId}
        dateFrom={dateRange.from}
        dateTo={dateRange.to}
        warehouseId={warehouseId ? Number(warehouseId) : null}
      />
    </div>
  );
}
