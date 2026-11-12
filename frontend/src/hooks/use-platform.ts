"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth-token";
import { ApiError } from "@/types/api";

export interface PlatformOverview {
  tenants: { total: number; active: number; suspended: number; new_30d: number };
  subscriptions: {
    trialing: number;
    trials_ending_7d: number;
    active: number;
    paying: number;
    past_due: number;
    suspended: number;
    cancelled_30d: number;
  };
  revenue: { currency: string; mrr: number; collected_30d: number; churn_30d_percent: number };
  by_plan: Record<string, number>;
  open_reports: number;
}

export interface TenantRow {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  status: "active" | "suspended";
  suspension_reason: "billing" | "platform" | null;
  owner_email: string | null;
  created_at: string | null;
  plan: { key: string; name: string } | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export interface TenantDetail extends TenantRow {
  usage: { resource: string; used: number; limit: number | null }[];
  overrides: { limits: Record<string, number | null>; features: Record<string, boolean> };
  invoices: { id: number; number: string; status: string; amount: number; currency: string; created_at: string | null }[];
  notes: { id: number; body: string; author: string | null; created_at: string | null }[];
  plans: { key: string; name: string; is_public: boolean }[];
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  level: "info" | "warning" | "critical";
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export interface AbuseReportRow {
  id: number;
  store: { id: number; name: string; slug: string; status: string } | null;
  url: string | null;
  reason: string;
  details: string | null;
  reporter_email: string | null;
  status: "open" | "actioned" | "dismissed";
  resolution_note: string | null;
  created_at: string | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  actor: string | null;
  store: { id: number; name: string } | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  created_at: string | null;
}

function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
}

export function usePlatformOverview() {
  const token = useAuthToken();
  return useQuery({ queryKey: ["platform", "overview"], queryFn: () => api.get<PlatformOverview>("/platform/overview"), enabled: Boolean(token) });
}

export function useTenants(search: string, status: string) {
  const token = useAuthToken();
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  return useQuery({
    queryKey: ["platform", "tenants", search, status],
    queryFn: () => api.get<TenantRow[]>(`/platform/tenants?${params.toString()}`),
    enabled: Boolean(token),
  });
}

export function useTenant(id: number) {
  const token = useAuthToken();
  return useQuery({ queryKey: ["platform", "tenant", id], queryFn: () => api.get<TenantDetail>(`/platform/tenants/${id}`), enabled: Boolean(token) });
}

/** A mutation that refreshes everything the platform screens show. */
function usePlatformMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>, success: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform"] });
      toast.success(success);
    },
    onError: fail,
  });
}

export function useSuspendTenant(id: number) {
  return usePlatformMutation((reason: string) => api.post<unknown>(`/platform/tenants/${id}/suspend`, { reason }), "The shop is suspended.");
}

export function useRestoreTenant(id: number) {
  return usePlatformMutation(() => api.post<unknown>(`/platform/tenants/${id}/restore`), "The shop is back online.");
}

export function useSetTenantPlan(id: number) {
  return usePlatformMutation(
    (vars: { plan: string; status: "active" | "trialing"; days?: number }) => api.post<unknown>(`/platform/tenants/${id}/plan`, vars),
    "Plan updated.",
  );
}

export function useSetTenantOverrides(id: number) {
  return usePlatformMutation(
    (vars: { limits: Record<string, number | null>; features: Record<string, boolean> }) => api.put<unknown>(`/platform/tenants/${id}/overrides`, vars),
    "Overrides saved.",
  );
}

export function useAddTenantNote(id: number) {
  return usePlatformMutation((body: string) => api.post<unknown>(`/platform/tenants/${id}/notes`, { body }), "Note added.");
}

export function useAnnouncements() {
  const token = useAuthToken();
  return useQuery({ queryKey: ["platform", "announcements"], queryFn: () => api.get<Announcement[]>("/platform/announcements"), enabled: Boolean(token) });
}

export function useSaveAnnouncement() {
  return usePlatformMutation(
    (vars: { id?: number; title: string; body: string; level: Announcement["level"]; is_active: boolean }) =>
      vars.id ? api.put<unknown>(`/platform/announcements/${vars.id}`, vars) : api.post<unknown>("/platform/announcements", vars),
    "Announcement saved.",
  );
}

export function useDeleteAnnouncement() {
  return usePlatformMutation((id: number) => api.delete<unknown>(`/platform/announcements/${id}`), "Announcement deleted.");
}

export function useAbuseReports() {
  const token = useAuthToken();
  return useQuery({ queryKey: ["platform", "reports"], queryFn: () => api.get<AbuseReportRow[]>("/platform/reports"), enabled: Boolean(token) });
}

export function useResolveReport() {
  return usePlatformMutation(
    (vars: { id: number; status: "actioned" | "dismissed"; suspend_store?: boolean; note?: string }) =>
      api.post<unknown>(`/platform/reports/${vars.id}/resolve`, vars),
    "Report closed.",
  );
}

export function useAuditLog() {
  const token = useAuthToken();
  return useQuery({ queryKey: ["platform", "audit"], queryFn: () => api.get<AuditEntry[]>("/platform/audit-log"), enabled: Boolean(token) });
}

/** Notices for every merchant dashboard. */
export function useLiveAnnouncements() {
  const token = useAuthToken();
  return useQuery({
    queryKey: ["announcements", "live"],
    queryFn: () => api.get<Pick<Announcement, "id" | "title" | "body" | "level">[]>("/announcements/live"),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });
}
