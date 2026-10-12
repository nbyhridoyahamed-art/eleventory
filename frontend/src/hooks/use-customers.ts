"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { Customer, CustomerAddress, CustomerSummary } from "@/types/customer";

export interface CustomerFormValues {
  store_id: number;
  name: string;
  email?: string | null;
  phone: string;
  status?: "active" | "inactive";
}

export interface CustomerAddressFormValues {
  label?: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  bd_division_id?: number | null;
  bd_district_id?: number | null;
  bd_upazila_id?: number | null;
  is_default?: boolean;
}

export interface CustomerListOptions {
  segment?: string;
  sort?: string;
  direction?: "asc" | "desc";
}

export function useCustomers(
  storeId: number | null | undefined,
  page: number,
  search: string,
  options: CustomerListOptions = {},
) {
  return useQuery({
    queryKey: ["customers", storeId, { page, search, ...options }],
    queryFn: () =>
      api.getWithMeta<Customer[]>(
        `/customers?store_id=${storeId}&page=${page}&per_page=20` +
          (search ? `&search=${encodeURIComponent(search)}` : "") +
          (options.segment ? `&segment=${options.segment}` : "") +
          (options.sort ? `&sort=${options.sort}&direction=${options.direction ?? "desc"}` : ""),
      ),
    enabled: Boolean(storeId),
  });
}

export function useCustomerSummary(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["customers", "summary", storeId],
    queryFn: () => api.get<CustomerSummary>(`/customers/summary?store_id=${storeId}`),
    enabled: Boolean(storeId),
  });
}

export function useAllCustomers(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["customers", "all", storeId],
    queryFn: () => api.getWithMeta<Customer[]>(`/customers?store_id=${storeId}&per_page=100`),
    enabled: Boolean(storeId),
  });
}

export function useCustomer(id: number | null | undefined) {
  return useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => api.get<Customer>(`/customers/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CustomerFormValues) => api.post<Customer>("/customers", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer created.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create customer.");
    },
  });
}

export function useUpdateCustomer(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CustomerFormValues) => api.put<Customer>(`/customers/${id}`, payload),
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.setQueryData(["customers", "detail", id], customer);
      toast.success("Customer updated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update customer.");
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete customer.");
    },
  });
}

export function useCreateCustomerAddress(customerId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CustomerAddressFormValues) =>
      api.post<CustomerAddress>(`/customers/${customerId}/addresses`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", "detail", customerId] });
      toast.success("Address added.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not add address.");
    },
  });
}

export function useUpdateCustomerAddress(customerId: number, addressId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CustomerAddressFormValues) =>
      api.put<CustomerAddress>(`/customers/${customerId}/addresses/${addressId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", "detail", customerId] });
      toast.success("Address updated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update address.");
    },
  });
}

export function useDeleteCustomerAddress(customerId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (addressId: number) => api.delete<null>(`/customers/${customerId}/addresses/${addressId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", "detail", customerId] });
      toast.success("Address deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete address.");
    },
  });
}
