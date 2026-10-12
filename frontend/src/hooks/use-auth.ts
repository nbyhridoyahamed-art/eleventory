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
