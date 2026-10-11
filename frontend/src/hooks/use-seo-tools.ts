"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";

export interface NotFoundEntry {
  id: number;
  path: string;
  hits: number;
  last_referrer: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useNotFoundLog(storeId: number | null | undefined, search: string) {
  return useQuery({
    queryKey: ["seo-404", storeId, search],
    queryFn: () =>
      api.get<NotFoundEntry[]>(
        `/seo/404?store_id=${storeId}&per_page=100${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
    enabled: Boolean(storeId),
  });
}

export function useDeleteNotFound(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/seo/404/${id}?store_id=${storeId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seo-404", storeId] }),
    onError: (error) => toast.error(errorMessage(error, "Could not remove the entry.")),
  });
}

export function useClearNotFound(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete<null>(`/seo/404?store_id=${storeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-404", storeId] });
      toast.success("404 log cleared.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not clear the log.")),
  });
}

export function useRescoreSeo(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<{ results: { key: string; rescored: number }[] }>("/seo/rescore", { store_id: storeId }),
    onSuccess: ({ results }) => {
      const total = results.reduce((sum, row) => sum + row.rescored, 0);
      toast.success(`Re-scored ${total.toLocaleString("en-US")} items.`);
      queryClient.invalidateQueries({ queryKey: ["seo-audit", storeId] });
      for (const key of ["products", "categories", "brands", "pages", "blog-posts", "blog-categories", "blog-tags"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (error) => toast.error(errorMessage(error, "Could not re-score.")),
  });
}

export function useGenerateIndexNowKey(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<{ key: string }>("/seo/indexnow/key", { store_id: storeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-settings", storeId] });
      toast.success("IndexNow key generated.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not generate a key.")),
  });
}

export function useSubmitIndexNow(storeId: number) {
  return useMutation({
    mutationFn: (urls?: string[]) =>
      api.post<{ accepted: boolean; status: number; submitted: number }>("/seo/indexnow/submit", {
        store_id: storeId,
        ...(urls ? { urls } : {}),
      }),
    onSuccess: (result) => {
      if (result.accepted) {
        toast.success(`Submitted ${result.submitted.toLocaleString("en-US")} URLs to IndexNow.`);
      } else {
        toast.error(
          result.status === 403
            ? "IndexNow could not find your key file. The storefront must be reachable on its public address."
            : `IndexNow did not accept the submission (HTTP ${result.status}).`,
        );
      }
    },
    onError: (error) => toast.error(errorMessage(error, "Could not submit to IndexNow.")),
  });
}
