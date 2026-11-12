"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth-token";
import { ApiError } from "@/types/api";

export interface BillingPlan {
  key: string;
  name: string;
  description: string | null;
  currency: string;
  price_monthly: number;
  price_yearly: number;
  /** null = unlimited */
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
}

export interface BillingSubscription {
  status: "trialing" | "active" | "past_due" | "suspended" | "cancelled";
  plan: { key: string; name: string };
  pending_plan: { key: string; name: string } | null;
  billing_cycle: "monthly" | "yearly";
  trial_ends_at: string | null;
  trial_days_left: number | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end: boolean;
}

export interface BillingInvoice {
  id: number;
  number: string;
  status: "open" | "paid" | "void" | "failed";
  amount: number;
  currency: string;
  description: string | null;
  billing_cycle: "monthly" | "yearly";
  due_at: string | null;
  paid_at: string | null;
  created_at: string | null;
}

export interface BillingUsage {
  resource: "products" | "staff" | "orders_per_month" | "custom_domains" | "storage_mb";
  used: number;
  limit: number | null;
}

export interface Billing {
  subscription: BillingSubscription | null;
  usage: BillingUsage[];
  invoices: BillingInvoice[];
  plans: BillingPlan[];
  gateway: string;
  manual_instructions: string | null;
}

const KEY = ["billing"];

export function useBilling() {
  const token = useAuthToken();

  return useQuery({ queryKey: KEY, queryFn: () => api.get<Billing>("/billing"), enabled: Boolean(token) });
}

function useBillingMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>, onDone?: (result: TResult) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      onDone?.(result);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });
}

interface SubscribeResult {
  scheduled: boolean;
  invoice: BillingInvoice | null;
  checkout_url: string | null;
}

/** Choose a plan. Sends the owner to the payment page when there is something to pay. */
export function useSubscribe() {
  return useBillingMutation(
    (vars: { plan: string; cycle: "monthly" | "yearly" }) => api.post<SubscribeResult>("/billing/subscribe", vars),
    (result) => {
      if (result.checkout_url) window.location.assign(result.checkout_url);
      else toast.success(result.scheduled ? "Your plan will change at the end of the current period." : "Your plan is active.");
    },
  );
}

export function usePayInvoice() {
  return useBillingMutation((id: number) => api.post<{ checkout_url: string | null }>(`/billing/invoices/${id}/pay`), (result) => {
    if (result.checkout_url) window.location.assign(result.checkout_url);
  });
}

export function useCancelSubscription() {
  return useBillingMutation(() => api.post<unknown>("/billing/cancel"), () => toast.success("Your subscription will end at the close of the current period."));
}

export function useResumeSubscription() {
  return useBillingMutation(() => api.post<unknown>("/billing/resume"), () => toast.success("Your subscription will continue."));
}
