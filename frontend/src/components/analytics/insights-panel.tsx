"use client";

import { useQuery } from "@tanstack/react-query";
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
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface AnalyticsInsights {
  engagement: { bounce_rate: number; pages_per_session: number; events_per_session: number; returning_visitor_rate: number };
  visitors: { label: string; sessions: number }[];
  abandonment: { cart_sessions: number; cart_abandonment_rate: number; checkout_sessions: number; checkout_abandonment_rate: number };
  sales: { purchases: number; revenue: number; average_order_value: number };
  top_pages: { path: string; views: number }[];
  by_weekday: { day: string; page_views: number }[];
  by_hour: { hour: string; page_views: number }[];
}

export function useAnalyticsInsights(storeId: number | null | undefined, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["analytics", "insights", storeId, dateFrom, dateTo],
    queryFn: () =>
      api.get<AnalyticsInsights>(
        `/analytics/overview/insights?store_id=${storeId}&date_from=${dateFrom}&date_to=${dateTo}`,
      ),
    enabled: Boolean(storeId && dateFrom && dateTo),
  });
}

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
    </div>
  );
}

export function AnalyticsInsightsPanel({
  storeId,
  dateFrom,
  dateTo,
}: {
  storeId: number | null | undefined;
  dateFrom: string;
  dateTo: string;
}) {
  const { data, isLoading } = useAnalyticsInsights(storeId, dateFrom, dateTo);

  if (isLoading || !data) {
    return <Skeleton className="h-72 w-full" />;
  }

  const { engagement, abandonment, sales } = data;
  const peakDay = [...data.by_weekday].sort((a, b) => b.page_views - a.page_views)[0];
  const visitorTotal = data.visitors.reduce((sum, v) => sum + v.sessions, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Visitor behaviour</h2>
        <p className="text-sm text-text-secondary">How people use the store in the selected dates.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Bounce rate" value={`${engagement.bounce_rate}%`} hint="sessions with a single interaction" />
        <Tile label="Pages per session" value={String(engagement.pages_per_session)} hint={`${engagement.events_per_session} actions per session`} />
        <Tile label="Returning visitors" value={`${engagement.returning_visitor_rate}%`} hint="had visited before this period" />
        <Tile label="Tracked sales" value={formatMoney(sales.revenue, "BDT")} hint={`${sales.purchases} orders · avg ${formatMoney(sales.average_order_value, "BDT")}`} />
        <Tile
          label="Cart abandonment"
          value={`${abandonment.cart_abandonment_rate}%`}
          hint={`${abandonment.cart_sessions} sessions added to cart`}
        />
        <Tile
          label="Checkout abandonment"
          value={`${abandonment.checkout_abandonment_rate}%`}
          hint={`${abandonment.checkout_sessions} sessions reached checkout`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Most visited pages</CardTitle>
            </CardHeader>
            <CardContent>
              {data.top_pages.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-muted">No page views in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, data.top_pages.length * 36)}>
                  <BarChart data={data.top_pages} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="path"
                      width={220}
                      stroke="var(--color-text-secondary)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => (v.length > 32 ? `${v.slice(0, 31)}…` : v)}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Views"]} />
                    <Bar dataKey="views" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New vs returning</CardTitle>
          </CardHeader>
          <CardContent>
            {visitorTotal === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">No visitors in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.visitors} dataKey="sessions" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                    <Cell fill="#2563eb" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Traffic by weekday</CardTitle>
            {peakDay && peakDay.page_views > 0 ? (
              <p className="text-xs text-text-muted">Busiest: {peakDay.day} ({peakDay.page_views} page views)</p>
            ) : null}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.by_weekday} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Page views"]} />
                <Bar dataKey="page_views" radius={[4, 4, 0, 0]}>
                  {data.by_weekday.map((d) => (
                    <Cell key={d.day} fill={peakDay && d.day === peakDay.day && d.page_views > 0 ? "#f59e0b" : "#2563eb"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Traffic by hour</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.by_hour} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="trafficHour" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333ea" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" interval={3} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Page views"]} />
                <Area type="monotone" dataKey="page_views" stroke="#9333ea" strokeWidth={2} fill="url(#trafficHour)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
