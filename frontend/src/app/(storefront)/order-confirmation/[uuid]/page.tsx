"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MapPin, Wallet } from "lucide-react";

import { trackEvent } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { ApiError } from "@/types/api";
import { PageBanner } from "@/components/storefront/page-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorefrontOrder } from "@/hooks/use-storefront-checkout";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
};

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Order complete" }];

export default function OrderConfirmationPage({ params }: PageProps<"/order-confirmation/[uuid]">) {
  const { uuid } = use(params);
  const { data: order, isLoading, error } = useStorefrontOrder(uuid);
  const hasTrackedPurchaseRef = useRef(false);

  useEffect(() => {
    const orderUuid = order?.uuid;
    if (!orderUuid || hasTrackedPurchaseRef.current) return;
    hasTrackedPurchaseRef.current = true;
    trackEvent("purchase", { order_uuid: orderUuid });
  }, [order?.uuid]);

  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }

  if (isLoading) {
    return (
      <div>
        <PageBanner title="Order complete" crumbs={CRUMBS} />
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div>
        <PageBanner title="Order complete" crumbs={CRUMBS} />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-text-secondary">Something went wrong loading this order. Please try again.</p>
        </div>
      </div>
    );
  }

  const location = [order.shipping.upazila, order.shipping.district, order.shipping.division].filter(Boolean).join(", ");

  return (
    <div>
      <PageBanner title="Order complete" crumbs={CRUMBS} />

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {/* Success message */}
        <div className="flex flex-col items-center gap-3 border border-border bg-surface px-5 py-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-shop-accent text-shop-on-accent">
            <Check className="size-8" strokeWidth={3} />
          </span>
          <h2 className="text-page-title font-semibold text-text-primary">Thank you, your order is placed!</h2>
          <p className="text-sm text-text-secondary">
            We&apos;ll contact you at <span className="font-medium text-text-primary">{order.shipping.phone}</span> to
            confirm delivery.
          </p>
          <p className="mt-1 bg-shop-tint px-4 py-2 text-sm text-text-secondary">
            Order number{" "}
            <span className="font-semibold tracking-wide text-shop-ink">{order.order_number}</span>
          </p>
        </div>

        {/* Order details */}
        <section className="border border-border bg-surface">
          <h2 className="flex items-center justify-between gap-3 border-b border-border bg-shop-tint px-5 py-3 text-sm font-semibold uppercase tracking-wide text-text-primary">
            Order summary
          </h2>

          <ul className="divide-y divide-border">
            {order.items.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
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
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-border px-5 py-4 text-sm">
            <div className="flex justify-between text-text-secondary">
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.subtotal_amount, order.currency_code)}</dd>
            </div>
            <div className="flex justify-between text-text-secondary">
              <dt>Shipping</dt>
              <dd>{formatMoney(order.shipping_amount, order.currency_code)}</dd>
            </div>
            {order.discount_amount > 0 ? (
              <div className="flex justify-between text-text-secondary">
                <dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt>
                <dd>-{formatMoney(order.discount_amount, order.currency_code)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-text-primary">
              <dt>Total</dt>
              <dd className="text-shop-ink">{formatMoney(order.total_amount, order.currency_code)}</dd>
            </div>
          </dl>
        </section>

        {/* Delivery + payment */}
        <div className="grid gap-6 tablet:grid-cols-2">
          <section className="border border-border bg-surface">
            <h2 className="flex items-center gap-2 border-b border-border bg-shop-tint px-5 py-3 text-sm font-semibold uppercase tracking-wide text-text-primary">
              <MapPin className="size-4 text-shop-ink" />
              Shipping to
            </h2>
            <p className="px-5 py-4 text-sm leading-relaxed text-text-secondary">
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
          </section>

          <section className="border border-border bg-surface">
            <h2 className="flex items-center gap-2 border-b border-border bg-shop-tint px-5 py-3 text-sm font-semibold uppercase tracking-wide text-text-primary">
              <Wallet className="size-4 text-shop-ink" />
              Payment
            </h2>
            <p className="px-5 py-4 text-sm leading-relaxed text-text-secondary">
              <span className="font-medium text-text-primary">
                {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}
              </span>
              <br />
              {order.payment_method === "cod" ? "Pay in cash when your order arrives." : null}
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-3 tablet:flex-row">
          <Link
            href="/products"
            className="flex-1 bg-shop-accent px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-shop-on-accent transition-colors hover:bg-shop-accent-hover"
          >
            Continue shopping
          </Link>
          <Link
            href="/pages/track-order"
            className="flex-1 border border-border bg-surface px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-text-primary transition-colors hover:border-shop-accent"
          >
            Track your order
          </Link>
        </div>
      </div>
    </div>
  );
}
