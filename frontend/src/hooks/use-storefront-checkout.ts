"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { CheckoutPayload, StorefrontOrder } from "@/types/storefront";

/** Present on a checkout response when the shopper chose to pay online. */
export interface CheckoutPaymentInfo {
  redirect_url: string | null;
  error: string | null;
}

export type CheckoutResult = StorefrontOrder & { payment?: CheckoutPaymentInfo | null };

export interface StorefrontPaymentMethod {
  key: string;
  label: string;
  test_mode?: boolean;
}

export function useStorefrontCheckout() {
  return useMutation({
    mutationFn: (payload: CheckoutPayload) => api.post<CheckoutResult>("/storefront/checkout", payload),
  });
}

/** Online payment methods the shop accepts (cash on delivery is always offered by the page itself). */
export function useStorefrontPaymentMethods() {
  return useQuery({
    queryKey: ["storefront", "payment-methods"],
    queryFn: () => api.get<StorefrontPaymentMethod[]>("/storefront/payment-methods"),
    staleTime: 60_000,
  });
}

/** Try paying for an existing unpaid order again (or with another method). */
export function useRetryPayment() {
  return useMutation({
    mutationFn: (vars: { uuid: string; provider: string }) =>
      api.post<CheckoutPaymentInfo>(`/storefront/orders/${vars.uuid}/pay`, { provider: vars.provider }),
  });
}

export function useStorefrontOrder(uuid: string | null | undefined, options?: { poll?: boolean }) {
  return useQuery({
    queryKey: ["storefront", "orders", uuid],
    queryFn: () => api.get<StorefrontOrder>(`/storefront/orders/${uuid}`),
    enabled: Boolean(uuid),
    retry: false,
    refetchInterval: options?.poll ? 3000 : false,
  });
}
