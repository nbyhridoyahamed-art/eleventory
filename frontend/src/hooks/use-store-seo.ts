"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { Seo } from "@/types/seo";

interface StoreSeoResponse {
  store_id: number;
  seo: Seo | null;
}

export function useStoreSeo(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["store-seo", storeId],
    queryFn: () => api.get<StoreSeoResponse>(`/store-seo?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });
}

export function useUpdateStoreSeo(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (seo: Record<string, string | Record<string, unknown> | null>) => api.put<StoreSeoResponse>("/store-seo", { store_id: storeId, seo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-seo", storeId] });
      toast.success("Site-wide SEO updated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update SEO settings.");
    },
  });
}
