"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { Brand } from "@/types/brand";

export interface BrandFormValues {
  store_id: number;
  name: string;
  slug: string;
  description?: string | null;
  logo_path?: string | null;
  status?: "active" | "inactive";
  seo?: Record<string, string | Record<string, unknown> | null>;
}

export function useBrands(storeId: number | null | undefined, page: number, search: string) {
  return useQuery({
    queryKey: ["brands", storeId, { page, search }],
    queryFn: () =>
      api.getWithMeta<Brand[]>(
        `/brands?store_id=${storeId}&page=${page}&per_page=20${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
    enabled: Boolean(storeId),
  });
}

export function useAllBrands(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["brands", "all", storeId],
    queryFn: () => api.getWithMeta<Brand[]>(`/brands?store_id=${storeId}&per_page=100`),
    enabled: Boolean(storeId),
  });
}

export function useBrand(id: number | null | undefined) {
  return useQuery({
    queryKey: ["brands", "detail", id],
    queryFn: () => api.get<Brand>(`/brands/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BrandFormValues) => api.post<Brand>("/brands", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Brand created.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create brand.");
    },
  });
}

export function useUpdateBrand(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BrandFormValues) => api.put<Brand>(`/brands/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Brand updated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update brand.");
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/brands/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Brand deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete brand.");
    },
  });
}
