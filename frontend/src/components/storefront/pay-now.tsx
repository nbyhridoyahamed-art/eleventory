"use client";

import { toast } from "sonner";

import { ApiError } from "@/types/api";
import { Button } from "@/components/ui/button";
import { useRetryPayment, useStorefrontPaymentMethods } from "@/hooks/use-storefront-checkout";

const LABEL: Record<string, string> = { sslcommerz: "Pay online (cards, bKash, Nagad)", stripe: "Pay by card" };

/** Offers to pay (again) for an order that has not been paid for online yet. Renders nothing otherwise. */
export function PayNow({ order }: { order: { uuid: string; payment_method: string; payment_status: string } }) {
  const { data: methods } = useStorefrontPaymentMethods();
  const retry = useRetryPayment();

  const needsPayment = order.payment_method !== "cod" && order.payment_status !== "paid";
  if (!needsPayment || !methods || methods.length === 0) return null;

  return (
    <div className="space-y-3 border border-border bg-surface p-5">
      <p className="text-sm text-text-secondary">This order has not been paid for yet. You can pay now:</p>
      <div className="flex flex-wrap gap-2">
        {methods.map((method) => (
          <Button
            key={method.key}
            loading={retry.isPending}
            className="rounded-none bg-shop-accent text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
            onClick={() =>
              retry.mutate(
                { uuid: order.uuid, provider: method.key },
                {
                  onSuccess: (info) => {
                    if (info.redirect_url) window.location.assign(info.redirect_url);
                    else toast.error(info.error ?? "The payment page could not be opened. Please try again.");
                  },
                  onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not start the payment."),
                },
              )
            }
          >
            {LABEL[method.key] ?? method.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
