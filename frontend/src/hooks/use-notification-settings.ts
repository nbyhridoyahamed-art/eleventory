"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";

export interface EventSwitch {
  sms: boolean;
  email: boolean;
}

export interface EventTemplate {
  sms: string | null;
  email_subject: string | null;
  email_body: string | null;
}

export interface NotificationSettings {
  sms: {
    enabled: boolean;
    provider: string;
    sender_id: string | null;
    has_api_key: boolean;
  };
  email: {
    enabled: boolean;
    host: string | null;
    port: number | null;
    encryption: "tls" | "ssl" | "none";
    username: string | null;
    from_address: string | null;
    from_name: string | null;
    has_password: boolean;
  };
  events: Record<string, EventSwitch>;
  templates: Record<string, EventTemplate>;
}

export interface NotificationSettingsResponse {
  settings: NotificationSettings;
  events: { key: string; label: string }[];
}

/** What a save may contain; secrets are only sent when typed, and blank keeps the stored value. */
export interface NotificationSettingsPayload {
  sms?: { enabled?: boolean; api_key?: string; sender_id?: string | null };
  email?: {
    enabled?: boolean;
    host?: string | null;
    port?: number | null;
    encryption?: string;
    username?: string | null;
    password?: string;
    from_address?: string | null;
    from_name?: string | null;
  };
  events?: Record<string, Partial<EventSwitch>>;
  templates?: Record<string, Partial<EventTemplate>>;
}

export interface NotificationLogEntry {
  id: number;
  channel: "sms" | "email";
  event: string | null;
  recipient: string;
  subject: string | null;
  message: string | null;
  status: "sent" | "failed";
  error: string | null;
  created_at: string;
}

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useNotificationSettings(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["notification-settings", storeId],
    queryFn: () => api.get<NotificationSettingsResponse>(`/notification-settings?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });
}

export function useSaveNotificationSettings(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: NotificationSettingsPayload) =>
      api.put<NotificationSettingsResponse>("/notification-settings", { store_id: storeId, ...payload }),
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-settings", storeId], data);
      toast.success("Notification settings saved.");
    },
    onError: (error) => toast.error(message(error, "Could not save settings.")),
  });
}

export function useSmsBalance(storeId: number) {
  return useMutation({
    mutationFn: () => api.get<{ balance: number }>(`/notification-settings/sms-balance?store_id=${storeId}`),
    onSuccess: ({ balance }) => toast.success(`Connected. SMS balance: ${balance.toLocaleString("en-US")}`),
    onError: (error) => toast.error(message(error, "Could not reach BulkSMSBD.")),
  });
}

export function useTestSms(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phone: string) => api.post<null>("/notification-settings/test-sms", { store_id: storeId, phone }),
    onSuccess: () => {
      toast.success("Test SMS sent.");
      queryClient.invalidateQueries({ queryKey: ["notification-logs", storeId] });
    },
    onError: (error) => {
      toast.error(message(error, "Could not send the test SMS."));
      queryClient.invalidateQueries({ queryKey: ["notification-logs", storeId] });
    },
  });
}

export function useTestEmail(storeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => api.post<null>("/notification-settings/test-email", { store_id: storeId, email }),
    onSuccess: () => {
      toast.success("Test email sent.");
      queryClient.invalidateQueries({ queryKey: ["notification-logs", storeId] });
    },
    onError: (error) => {
      toast.error(message(error, "Could not send the test email."));
      queryClient.invalidateQueries({ queryKey: ["notification-logs", storeId] });
    },
  });
}

export function useNotificationLogs(storeId: number | null | undefined, filters: { channel: string; status: string }) {
  return useQuery({
    queryKey: ["notification-logs", storeId, filters],
    queryFn: () =>
      api.get<NotificationLogEntry[]>(
        `/notification-logs?store_id=${storeId}&per_page=50` +
          (filters.channel !== "all" ? `&channel=${filters.channel}` : "") +
          (filters.status !== "all" ? `&status=${filters.status}` : ""),
      ),
    enabled: Boolean(storeId),
  });
}
