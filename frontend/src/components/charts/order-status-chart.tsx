"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Donut } from "@/components/charts/donut";
import type { OrderStatusBreakdown } from "@/types/dashboard";

interface OrderStatusChartProps {
  data: OrderStatusBreakdown | undefined;
  isLoading: boolean;
}

const STATUSES: Array<{ key: keyof OrderStatusBreakdown; label: string; color: string }> = [
  { key: "pending", label: "Pending", color: "var(--brand-edge, #6f8683)" },
  { key: "processing", label: "Processing", color: "#2a78d6" },
  { key: "shipped", label: "Shipped", color: "#f7b538" },
  { key: "delivered", label: "Delivered", color: "var(--color-primary)" },
  { key: "cancelled", label: "Cancelled", color: "var(--color-danger)" },
];

export function OrderStatusChart({ data, isLoading }: OrderStatusChartProps) {
  const slices = STATUSES.map((status) => ({ ...status, value: data?.[status.key] ?? 0 }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders by status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : <Donut slices={slices} totalLabel="orders" />}
      </CardContent>
    </Card>
  );
}
