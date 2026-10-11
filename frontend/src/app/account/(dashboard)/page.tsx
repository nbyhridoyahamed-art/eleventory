"use client";

import Link from "next/link";
import { MapPin, Package, Star } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/storefront/panel";
import { useAccountOrders } from "@/hooks/use-account";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  processing: "info",
  shipped: "warning",
  delivered: "success",
  cancelled: "danger",
};

export default function AccountOverviewPage() {
  const { data, isLoading } = useAccountOrders(1);
  const recentOrders = data?.data.slice(0, 5) ?? [];

  const shortcuts = [
    { href: "/account/orders", label: "Orders", detail: `${data?.meta?.total ?? "–"} placed`, icon: Package },
    { href: "/account/addresses", label: "Addresses", detail: "Manage saved addresses", icon: MapPin },
    { href: "/account/reviews", label: "Reviews", detail: "Your product reviews", icon: Star },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 tablet:grid-cols-3">
        {shortcuts.map(({ href, label, detail, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 border border-border bg-surface p-4 transition-colors hover:border-shop-accent"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-shop-tint text-shop-ink">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text-primary">{label}</span>
              <span className="block truncate text-xs text-text-secondary">{detail}</span>
            </span>
          </Link>
        ))}
      </div>

      <Panel
        title="Recent orders"
        bodyClassName="p-0"
        action={
          <Link href="/account/orders" className="text-xs font-semibold text-shop-ink hover:underline">
            View all
          </Link>
        }
      >
        {isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-shop-tint text-shop-ink">
              <Package className="size-6" />
            </span>
            <p className="font-semibold text-text-primary">No orders yet</p>
            <p className="text-sm text-text-secondary">Your orders will show up here once you place one.</p>
            <Link
              href="/products"
              className="bg-shop-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recentOrders.map((order) => (
              <li key={order.uuid}>
                <Link
                  href={`/account/orders/${order.uuid}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-shop-tint"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-shop-ink">{order.order_number}</span>
                    <span className="block text-xs text-text-muted">{new Date(order.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium text-text-primary">
                      {formatMoney(order.total_amount, order.currency_code)}
                    </span>
                    <Badge variant={STATUS_VARIANT[order.status]}>{order.status}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
