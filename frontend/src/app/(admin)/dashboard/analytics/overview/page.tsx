"use client";

import { useState } from "react";
import {
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  PackageSearch,
  Percent,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useAnalyticsOverview,
  useExportAnalyticsOverview,
  useExportAnalyticsOverviewPdf,
  type AnalyticsGranularity,
} from "@/hooks/use-analytics";
import { PermissionDenied } from "@/components/permission-denied";
import { AnalyticsInsightsPanel } from "@/components/analytics/insights-panel";
import { TrafficTrendChart } from "@/components/charts/traffic-trend-chart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";

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
      ? { direction: "flat", label: `No data vs ${range}` }
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

const GRANULARITY_LABELS: Record<AnalyticsGranularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

export default function AnalyticsOverviewPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [granularity, setGranularity] = useState<AnalyticsGranularity>("day");

  const filters = { dateFrom: dateRange.from, dateTo: dateRange.to, granularity };
  const { data: overview, isLoading } = useAnalyticsOverview(storeId, filters);
  const exportCsv = useExportAnalyticsOverview();
  const exportPdf = useExportAnalyticsOverviewPdf();

  if (currentUser && !can(currentUser, "analytics.view")) {
    return <PermissionDenied />;
  }

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
          label="Page views"
          value={isLoading ? "—" : (overview?.totals.page_views ?? 0)}
          icon={<Eye />}
          trend={
            overview
              ? computeTrend(
                  overview.totals.page_views,
                  overview.comparison.totals.page_views,
                  overview.comparison.date_from,
                  overview.comparison.date_to,
                )
              : undefined
          }
        />
        <StatCard
          label="Unique sessions"
          value={isLoading ? "—" : (overview?.totals.unique_sessions ?? 0)}
          icon={<Users />}
          trend={
            overview
              ? computeTrend(
                  overview.totals.unique_sessions,
                  overview.comparison.totals.unique_sessions,
                  overview.comparison.date_from,
                  overview.comparison.date_to,
                )
              : undefined
          }
        />
        <StatCard
          label="Conversion rate"
          value={isLoading ? "—" : `${(overview?.totals.conversion_rate ?? 0).toFixed(1)}%`}
          icon={<Percent />}
          trend={
            overview
              ? computeTrend(
                  overview.totals.conversion_rate,
                  overview.comparison.totals.conversion_rate,
                  overview.comparison.date_from,
                  overview.comparison.date_to,
                )
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Product views"
          value={isLoading ? "—" : (overview?.totals.product_views ?? 0)}
          icon={<PackageSearch />}
        />
        <StatCard label="Searches" value={isLoading ? "—" : (overview?.totals.searches ?? 0)} icon={<Search />} />
        <StatCard
          label="Added to cart"
          value={isLoading ? "—" : (overview?.totals.add_to_cart ?? 0)}
          icon={<ShoppingCart />}
        />
        <StatCard
          label="Checkout starts"
          value={isLoading ? "—" : (overview?.totals.checkout_starts ?? 0)}
          icon={<CreditCard />}
        />
      </div>

      <TrafficTrendChart data={overview?.by_period} isLoading={isLoading} title="Traffic trend" />

      <AnalyticsInsightsPanel storeId={storeId} dateFrom={dateRange.from} dateTo={dateRange.to} />
    </div>
  );
}
