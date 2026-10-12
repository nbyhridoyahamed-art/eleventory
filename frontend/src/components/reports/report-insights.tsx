"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SalesInsights {
  summary: {
    daily_average_revenue: number;
    best_day: { date: string; revenue_amount: number; orders_count: number } | null;
    shipping_collected: number;
    discounts_given: number;
    store_credit_used: number;
    cancellation_rate: number;
    buyers: number;
    returning_buyers: number;
    new_buyers: number;
  };
  by_category: { name: string; units: number; revenue_amount: number }[];
  top_customers: { id: number; name: string; orders_count: number; revenue_amount: number }[];
  by_weekday: { day: string; orders_count: number; revenue_amount: number }[];
  status_mix: { status: string; count: number }[];
}

interface StockOverview {
  tracked_products: number;
  out_of_stock: number;
  low_stock: number;
  healthy: number;
  units_on_hand: number;
  stock_value_at_cost: number;
  stock_value_at_retail: number;
  potential_margin: number;
}

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#64748b",
  processing: "#0ea5e9",
  shipped: "#f59e0b",
  delivered: "#16a34a",
  cancelled: "#e11d48",
};

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function SalesInsightsPanel({
  storeId,
  dateFrom,
  dateTo,
  warehouseId,
}: {
  storeId: number | null | undefined;
  dateFrom: string;
  dateTo: string;
  warehouseId?: number | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "sales-insights", storeId, dateFrom, dateTo, warehouseId],
    queryFn: () =>
      api.get<SalesInsights>(
        `/reports/sales/insights?store_id=${storeId}&date_from=${dateFrom}&date_to=${dateTo}${warehouseId ? `&warehouse_id=${warehouseId}` : ""}`,
      ),
    enabled: Boolean(storeId && dateFrom && dateTo),
  });

  if (isLoading || !data) return <Skeleton className="h-72 w-full" />;

  const { summary } = data;
  const peak = [...data.by_weekday].sort((a, b) => b.revenue_amount - a.revenue_amount)[0];
  const statusTotal = data.status_mix.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Sales insights</h2>
        <p className="text-sm text-text-secondary">Where the revenue above came from.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Daily average" value={formatMoney(summary.daily_average_revenue, "BDT")} hint="revenue per day in range" />
        <Tile
          label="Best day"
          value={summary.best_day ? formatMoney(summary.best_day.revenue_amount, "BDT") : "—"}
          hint={summary.best_day ? `${new Date(summary.best_day.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${summary.best_day.orders_count} orders` : "no sales yet"}
        />
        <Tile label="Shipping collected" value={formatMoney(summary.shipping_collected, "BDT")} hint="delivery charges on orders" />
        <Tile label="Discounts given" value={formatMoney(summary.discounts_given, "BDT")} hint={`+ ${formatMoney(summary.store_credit_used, "BDT")} store credit used`} />
        <Tile label="Buyers" value={String(summary.buyers)} hint={`${summary.new_buyers} new · ${summary.returning_buyers} returning`} />
        <Tile label="Cancellation rate" value={`${summary.cancellation_rate}%`} hint="of orders placed in range" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by category</CardTitle>
            </CardHeader>
            <CardContent>
              {data.by_category.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-muted">No sales in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, data.by_category.length * 38)}>
                  <BarChart data={data.by_category} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={compact} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={160} stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, _n, item) => [`${formatMoney(Number(value), "BDT")} · ${(item.payload as { units: number }).units} units`, "Revenue"]}
                    />
                    <Bar dataKey="revenue_amount" fill="#16a34a" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {statusTotal === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">No orders in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.status_mix.filter((s) => s.count > 0)} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                    {data.status_mix.filter((s) => s.count > 0).map((s) => (
                      <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, textTransform: "capitalize" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by weekday</CardTitle>
            {peak && peak.revenue_amount > 0 ? <p className="text-xs text-text-muted">Strongest day: {peak.day}</p> : null}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.by_weekday} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compact} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatMoney(Number(value), "BDT"), "Revenue"]} />
                <Bar dataKey="revenue_amount" radius={[4, 4, 0, 0]}>
                  {data.by_weekday.map((d) => (
                    <Cell key={d.day} fill={peak && d.day === peak.day && d.revenue_amount > 0 ? "#f59e0b" : "#2563eb"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top customers in range</CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_customers.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">No buyers in this range.</p>
            ) : (
              <ol className="divide-y divide-border">
                {data.top_customers.map((c, index) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-5 text-center text-xs font-semibold text-text-muted">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{c.name}</span>
                    <span className="text-xs text-text-muted">{c.orders_count} order{c.orders_count === 1 ? "" : "s"}</span>
                    <span className="w-28 text-right font-semibold tabular-nums">{formatMoney(c.revenue_amount, "BDT")}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function StockOverviewPanel({ storeId }: { storeId: number | null | undefined }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "stock-overview", storeId],
    queryFn: () => api.get<StockOverview>(`/reports/stock-overview?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });

  if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

  const donut = [
    { name: "Healthy", value: data.healthy, color: "#16a34a" },
    { name: "Low stock", value: data.low_stock, color: "#f59e0b" },
    { name: "Out of stock", value: data.out_of_stock, color: "#e11d48" },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-2">
        <Tile label="Tracked products" value={data.tracked_products.toLocaleString("en-US")} hint={`${data.units_on_hand.toLocaleString("en-US")} units on hand`} />
        <Tile label="Needs attention" value={(data.out_of_stock + data.low_stock).toLocaleString("en-US")} hint={`${data.out_of_stock} out · ${data.low_stock} low`} />
        <Tile label="Stock value (cost)" value={formatMoney(data.stock_value_at_cost, "BDT")} hint="what the stock cost you" />
        <Tile label="Stock value (retail)" value={formatMoney(data.stock_value_at_retail, "BDT")} hint={`potential margin ${formatMoney(data.potential_margin, "BDT")}`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stock health</CardTitle>
        </CardHeader>
        <CardContent>
          {donut.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">No tracked products.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                  {donut.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
