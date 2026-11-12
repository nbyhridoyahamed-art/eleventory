"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth-token";
import { ApiError } from "@/types/api";

export interface PaymentGatewayField {
  key: string;
  label: string;
  secret: boolean;
  /** Whether a value is already saved (the value itself is never sent back). */
  saved: boolean;
}

export interface PaymentGateway {
  key: string;
  label: string;
  description: string;
  is_enabled: boolean;
  test_mode: boolean;
  fields: PaymentGatewayField[];
  webhook_url: string;
}

const KEY = ["payment-gateways"];

export function usePaymentGateways() {
  const token = useAuthToken();

  return useQuery({ queryKey: KEY, queryFn: () => api.get<PaymentGateway[]>("/payment-gateways"), enabled: Boolean(token) });
}

export function useSavePaymentGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { provider: string; is_enabled: boolean; test_mode: boolean; credentials: Record<string, string> }) =>
      api.put<PaymentGateway>(`/payment-gateways/${vars.provider}`, {
        is_enabled: vars.is_enabled,
        test_mode: vars.test_mode,
        credentials: vars.credentials,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      toast.success("Payment method saved.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? (error.errors?.credentials?.[0] ?? error.message) : "Something went wrong. Please try again.");
    },
  });
}
