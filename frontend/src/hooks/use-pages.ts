"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { Page } from "@/types/page";

export interface PageFormValues {
  store_id: number;
  title: string;
  slug: string;
  content?: string | null;
  seo?: Record<string, string | Record<string, unknown> | null>;
  status?: "draft" | "published";
}

export function usePages(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["pages", storeId],
    queryFn: () => api.get<Page[]>(`/pages?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });
}

export function usePage(id: number | null | undefined) {
  return useQuery({
    queryKey: ["pages", "detail", id],
    queryFn: () => api.get<Page>(`/pages/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PageFormValues) => api.post<Page>("/pages", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      toast.success("Page created.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create page.");
    },
  });
}

export function useUpdatePage(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PageFormValues) => api.put<Page>(`/pages/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      toast.success("Page updated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update page.");
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      toast.success("Page deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete page.");
    },
  });
}
