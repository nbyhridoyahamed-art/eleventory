"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth-token";
import { ApiError } from "@/types/api";

export interface DataExportRow {
  id: number;
  size: number;
  created_at: string | null;
  expires_at: string | null;
  downloadable: boolean;
}

export interface DeletionState {
  requested_at: string | null;
  purge_at: string | null;
  grace_days: number;
}

export interface DataSettings {
  is_owner: boolean;
  exports: DataExportRow[];
  export_cooldown_seconds: number;
  deletion: DeletionState;
}

export interface ActivityEntry {
  id: number;
  action: string;
  summary: string | null;
  user: { name: string; email: string } | null;
  ip: string | null;
  created_at: string | null;
}

export interface LegalStatus {
  version: string;
  documents: string[];
  pending: string[];
}

const DATA_KEY = ["compliance"];

function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
}

export function useDataSettings() {
  const token = useAuthToken();

  return useQuery({ queryKey: DATA_KEY, queryFn: () => api.get<DataSettings>("/compliance"), enabled: Boolean(token) });
}

export function useCreateExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<{ id: number }>("/compliance/exports"),
    onSuccess: () => {
      toast.success("Your export is ready.");
      void queryClient.invalidateQueries({ queryKey: DATA_KEY });
    },
    onError: fail,
  });
}

export function useDownloadExport() {
  return useMutation({
    mutationFn: (id: number) => api.download(`/compliance/exports/${id}`, "store-export.zip"),
    onError: fail,
  });
}

export function useRequestDeletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { password: string; confirm: string }) => api.post<DeletionState>("/compliance/deletion", vars),
    onSuccess: () => {
      toast.success("Your account is scheduled for deletion.");
      void queryClient.invalidateQueries({ queryKey: DATA_KEY });
    },
  });
}

export function useCancelDeletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete<DeletionState>("/compliance/deletion"),
    onSuccess: () => {
      toast.success("Deletion cancelled. Your store is back online.");
      void queryClient.invalidateQueries({ queryKey: DATA_KEY });
    },
    onError: fail,
  });
}

export function useActivity(page: number) {
  const token = useAuthToken();

  return useQuery({
    queryKey: ["activity", page],
    queryFn: () => api.get<{ data: ActivityEntry[]; meta: { current_page: number; last_page: number; total: number } }>(`/compliance/activity?page=${page}`),
    enabled: Boolean(token),
  });
}

export function useLegalStatus() {
  const token = useAuthToken();

  return useQuery({ queryKey: ["legal-status"], queryFn: () => api.get<LegalStatus>("/auth/legal"), enabled: Boolean(token), staleTime: 5 * 60_000 });
}

export function useAcceptLegal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<LegalStatus>("/auth/legal/accept", { accept: true }),
    onSuccess: (status) => queryClient.setQueryData(["legal-status"], status),
    onError: fail,
  });
}
