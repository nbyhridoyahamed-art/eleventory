"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { Order, PaymentMethod } from "@/types/order";

export interface OrderItemInput {
  product_id: number;
  product_variant_id?: number | null;
  quantity: number;
  unit_price: string;
}

export interface OrderFormValues {
  store_id: number;
  customer_id: number;
  warehouse_id: number;
  payment_method: PaymentMethod;
  currency_code?: string | null;
  shipping_amount?: string | null;
  discount_amount?: string | null;
  coupon_code?: string | null;
  store_credit_amount?: string | null;
  notes?: string | null;
  customer_address_id?: number | null;
  shipping_recipient_name?: string;
  shipping_phone?: string;
  shipping_address_line?: string;
  shipping_bd_division_id?: number | null;
  shipping_bd_district_id?: number | null;
  shipping_bd_upazila_id?: number | null;
  items: OrderItemInput[];
}

export interface OrderFilters {
  page: number;
  status?: string | null;
  customerId?: number | null;
  warehouseId?: number | null;
}

export function useOrders(storeId: number | null | undefined, filters: OrderFilters) {
  return useQuery({
    queryKey: ["orders", storeId, filters],
    queryFn: () =>
      api.getWithMeta<Order[]>(
        `/orders?store_id=${storeId}&page=${filters.page}&per_page=20` +
          (filters.status ? `&status=${filters.status}` : "") +
          (filters.customerId ? `&customer_id=${filters.customerId}` : "") +
          (filters.warehouseId ? `&warehouse_id=${filters.warehouseId}` : ""),
      ),
    enabled: Boolean(storeId),
  });
}

export function useOrder(id: number | null | undefined) {
  return useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: OrderFormValues) => api.post<Order>("/orders", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      toast.success("Order created.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create order.");
    },
  });
}

export function useUpdateOrder(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: OrderFormValues) => api.put<Order>(`/orders/${id}`, payload),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.setQueryData(["orders", "detail", id], order);
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      toast.success("Order updated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update order.");
    },
  });
}

function useOrderAction(id: number, action: "process" | "ship" | "deliver" | "cancel", successMessage: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<Order>(`/orders/${id}/${action}`),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.setQueryData(["orders", "detail", id], order);
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      toast.success(successMessage);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : `Could not ${action} this order.`);
    },
  });
}

export function useProcessOrder(id: number) {
  return useOrderAction(id, "process", "Order moved to processing.");
}

export function useShipOrder(id: number) {
  return useOrderAction(id, "ship", "Order shipped.");
}

export function useDeliverOrder(id: number) {
  return useOrderAction(id, "deliver", "Order marked as delivered.");
}

export function useCancelOrder(id: number) {
  return useOrderAction(id, "cancel", "Order cancelled.");
}

export interface OrderPaymentPayload {
  amount: string;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
}

export function useRecordOrderPayment(orderId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: OrderPaymentPayload) => api.post(`/orders/${orderId}/payments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "detail", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Payment recorded.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not record payment.");
    },
  });
}

/** Send money back to the shopper through the gateway they paid with. */
export function useRefundOrderPayment(orderId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { amount: string; reason?: string }) => api.post(`/orders/${orderId}/payments/refund`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "detail", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Refund sent.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not send the refund.");
    },
  });
}
