"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalesTrendPoint } from "@/types/dashboard";

interface SalesTrendChartProps {
  data: SalesTrendPoint[] | undefined;
  isLoading: boolean;
  currencyCode: string;
  title: string;
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SalesTrendChart({ data, isLoading, currencyCode, title }: SalesTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <ComposedChart data={data ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="revenue"
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                formatter={(value, name) =>
                  name === "revenue_amount"
                    ? [formatMoney(Number(value), currencyCode), "Revenue"]
                    : [Number(value), "Orders"]
                }
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  borderRadius: "0.5rem",
                  fontSize: "0.8125rem",
                }}
              />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue_amount"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.12}
                strokeWidth={2}
              />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders_count"
                stroke="var(--color-accent)"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        <div className="mt-2 flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" /> Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Orders
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
