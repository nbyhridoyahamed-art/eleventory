"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Area,
  AreaChart,
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
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Kpi {
  value: number;
  previous: number;
  change_percent: number | null;
}

export interface DashboardInsights {
  days: number;
  currency_code: string;
  kpis: {
    revenue: Kpi;
    orders: Kpi;
    average_order_value: Kpi;
    new_customers: Kpi;
    cancellation_rate: number;
    repeat_customer_rate: number;
  };
  top_products: { id: number; name: string; units: number; revenue_amount: number }[];
  sales_by_category: { name: string; revenue_amount: number }[];
  payment_methods: { method: string; orders: number; revenue_amount: number }[];
  order_sources: { source: string; orders: number; revenue_amount: number }[];
  orders_by_weekday: { day: string; orders: number }[];
  orders_by_hour: { hour: string; orders: number }[];
  low_stock: { id: number; name: string; sku: string; quantity: number; threshold: number }[];
  shipment_pipeline: { status: string; count: number }[];
}

export function useDashboardInsights(storeId: number | null | undefined, days: number) {
  return useQuery({
    queryKey: ["dashboard", "insights", storeId, days],
    queryFn: () => api.get<DashboardInsights>(`/dashboard/insights?store_id=${storeId}&days=${days}`),
    enabled: Boolean(storeId),
  });
}

const PALETTE = ["#2563eb", "#f59e0b", "#16a34a", "#9333ea", "#0ea5e9", "#e11d48", "#64748b"];

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  card: "Card",
  bank_transfer: "Bank transfer",
};

const PIPELINE_LABELS: Record<string, string> = {
  pending_pickup: "Awaiting pickup",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  failed_delivery: "Failed delivery",
  returned_to_seller: "Returned",
};

const PIPELINE_COLORS: Record<string, string> = {
  pending_pickup: "#64748b",
  picked_up: "#0ea5e9",
  in_transit: "#f59e0b",
  delivered: "#16a34a",
  failed_delivery: "#e11d48",
  returned_to_seller: "#9333ea",
};

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

function Change({ percent, invert = false }: { percent: number | null; invert?: boolean }) {
  if (percent === null) return <span className="text-xs text-text-muted">no prior data</span>;
  if (percent === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-text-muted">
        <Minus className="size-3" /> 0%
      </span>
    );
  }
  const up = percent > 0;
  const good = invert ? !up : up;

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(percent)}%
    </span>
  );
}

