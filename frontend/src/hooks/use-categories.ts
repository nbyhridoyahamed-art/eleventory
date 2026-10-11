"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { Category } from "@/types/category";

export interface CategoryFormValues {
  store_id: number;
  parent_id?: number | null;
  name: string;
  slug: string;
  description?: string | null;
  image_path?: string | null;
  sort_order?: number;
  status?: "active" | "inactive";
  seo?: Record<string, string | Record<string, unknown> | null>;
}

export function useCategories(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["categories", storeId],
    queryFn: () => api.get<Category[]>(`/categories?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });
}

export function useCategory(id: number | null | undefined) {
  return useQuery({
    queryKey: ["categories", "detail", id],
    queryFn: () => api.get<Category>(`/categories/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CategoryFormValues) => api.post<Category>("/categories", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category created.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create category.");
    },
  });
}

export function useUpdateCategory(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CategoryFormValues) => api.put<Category>(`/categories/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update category.");
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete category.");
    },
  });
}
