"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { BlogPost, BlogPostStatus, BlogPostVersion } from "@/types/blog-post";

export interface BlogPostFormValues {
  store_id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  body?: string | null;
  featured_image_url?: string | null;
  blog_category_id?: number | null;
  tag_ids?: number[];
  seo?: Record<string, string | Record<string, unknown> | null>;
  status?: BlogPostStatus;
  published_at?: string | null;
}

export interface BlogPostFilters {
  search?: string;
  status?: BlogPostStatus;
  blog_category_id?: number;
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
}

export function useBlogPosts(storeId: number | null | undefined, filters: BlogPostFilters = {}) {
  return useQuery({
    queryKey: ["blog-posts", storeId, filters],
    queryFn: () => {
      const params = new URLSearchParams({ store_id: String(storeId) });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.blog_category_id) params.set("blog_category_id", String(filters.blog_category_id));

      return api.get<BlogPost[]>(`/blog-posts?${params.toString()}`);
    },
    enabled: Boolean(storeId),
  });
}

export function useBlogPost(id: number | null | undefined) {
  return useQuery({
    queryKey: ["blog-posts", "detail", id],
    queryFn: () => api.get<BlogPost>(`/blog-posts/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BlogPostFormValues) => api.post<BlogPost>("/blog-posts", payload),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success("Post created.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not create post."),
  });
}

export function useUpdateBlogPost(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BlogPostFormValues) => api.put<BlogPost>(`/blog-posts/${id}`, payload),
    onSuccess: () => {
      invalidate(queryClient);
      queryClient.invalidateQueries({ queryKey: ["blog-posts", "versions", id] });
      toast.success("Post updated.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update post."),
  });
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/blog-posts/${id}`),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success("Post deleted.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not delete post."),
  });
}

export function useBlogPostVersions(id: number | null | undefined) {
  return useQuery({
    queryKey: ["blog-posts", "versions", id],
    queryFn: () => api.get<BlogPostVersion[]>(`/blog-posts/${id}/versions`),
    enabled: Boolean(id),
  });
}

export function useRestoreBlogPostVersion(postId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionId: number) => api.post<BlogPost>(`/blog-posts/${postId}/versions/${versionId}/restore`),
    onSuccess: () => {
      invalidate(queryClient);
      queryClient.invalidateQueries({ queryKey: ["blog-posts", "versions", postId] });
      toast.success("Post restored.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not restore post."),
  });
}
