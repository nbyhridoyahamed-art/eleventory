"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { Shipment } from "@/types/shipment";

export interface ShipmentFormValues {
  courier_id: number;
  tracking_number: string;
  delivery_charge?: string | null;
  notes?: string | null;
}

export interface ShipmentFilters {
  page: number;
  status?: string | null;
  courierId?: number | null;
}

export function useShipments(storeId: number | null | undefined, filters: ShipmentFilters) {
  return useQuery({
    queryKey: ["shipments", storeId, filters],
    queryFn: () =>
      api.getWithMeta<Shipment[]>(
        `/shipments?store_id=${storeId}&page=${filters.page}&per_page=20` +
          (filters.status ? `&status=${filters.status}` : "") +
          (filters.courierId ? `&courier_id=${filters.courierId}` : ""),
      ),
    enabled: Boolean(storeId),
  });
}

export function useShipment(id: number | null | undefined) {
  return useQuery({
    queryKey: ["shipments", "detail", id],
    queryFn: () => api.get<Shipment>(`/shipments/${id}`),
    enabled: Boolean(id),
  });
}

function invalidateAfterShipmentChange(queryClient: ReturnType<typeof useQueryClient>, shipmentId?: number) {
  queryClient.invalidateQueries({ queryKey: ["shipments"] });
  queryClient.invalidateQueries({ queryKey: ["orders"] });
  if (shipmentId) {
    queryClient.invalidateQueries({ queryKey: ["shipments", "detail", shipmentId] });
  }
}

export function useCreateShipment(orderId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ShipmentFormValues) => api.post<Shipment>(`/orders/${orderId}/shipments`, payload),
    onSuccess: () => {
      invalidateAfterShipmentChange(queryClient);
      toast.success("Shipment created.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create shipment.");
    },
  });
}

function useShipmentAction(id: number, action: string, successMessage: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: object) => api.post<Shipment>(`/shipments/${id}/${action}`, payload),
    onSuccess: (shipment) => {
      queryClient.setQueryData(["shipments", "detail", id], shipment);
      invalidateAfterShipmentChange(queryClient, id);
      toast.success(successMessage);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update this shipment.");
    },
  });
}

export function usePickedUpShipment(id: number) {
  return useShipmentAction(id, "picked-up", "Shipment marked picked up.");
}

export function useInTransitShipment(id: number) {
  return useShipmentAction(id, "in-transit", "Shipment marked in transit.");
}

export function useDeliveredShipment(id: number) {
  return useShipmentAction(id, "delivered", "Shipment marked delivered.");
}

export function useFailedShipment(id: number) {
  return useShipmentAction(id, "failed", "Shipment marked as a failed delivery.");
}

export function useReturnedShipment(id: number) {
  return useShipmentAction(id, "returned", "Shipment marked returned to seller.");
}

/** Pulls the courier's own delivery status (Steadfast) for a shipment. */
export function useSyncCourierStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shipmentId: number) => api.post<Shipment>(`/shipments/${shipmentId}/sync-courier`),
    onSuccess: (shipment) => {
      invalidateAfterShipmentChange(queryClient, shipment.id);
      toast.success(`Courier status: ${(shipment.courier_status ?? "unknown").replace(/_/g, " ")}`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not refresh the courier status.");
    },
  });
}
