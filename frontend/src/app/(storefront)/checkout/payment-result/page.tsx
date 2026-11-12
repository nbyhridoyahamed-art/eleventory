"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Clock, X } from "lucide-react";

import { PageBanner } from "@/components/storefront/page-banner";
import { PayNow } from "@/components/storefront/pay-now";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorefrontOrder } from "@/hooks/use-storefront-checkout";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Payment" }];

function PaymentResult() {
  const params = useSearchParams();
  const uuid = params.get("order");
  const claimed = params.get("status");

  // While the provider's confirmation is still on its way, keep asking the shop whether it arrived.
  const { data: order } = useStorefrontOrder(uuid, { poll: claimed === "processing" });

  if (!uuid) return <p className="py-16 text-center text-text-secondary">We could not find this payment.</p>;
  if (!order) return <Skeleton className="mx-auto h-40 max-w-3xl" />;

  // The shop's own record is the truth, not the address bar.
  const state = order.payment_status === "paid" ? "paid" : claimed === "processing" ? "processing" : "unpaid";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-col items-center gap-3 border border-border bg-surface px-5 py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-shop-accent text-shop-on-accent">
          {state === "paid" ? <Check className="size-8" strokeWidth={3} /> : state === "processing" ? <Clock className="size-8" /> : <X className="size-8" />}
        </span>
        <h2 className="text-page-title font-semibold text-text-primary">
          {state === "paid" ? "Payment received. Thank you!" : state === "processing" ? "Confirming your payment…" : "Your payment was not completed"}
        </h2>
        <p className="text-sm text-text-secondary">
          {state === "paid"
            ? `Your order ${order.order_number} is paid and being prepared.`
            : state === "processing"
              ? "This usually takes a few seconds. Please keep this page open."
              : `Your order ${order.order_number} has been saved, but you have not been charged. You can try again below.`}
        </p>
        <Link href={`/order-confirmation/${order.uuid}`} className="text-sm font-medium text-shop-ink hover:underline">
          View your order
        </Link>
      </div>
      {state === "unpaid" ? <PayNow order={order} /> : null}
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <div>
      <PageBanner title="Payment" crumbs={CRUMBS} />
      <Suspense fallback={<Skeleton className="mx-auto h-40 max-w-3xl" />}>
        <PaymentResult />
      </Suspense>
    </div>
  );
}
