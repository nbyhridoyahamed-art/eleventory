"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth-token";
import { ApiError } from "@/types/api";
import type { AdminTheme, ThemeConfig } from "@/types/theme";

const KEY = ["theme"];

export function useTheme() {
  const token = useAuthToken();

  return useQuery({ queryKey: KEY, queryFn: () => api.get<AdminTheme>("/theme"), enabled: Boolean(token) });
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.errors?.custom_css?.[0] ?? error.errors?.colors?.[0] ?? error.message;

  return "Something went wrong. Please try again.";
}

export function useSaveThemeDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: ThemeConfig) => api.put<AdminTheme>("/theme", config),
    onSuccess: (data) => {
      queryClient.setQueryData(KEY, data);
      toast.success("Draft saved. Visitors still see the published theme.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function usePublishTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<AdminTheme>("/theme/publish", {}),
    onSuccess: (data) => {
      queryClient.setQueryData(KEY, data);
      toast.success("Theme published. It can take up to a minute to show on your store.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDiscardThemeDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<AdminTheme>("/theme/discard", {}),
    onSuccess: (data) => {
      queryClient.setQueryData(KEY, data);
      toast.success("Draft discarded.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
