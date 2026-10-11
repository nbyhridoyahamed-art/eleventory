"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/storefront/panel";
import { WriteReviewDialog } from "@/components/reviews/write-review-dialog";
import { useAccountOrder } from "@/hooks/use-account";
import { ApiError } from "@/types/api";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  processing: "info",
  shipped: "warning",
  delivered: "success",
  cancelled: "danger",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
};

export default function AccountOrderDetailPage({ params }: PageProps<"/account/orders/[uuid]">) {
  const { uuid } = use(params);
  const { data: order, isLoading, error } = useAccountOrder(uuid);

  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return <p className="text-text-secondary">Something went wrong loading this order. Please try again.</p>;
  }

  const location = [order.shipping.upazila, order.shipping.district, order.shipping.division].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border border-border bg-surface p-5">
        <div>
          <Link
            href="/account/orders"
            className="mb-2 flex items-center gap-1 text-xs font-medium text-shop-ink hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to orders
          </Link>
          <h2 className="text-lg font-semibold text-text-primary">{order.order_number}</h2>
          <p className="text-sm text-text-muted">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <Badge variant={STATUS_VARIANT[order.status]}>{order.status}</Badge>
      </div>

      <Panel
        title="Order summary"
        bodyClassName="p-0"
        action={
          <span className="text-xs text-text-secondary">
            {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}
          </span>
        }
      >
        <ul className="divide-y divide-border">
          {order.items.map((item, index) => (
            <li key={index} className="space-y-2 px-5 py-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="min-w-0 text-text-primary">
                  {item.product_name}
                  {item.product_variant
                    ? ` (${item.product_variant.attribute_values.map((av) => av.value).join(" / ")})`
                    : ""}
                  <span className="ml-1.5 text-text-muted">&times; {item.quantity}</span>
                </span>
                <span className="shrink-0 font-medium text-text-primary">
                  {formatMoney(item.line_total, order.currency_code)}
                </span>
              </div>
              {item.reviewable ? (
                <WriteReviewDialog
                  productId={item.product_id}
                  productName={item.product_name}
                  trigger={
                    <button
                      type="button"
                      className="border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-primary transition-colors hover:border-shop-accent"
                    >
                      Rate this product
                    </button>
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-border px-5 py-4 text-sm">
          <div className="flex justify-between text-text-secondary">
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotal_amount, order.currency_code)}</dd>
          </div>
          {order.discount_amount > 0 ? (
            <div className="flex justify-between text-text-secondary">
              <dt>Discount</dt>
              <dd>-{formatMoney(order.discount_amount, order.currency_code)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-text-secondary">
            <dt>Shipping</dt>
            <dd>{formatMoney(order.shipping_amount, order.currency_code)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-text-primary">
            <dt>Total</dt>
            <dd className="text-shop-ink">{formatMoney(order.total_amount, order.currency_code)}</dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-6 tablet:grid-cols-2">
        <Panel title="Shipping to">
          <p className="text-sm leading-relaxed text-text-secondary">
            <span className="font-medium text-text-primary">{order.shipping.recipient_name}</span>
            <br />
            {order.shipping.phone}
            <br />
            {order.shipping.address_line}
            {location ? (
              <>
                <br />
                {location}
              </>
            ) : null}
          </p>
        </Panel>

        <Panel title="Status history">
          <ol className="space-y-3">
            {order.status_history.map((entry, index) => (
              <li key={index} className="flex items-center justify-between gap-3 text-sm">
                <Badge variant={STATUS_VARIANT[entry.to_status]}>{entry.to_status}</Badge>
                <span className="text-xs text-text-muted">{new Date(entry.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