function KpiTile({ label, value, percent, footnote }: { label: string; value: string; percent: number | null; footnote: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
      <p className="mt-1 flex items-center gap-2 text-xs text-text-muted">
        <Change percent={percent} /> {footnote}
      </p>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-text-muted">{text}</p>;
}

function Donut({ data, valueKey, formatter }: { data: { name: string; value: number }[]; valueKey: string; formatter: (v: number) => string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <Empty text="No sales in this period yet." />;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
          {data.map((_, index) => (
            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [`${formatter(Number(value))} (${Math.round((Number(value) / total) * 100)}%)`, String(name)]}
        />
        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DashboardInsightsPanel({ storeId, days }: { storeId: number | null | undefined; days: number }) {
  const { data, isLoading } = useDashboardInsights(storeId, days);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const { kpis, currency_code: currency } = data;
  const money = (v: number) => formatMoney(v, currency);
  const vs = `vs previous ${data.days} days`;

  const categoryData = data.sales_by_category.map((c) => ({ name: c.name, value: c.revenue_amount }));
  const paymentData = data.payment_methods.map((p) => ({ name: PAYMENT_LABELS[p.method] ?? p.method, value: p.orders }));
  const sourceData = data.order_sources.map((s) => ({ name: s.source === "storefront" ? "Online store" : "Admin / phone", value: s.orders }));
  const pipelineData = data.shipment_pipeline.map((p) => ({ ...p, label: PIPELINE_LABELS[p.status] ?? p.status }));
  const pipelineTotal = pipelineData.reduce((sum, p) => sum + p.count, 0);
  const peakDay = [...data.orders_by_weekday].sort((a, b) => b.orders - a.orders)[0];
  const peakHour = [...data.orders_by_hour].sort((a, b) => b.orders - a.orders)[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile label="Revenue" value={money(kpis.revenue.value)} percent={kpis.revenue.change_percent} footnote={vs} />
        <KpiTile label="Orders" value={kpis.orders.value.toLocaleString("en-US")} percent={kpis.orders.change_percent} footnote={vs} />
        <KpiTile label="Average order value" value={money(kpis.average_order_value.value)} percent={kpis.average_order_value.change_percent} footnote={vs} />
        <KpiTile label="New customers" value={kpis.new_customers.value.toLocaleString("en-US")} percent={kpis.new_customers.change_percent} footnote={vs} />
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-secondary">Cancellation rate</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{kpis.cancellation_rate}%</p>
          <p className="mt-1 text-xs text-text-muted">of orders placed in the last {data.days} days</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-secondary">Repeat customers</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{kpis.repeat_customer_rate}%</p>
          <p className="mt-1 text-xs text-text-muted">ordered more than once in the period</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard title="Top products by revenue" description={`Best sellers in the last ${data.days} days`}>
            {data.top_products.length === 0 ? (
              <Empty text="No sales in this period yet." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, data.top_products.length * 38)}>
                <BarChart data={data.top_products} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={compact} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={190}
                    stroke="var(--color-text-secondary)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => (v.length > 28 ? `${v.slice(0, 27)}…` : v)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, _name, item) => [`${money(Number(value))} · ${(item.payload as { units: number }).units} sold`, "Revenue"]}
                  />
                  <Bar dataKey="revenue_amount" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <ChartCard title="Sales by category" description="Share of revenue">
          <Donut data={categoryData} valueKey="value" formatter={money} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Payment methods" description="Orders by how customers pay">
          <Donut data={paymentData} valueKey="value" formatter={(v) => `${v} orders`} />
        </ChartCard>

        <ChartCard title="Where orders come from" description="Online store vs. staff-entered">
          <Donut data={sourceData} valueKey="value" formatter={(v) => `${v} orders`} />
        </ChartCard>

        <ChartCard title="Delivery pipeline" description={`${pipelineTotal} shipments in total`}>
          {pipelineTotal === 0 ? (
            <Empty text="No shipments yet." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={110} stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Shipments"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {pipelineData.map((p) => (
                    <Cell key={p.status} fill={PIPELINE_COLORS[p.status] ?? "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Orders by weekday"
          description={peakDay && peakDay.orders > 0 ? `Busiest day: ${peakDay.day} (${peakDay.orders} orders)` : "Which days customers order"}
        >
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data.orders_by_weekday} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Orders"]} />
              <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                {data.orders_by_weekday.map((d) => (
                  <Cell key={d.day} fill={peakDay && d.day === peakDay.day && d.orders > 0 ? "#f59e0b" : "#2563eb"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Orders by hour of day"
          description={peakHour && peakHour.orders > 0 ? `Peak hour: ${peakHour.hour} (${peakHour.orders} orders)` : "When customers order"}
        >
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={data.orders_by_hour} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9333ea" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#9333ea" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" interval={3} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Orders"]} />
              <Area type="monotone" dataKey="orders" stroke="#9333ea" strokeWidth={2} fill="url(#hourFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Low stock" description="Products at or below their low-stock threshold">
        {data.low_stock.length === 0 ? (
          <Empty text="Nothing is running low. 🎉" />
        ) : (
          <ul className="divide-y divide-border">
            {data.low_stock.map((product) => (
              <li key={product.id} className="flex items-center gap-3 py-2.5 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <Link href={`/dashboard/catalog/products/${product.id}`} className="min-w-0 flex-1 truncate font-medium text-primary hover:underline">
                  {product.name}
                </Link>
                <span className="hidden text-xs text-text-muted sm:inline">{product.sku}</span>
                <span className={cn("w-28 text-right tabular-nums", product.quantity === 0 ? "font-semibold text-danger" : "text-text-secondary")}>
                  {product.quantity} left (min {product.threshold})
                </span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
