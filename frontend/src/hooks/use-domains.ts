"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth-token";
import { ApiError } from "@/types/api";

export interface StoreDomain {
  id: number;
  domain: string;
  /** pending = waiting for the DNS record, active = verified and live, failed = the last check found a problem. */
  status: "pending" | "active" | "failed";
  is_primary: boolean;
  /** The TXT record that proves the domain belongs to this store. */
  verification: { name: string; value: string };
  last_checked_at: string | null;
  last_error: string | null;
  verified_at: string | null;
  /** Whether the domain already points at our servers (informational: HTTPS needs it). */
  points_here: boolean | null;
  created_at: string;
}

export interface DomainsOverview {
  /** The free address every store gets, or null when subdomains are not configured. */
  free_address: string | null;
  /** Where a custom domain must point (CNAME target), or null when not configured. */
  cname_target: string | null;
  limit: number;
  domains: StoreDomain[];
}

const KEY = ["domains"];

function useDomainMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>, success: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success(success);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });
}

export function useDomains() {
  const token = useAuthToken();

  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<DomainsOverview>("/domains"),
    enabled: Boolean(token),
  });
}

export function useAddDomain() {
  return useDomainMutation((domain: string) => api.post<StoreDomain>("/domains", { domain }), "Domain added. Add the DNS record to connect it.");
}

export function useVerifyDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.post<StoreDomain>(`/domains/${id}/verify`),
    onSuccess: (domain) => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      if (domain.status === "active") toast.success(`${domain.domain} is connected.`);
      else toast.message(domain.last_error ?? "We could not find the DNS record yet.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not check the domain.");
    },
  });
}

export function useMakePrimaryDomain() {
  return useDomainMutation((id: number) => api.post<StoreDomain>(`/domains/${id}/primary`), "Primary domain updated.");
}

export function useRemoveDomain() {
  return useDomainMutation((id: number) => api.delete<unknown>(`/domains/${id}`), "Domain removed.");
}
