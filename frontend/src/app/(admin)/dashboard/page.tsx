"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ClipboardList,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store as StoreIcon,
  Truck,
  Undo2,
  Users,
  Warehouse as WarehouseIcon,
} from "lucide-react";

import { api } from "@/lib/api";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useOrderStatusBreakdown, useSalesTrend } from "@/hooks/use-dashboard";
import { useOrders } from "@/hooks/use-orders";
import { formatMoney } from "@/lib/money";
import { DashboardInsightsPanel, useDashboardInsights } from "@/components/dashboard/insights";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { KpiTile, PaymentMix, VisitorFunnel } from "@/components/dashboard/home-panels";
import { OrderStatusChart } from "@/components/charts/order-status-chart";
import { SalesTrendChart } from "@/components/charts/sales-trend-chart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import type { OrderStatus } from "@/types/order";

type BadgeVariant = BadgeProps["variant"];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const ORDER_STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  pending: "neutral",
  processing: "info",
  shipped: "warning",
  delivered: "success",
  cancelled: "danger",
};

/** Fetches just enough of a list endpoint to read its total count. */
function useTotal(path: string) {
  return useQuery<number>({
    queryKey: ["total", path],
    queryFn: async () => {
      const { data, meta } = await api.getWithMeta<unknown[]>(`${path}?per_page=1`);
      return meta?.total ?? (Array.isArray(data) ? data.length : 0);
    },
  });
}

