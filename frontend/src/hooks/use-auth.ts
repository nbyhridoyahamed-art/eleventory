"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { clearAuthToken, setAuthToken, useAuthToken } from "@/lib/auth-token";
import type { AuthResult, LoginPayload, User } from "@/types/auth";

export const AUTH_QUERY_KEY = ["auth", "me"];

export function useCurrentUser() {
  const token = useAuthToken();

  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => api.get<User>("/auth/me"),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: LoginPayload) => api.post<AuthResult>("/auth/login", payload),
    onSuccess: (data) => {
      setAuthToken(data.token);
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
      router.push("/dashboard");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.post<null>("/auth/logout"),
    onSettled: () => {
      clearAuthToken();
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      router.push("/login");
    },
  });
}

export interface StaffRegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
}

/** Open sign-up for the admin area; the account must verify its email and be given a role before it can see anything. */
export function useRegisterStaff() {
  return useMutation({
    mutationFn: (payload: StaffRegisterPayload) =>
      api.post<{ email: string; verification_sent: boolean }>("/auth/register", payload),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => api.post<null>("/auth/resend-verification", { email }),
  });
}

export interface MerchantSignupPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
  store_name: string;
  store_slug: string;
  accept_terms: boolean;
}

/** Public merchant sign-up: creates the person, their organization and a ready store in one go. */
export function useSignupStore() {
  return useMutation({
    mutationFn: (payload: MerchantSignupPayload) =>
      api.post<{ email: string; store: { name: string; slug: string }; verification_sent: boolean }>(
        "/auth/signup",
        payload,
      ),
  });
}

export interface SlugCheck {
  slug: string;
  available: boolean;
  reason: string | null;
}

/** Asks whether a store address is free; the caller debounces the slug it passes in. */
export function useSlugAvailable(slug: string) {
  return useQuery({
    queryKey: ["auth", "slug-available", slug],
    queryFn: () => api.get<SlugCheck>(`/auth/slug-available?slug=${encodeURIComponent(slug)}`),
    enabled: slug.length >= 3,
    retry: false,
    staleTime: 15_000,
  });
}

export interface MyStore {
  id: number;
  name: string;
  slug: string;
}

export function useMyStores() {
  const token = useAuthToken();

  return useQuery({
    queryKey: ["auth", "my-stores"],
    queryFn: () => api.get<{ current_store_id: number | null; stores: MyStore[] }>("/auth/my-stores"),
    enabled: Boolean(token),
  });
}

/** Moves the signed-in person to another of their stores, then reloads everything for it. */
export function useSwitchStore() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (storeId: number) => api.post<{ current_store_id: number }>("/auth/switch-store", { store_id: storeId }),
    onSuccess: () => {
      // Every cached list belongs to the previous store.
      queryClient.clear();
      router.push("/dashboard");
    },
  });
}

export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  href: string | null;
  optional?: boolean;
}

export interface Onboarding {
  store?: { id: number; name: string; slug: string };
  steps: OnboardingStep[];
  completed: number;
  total: number;
  trial: { ends_at: string; days_left: number } | null;
}

export function useOnboarding() {
  const token = useAuthToken();

  return useQuery({
    queryKey: ["onboarding"],
    queryFn: () => api.get<Onboarding>("/onboarding"),
    enabled: Boolean(token),
  });
}
