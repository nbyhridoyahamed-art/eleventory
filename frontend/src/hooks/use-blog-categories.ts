"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { BlogCategory } from "@/types/blog-category";

export interface BlogCategoryFormValues {
  store_id: number;
  name: string;
  slug: string;
  description?: string | null;
  seo?: Record<string, string | Record<string, unknown> | null>;
}

export function useBlogCategories(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["blog-categories", storeId],
    queryFn: () => api.get<BlogCategory[]>(`/blog-categories?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });
}

export function useBlogCategory(id: number | null | undefined) {
  return useQuery({
    queryKey: ["blog-categories", "detail", id],
    queryFn: () => api.get<BlogCategory>(`/blog-categories/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateBlogCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BlogCategoryFormValues) => api.post<BlogCategory>("/blog-categories", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-categories"] });
      toast.success("Category created.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not create category."),
  });
}

export function useUpdateBlogCategory(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BlogCategoryFormValues) => api.put<BlogCategory>(`/blog-categories/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-categories"] });
      toast.success("Category updated.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update category."),
  });
}

export function useDeleteBlogCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/blog-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-categories"] });
      toast.success("Category deleted.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not delete category."),
  });
}
