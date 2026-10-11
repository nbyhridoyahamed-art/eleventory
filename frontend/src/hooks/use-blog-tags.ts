"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { BlogTag } from "@/types/blog-tag";

export interface BlogTagFormValues {
  store_id: number;
  name: string;
  slug: string;
  seo?: Record<string, string | Record<string, unknown> | null>;
}

export function useBlogTags(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["blog-tags", storeId],
    queryFn: () => api.get<BlogTag[]>(`/blog-tags?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });
}

export function useBlogTag(id: number | null | undefined) {
  return useQuery({
    queryKey: ["blog-tags", "detail", id],
    queryFn: () => api.get<BlogTag>(`/blog-tags/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateBlogTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BlogTagFormValues) => api.post<BlogTag>("/blog-tags", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-tags"] });
      toast.success("Tag created.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not create tag."),
  });
}

export function useUpdateBlogTag(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BlogTagFormValues) => api.put<BlogTag>(`/blog-tags/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-tags"] });
      toast.success("Tag updated.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update tag."),
  });
}

export function useDeleteBlogTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/blog-tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-tags"] });
      toast.success("Tag deleted.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not delete tag."),
  });
}
