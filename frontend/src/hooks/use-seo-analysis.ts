"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type SeoKind = "product" | "page" | "post" | "category" | "brand" | "blog_category" | "blog_tag";

export interface SeoTest {
  id: string;
  group: string;
  label: string;
  weight: number;
  passed: boolean;
  detail: string;
}

export interface SeoAnalysis {
  score: number;
  level: "good" | "ok" | "poor";
  tests: SeoTest[];
}

export interface SeoAnalysisInput {
  kind: SeoKind;
  entityId?: number | null;
  title: string;
  description: string;
  keyword: string;
  slug: string;
  content: string;
  images?: string[];
}

const DEBOUNCE_MS = 650;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/**
 * Live on-page analysis for the editor. Each change to the draft starts a new
 * query; the first thing the query does is wait out a short pause, and React
 * Query aborts the previous one, so typing sends a single request when you
 * stop rather than one per keystroke.
 */
export function useSeoAnalysis(storeId: number | null | undefined, input: SeoAnalysisInput) {
  return useQuery({
    queryKey: ["seo-analysis", storeId, input],
    queryFn: async ({ signal }) => {
      await wait(DEBOUNCE_MS, signal);

      return api.post<SeoAnalysis>("/seo/analyze", {
        store_id: storeId,
        kind: input.kind,
        entity_id: input.entityId ?? null,
        title: input.title,
        description: input.description,
        keyword: input.keyword,
        slug: input.slug,
        content: input.content,
        images: input.images ?? [],
      });
    },
    enabled: Boolean(storeId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
