"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/storefront/panel";
import { StorefrontPagination } from "@/components/storefront/storefront-pagination";
import { useAccountOrders } from "@/hooks/use-account";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  processing: "info",
  shipped: "warning",
  delivered: "success",
  cancelled: "danger",
};

export default function AccountOrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAccountOrders(page);
  const orders = data?.data ?? [];

  return (
    <Panel title="My orders" bodyClassName="p-0">
      {isLoading ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
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
        <>
          <ul className="divide-y divide-border">
            {orders.map((order) => (
              <li key={order.uuid}>
                <Link
                  href={`/account/orders/${order.uuid}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-shop-tint"
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
                    <ChevronRight className="size-4 text-text-muted" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="px-5 pb-5">
            <StorefrontPagination meta={data?.meta} itemLabel="orders" onPageChange={setPage} />
          </div>
        </>
      )}
    </Panel>
  );
}
