"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { Courier } from "@/types/courier";

export interface CourierFormValues {
  store_id: number;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  tracking_url_template?: string | null;
  status?: "active" | "inactive";
  provider?: "manual" | "steadfast";
  /** Blank on edit keeps the stored value. */
  api_key?: string | null;
  api_secret?: string | null;
}

export function useCouriers(storeId: number | null | undefined, page: number, search: string) {
  return useQuery({
    queryKey: ["couriers", storeId, { page, search }],
    queryFn: () =>
      api.getWithMeta<Courier[]>(
        `/couriers?store_id=${storeId}&page=${page}&per_page=20${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
    enabled: Boolean(storeId),
  });
}

export function useAllCouriers(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["couriers", "all", storeId],
    queryFn: () => api.getWithMeta<Courier[]>(`/couriers?store_id=${storeId}&per_page=100`),
    enabled: Boolean(storeId),
  });
}

export function useCourier(id: number | null | undefined) {
  return useQuery({
    queryKey: ["couriers", "detail", id],
    queryFn: () => api.get<Courier>(`/couriers/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCourier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CourierFormValues) => api.post<Courier>("/couriers", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast.success("Courier created.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create courier.");
    },
  });
}

export function useUpdateCourier(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CourierFormValues) => api.put<Courier>(`/couriers/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast.success("Courier updated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update courier.");
    },
  });
}

export function useDeleteCourier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/couriers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast.success("Courier deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete courier.");
    },
  });
}

export function useTestCourierConnection(id: number) {
  return useMutation({
    mutationFn: () => api.post<{ balance: number }>(`/couriers/${id}/test-connection`),
    onSuccess: ({ balance }) => toast.success(`Connected to Steadfast. Balance: ৳${balance.toLocaleString("en-US")}`),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not reach Steadfast."),
  });
}
