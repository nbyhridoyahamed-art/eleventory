"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";

export interface McpConnection {
  id: number;
  name: string;
  mode: "read_only" | "full";
  last_used_at: string | null;
  created_at: string;
}

export interface CreatedMcpConnection {
  token: string;
  connection: McpConnection;
}

export function useMcpConnections() {
  return useQuery({
    queryKey: ["mcp", "tokens"],
    queryFn: () => api.get<McpConnection[]>("/mcp/tokens"),
  });
}

export function useCreateMcpConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; mode: "read_only" | "full" }) =>
      api.post<CreatedMcpConnection>("/mcp/tokens", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mcp", "tokens"] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not create the connection."),
  });
}

export function useRevokeMcpConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/mcp/tokens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "tokens"] });
      toast.success("Connection revoked.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not revoke the connection."),
  });
}
