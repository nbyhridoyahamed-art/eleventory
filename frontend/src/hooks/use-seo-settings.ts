"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { SeoAudit, SeoGenerateResult, SeoSettings, SeoSuggestions } from "@/types/seo-settings";

export function useSeoSettings(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["seo-settings", storeId],
    queryFn: () => api.get<{ settings: SeoSettings; suggestions: SeoSuggestions }>(`/seo/settings?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });
}

/** Saves one or more groups; only the groups sent are touched. */
export function useUpdateSeoSettings(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<Record<keyof SeoSettings, Record<string, unknown>>>) =>
      api.put<{ settings: SeoSettings }>("/seo/settings", { store_id: storeId, settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-settings", storeId] });
      queryClient.invalidateQueries({ queryKey: ["seo-audit", storeId] });
      toast.success("SEO settings saved.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not save SEO settings.");
    },
  });
}

export function useSeoAudit(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["seo-audit", storeId],
    queryFn: () => api.get<SeoAudit>(`/seo/audit?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });
}

export function useGenerateSeo(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { entities: string[]; overwrite: boolean }) =>
      api.post<{ results: SeoGenerateResult[] }>("/seo/generate", { store_id: storeId, ...payload }),
    onSuccess: ({ results }) => {
      const updated = results.reduce((sum, r) => sum + r.updated, 0);
      toast.success(updated > 0 ? `SEO generated for ${updated.toLocaleString("en-US")} items.` : "Everything already has SEO — nothing to fill in.");
      // Entity lists show per-row SEO scores, so refresh them along with the audit.
      queryClient.invalidateQueries({ queryKey: ["seo-audit", storeId] });
      for (const key of ["products", "categories", "brands", "pages", "blog-posts", "blog-categories", "blog-tags"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not generate SEO.");
    },
  });
}