export default function DashboardPage() {
  const { data: user } = useCurrentUser();
  const storeId = user?.current_store_id;

  const stores = useTotal("/stores");
  const warehouses = useTotal("/warehouses");
  const users = useTotal("/users");
  const roles = useTotal("/roles");
  const products = useQuery<number>({
    queryKey: ["total", "/products", storeId],
    queryFn: async () => {
      const { meta } = await api.getWithMeta<unknown[]>(`/products?store_id=${storeId}&per_page=1`);
      return meta?.total ?? 0;
    },
    enabled: Boolean(storeId),
  });
  const lowStock = useQuery<number>({
    queryKey: ["total", "/stock-levels/low-stock-count", storeId],
    queryFn: async () => {
      const count = await api.get<{ count: number }>(`/stock-levels/low-stock-count?store_id=${storeId}`);
      return count.count;
    },
    enabled: Boolean(storeId),
  });
  const openPurchaseOrders = useQuery<number>({
    queryKey: ["total", "/purchase-orders", "open", storeId],
    queryFn: async () => {
      const { meta } = await api.getWithMeta<unknown[]>(`/purchase-orders?store_id=${storeId}&open=1&per_page=1`);
      return meta?.total ?? 0;
    },
    enabled: Boolean(storeId),
  });
  const pendingOrders = useQuery<number>({
    queryKey: ["total", "/orders", "open", storeId],
    queryFn: async () => {
      const { meta } = await api.getWithMeta<unknown[]>(`/orders?store_id=${storeId}&open=1&per_page=1`);
      return meta?.total ?? 0;
    },
    enabled: Boolean(storeId),
  });
  const shipmentsInTransit = useQuery<number>({
    queryKey: ["total", "/shipments", "in_transit", storeId],
    queryFn: async () => {
      const { meta } = await api.getWithMeta<unknown[]>(
        `/shipments?store_id=${storeId}&status=in_transit&per_page=1`,
      );
      return meta?.total ?? 0;
    },
    enabled: Boolean(storeId),
  });
  const pendingReturns = useQuery<number>({
    queryKey: ["total", "/returns", "requested", storeId],
    queryFn: async () => {
      const { meta } = await api.getWithMeta<unknown[]>(`/returns?store_id=${storeId}&status=requested&per_page=1`);
      return meta?.total ?? 0;
    },
    enabled: Boolean(storeId),
  });

  const [days, setDays] = useState(30);
  const salesTrend = useSalesTrend(storeId, days);
  const insights = useDashboardInsights(storeId, days);
  const orderStatusBreakdown = useOrderStatusBreakdown(storeId);
  const recentOrders = useOrders(storeId, { page: 1 });

  const canViewOrders = can(user, "orders.view");

  const trend = salesTrend.data ?? [];
  const kpiData = insights.data?.kpis;
  const currency = insights.data?.currency_code ?? "BDT";
  const vs = `vs previous ${days} days`;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Each card names the permission that backs its number — a user who
  // lacks it never sees a card showing a misleading 0 for data it can't
  // actually see (spec rule 178: no fake/misleading data).
  const cards = [
    { permission: "products.view", label: "Products", value: products.data, icon: <Package />, isLoading: products.isLoading },
    {
      permission: "inventory.view",
      label: "Low stock alerts",
      value: lowStock.data,
      icon: <AlertTriangle />,
      isLoading: lowStock.isLoading,
      tone: lowStock.data && lowStock.data > 0 ? ("danger" as const) : undefined,
    },
    {
      permission: "purchase_orders.view",
      label: "Open purchase orders",
      value: openPurchaseOrders.data,
      icon: <ClipboardList />,
      isLoading: openPurchaseOrders.isLoading,
    },
    { permission: "orders.view", label: "Pending orders", value: pendingOrders.data, icon: <ShoppingCart />, isLoading: pendingOrders.isLoading },
    {
      permission: "shipments.view",
      label: "Shipments in transit",
      value: shipmentsInTransit.data,
      icon: <Truck />,
      isLoading: shipmentsInTransit.isLoading,
    },
    { permission: "returns.view", label: "Pending returns", value: pendingReturns.data, icon: <Undo2 />, isLoading: pendingReturns.isLoading },
    { permission: "stores.view", label: "Stores", value: stores.data, icon: <StoreIcon />, isLoading: stores.isLoading },
    { permission: "warehouses.view", label: "Warehouses", value: warehouses.data, icon: <WarehouseIcon />, isLoading: warehouses.isLoading },
    { permission: "users.view", label: "Staff users", value: users.data, icon: <Users />, isLoading: users.isLoading },
    { permission: "roles.view", label: "Roles", value: roles.data, icon: <ShieldCheck />, isLoading: roles.isLoading },
  ].filter((card) => can(user, card.permission));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{today}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Welcome back"}
          </h1>
          <p className="text-sm text-text-secondary">
            {canViewOrders && pendingOrders.data
              ? `${pendingOrders.data} ${pendingOrders.data === 1 ? "order is" : "orders are"} waiting to be packed.`
              : "Here’s the current state of your store."}
          </p>
        </div>
        {canViewOrders ? (
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5" role="group" aria-label="Period">
            {[7, 30, 90].map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={days === option}
                onClick={() => setDays(option)}
                className={
                  days === option
                    ? "rounded px-3 py-1 text-sm font-medium bg-primary text-on-primary"
                    : "rounded px-3 py-1 text-sm font-medium text-text-secondary hover:text-text-primary"
                }
              >
                {option} days
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <OnboardingChecklist />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) =>
          card.isLoading ? (
            <Skeleton key={card.label} className="h-24 w-full" />
          ) : (
            <StatCard key={card.label} label={card.label} value={card.value ?? 0} icon={card.icon} tone={card.tone} />
          ),
        )}
      </div>

      {canViewOrders ? (
        <>
          {insights.isLoading || !kpiData ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiTile label="Revenue" value={formatMoney(kpiData.revenue.value, currency)} percent={kpiData.revenue.change_percent} series={trend.map((p) => Number(p.revenue_amount))} footnote={vs} />
              <KpiTile label="Orders" value={kpiData.orders.value.toLocaleString("en-US")} percent={kpiData.orders.change_percent} series={trend.map((p) => p.orders_count)} footnote={vs} />
              <KpiTile label="Average order" value={formatMoney(kpiData.average_order_value.value, currency)} percent={kpiData.average_order_value.change_percent} series={trend.map((p) => (p.orders_count ? Number(p.revenue_amount) / p.orders_count : 0))} footnote={vs} />
              <KpiTile label="New customers" value={kpiData.new_customers.value.toLocaleString("en-US")} percent={kpiData.new_customers.change_percent} series={trend.map((p) => p.orders_count)} footnote={vs} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SalesTrendChart data={salesTrend.data} isLoading={salesTrend.isLoading} currencyCode={currency} title={`Sales, last ${days} days`} />
            </div>
            <PaymentMix methods={insights.data?.payment_methods ?? []} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {can(user, "analytics.view") ? <VisitorFunnel storeId={storeId} days={days} /> : null}
            <OrderStatusChart data={orderStatusBreakdown.data} isLoading={orderStatusBreakdown.isLoading} />
          </div>

          <div className="pt-2">
            <h2 className="font-display text-xl font-semibold text-text-primary">More detail</h2>
            <p className="text-sm text-text-secondary">Products, stock, delivery and timing for the same period.</p>
          </div>

          <DashboardInsightsPanel storeId={storeId} days={days} />

          <Card>
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
            </CardHeader>
            <CardContent>
              {recentOrders.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (recentOrders.data?.data ?? []).length === 0 ? (
                <EmptyState icon={<ShoppingCart />} title="No orders yet" description="Orders will show up here once placed." />
              ) : (
                <ul className="divide-y divide-border">
                  {(recentOrders.data?.data ?? []).slice(0, 5).map((order) => (
                    <li key={order.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <Link href={`/dashboard/orders/orders/${order.id}`} className="font-medium text-primary hover:underline">
                          {order.order_number}
                        </Link>
                        <span className="ml-2 text-text-muted">{order.customer.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-text-secondary">{formatMoney(order.total_amount, order.currency_code)}</span>
                        <Badge variant={ORDER_STATUS_VARIANTS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {user && user.permissions.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Your account has no role assigned yet, so most actions will be blocked until a
            Super Admin assigns one.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
