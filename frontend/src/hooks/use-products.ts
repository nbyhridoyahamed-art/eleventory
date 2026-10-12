"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { ApiError } from "@/types/api";
import type { Product, ProductImage } from "@/types/product";

export interface ProductFormValues {
  store_id: number;
  category_id?: number | null;
  brand_id?: number | null;
  type?: "simple" | "variable" | "bundle";
  name: string;
  slug: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  short_description?: string | null;
  price: string;
  sale_price?: string | null;
  cost_price?: string | null;
  compare_at_price?: string | null;
  weight?: string | null;
  weight_unit?: string | null;
  track_stock?: boolean;
  low_stock_threshold?: number | null;
  status?: "draft" | "active" | "archived";
  featured?: boolean;
  /** Sets on-hand stock at a warehouse (simple products); written through the inventory ledger. */
  stock?: { warehouse_id: number; quantity: number } | null;
  seo?: Record<string, string | Record<string, unknown> | null>;
}

export interface ProductFilters {
  page: number;
  search?: string;
  categoryId?: number | null;
  brandId?: number | null;
  status?: string | null;
}

function buildProductFilterParams(storeId: number | null | undefined, filters: Omit<ProductFilters, "page">) {
  const params = new URLSearchParams({ store_id: String(storeId) });
  if (filters.search) params.set("search", filters.search);
  if (filters.categoryId) params.set("category_id", String(filters.categoryId));
  if (filters.brandId) params.set("brand_id", String(filters.brandId));
  if (filters.status) params.set("status", filters.status);
  return params;
}

export function useProducts(storeId: number | null | undefined, filters: ProductFilters) {
  return useQuery({
    queryKey: ["products", storeId, filters],
    queryFn: () => {
      const params = buildProductFilterParams(storeId, filters);
      params.set("page", String(filters.page));
      params.set("per_page", "20");

      return api.getWithMeta<Product[]>(`/products?${params.toString()}`);
    },
    enabled: Boolean(storeId),
  });
}

export function useAllProducts(storeId: number | null | undefined) {
  return useQuery({
    queryKey: ["products", "all", storeId],
    queryFn: () => api.getWithMeta<Product[]>(`/products?store_id=${storeId}&per_page=100`),
    enabled: Boolean(storeId),
  });
}

export function useProduct(id: number | null | undefined) {
  return useQuery({
    queryKey: ["products", "detail", id],
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProductFormValues) => api.post<Product>("/products", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create product.");
    },
  });
}

export function useUpdateProduct(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProductFormValues) => api.put<Product>(`/products/${id}`, payload),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.setQueryData(["products", "detail", id], product);
      toast.success("Product updated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update product.");
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete product.");
    },
  });
}

export function useUploadProductImage(productId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return api.post<ProductImage>(`/products/${productId}/images`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "detail", productId] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not upload image.");
    },
  });
}

export function useAttachProductImage(productId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaId: number) =>
      api.post<ProductImage>(`/products/${productId}/images/attach`, { media_id: mediaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "detail", productId] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not add image.");
    },
  });
}

export function useDeleteProductImage(productId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: number) => api.delete<null>(`/products/${productId}/images/${imageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "detail", productId] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete image.");
    },
  });
}

export function useMarkPrimaryProductImage(productId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: number) => api.post<ProductImage>(`/products/${productId}/images/${imageId}/primary`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "detail", productId] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update primary image.");
    },
  });
}

export function useExportProducts() {
  return useMutation({
    mutationFn: ({ storeId, filters }: { storeId: number; filters: Omit<ProductFilters, "page"> }) => {
      const params = buildProductFilterParams(storeId, filters);
      return api.download(`/products/export?${params.toString()}`, "products.csv");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not export products.");
    },
  });
}

export interface ProductImportError {
  row: number;
  message: string;
}

export interface ProductImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: ProductImportError[];
}

export function useImportProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ storeId, file }: { storeId: number; file: File }) => {
      const formData = new FormData();
      formData.append("store_id", String(storeId));
      formData.append("file", file);
      return api.post<ProductImportResult>("/products/import", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not import the file.");
    },
  });
}
