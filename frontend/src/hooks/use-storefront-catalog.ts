"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  BdDistrict,
  BdLocation,
  BdUpazila,
  StorefrontBrand,
  StorefrontCategory,
  StorefrontProduct,
  StorefrontProductDetail,
  StorefrontStore,
} from "@/types/storefront";

export function useStorefrontStore() {
  return useQuery({
    queryKey: ["storefront", "store"],
    queryFn: () => api.get<StorefrontStore>("/storefront/store"),
    staleTime: Infinity,
  });
}

export interface StorefrontProductFilters {
  page?: number;
  search?: string;
  category?: string;
  brand?: string;
  featured?: boolean;
  onSale?: boolean;
  inStock?: boolean;
  perPage?: number;
  /** Major units (e.g. taka), against the sale price when there is one. */
  minPrice?: number;
  maxPrice?: number;
  sort?: "price_asc" | "price_desc" | "newest";
}

function buildProductFilterParams(filters: StorefrontProductFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.featured) params.set("featured", "1");
  if (filters.onSale) params.set("on_sale", "1");
  if (filters.inStock) params.set("in_stock", "1");
  if (filters.minPrice !== undefined) params.set("min_price", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("max_price", String(filters.maxPrice));
  if (filters.sort) params.set("sort", filters.sort);
  params.set("page", String(filters.page ?? 1));
  params.set("per_page", String(filters.perPage ?? 20));
  return params;
}

export function useStorefrontProducts(filters: StorefrontProductFilters) {
  return useQuery({
    queryKey: ["storefront", "products", filters],
    queryFn: () =>
      api.getWithMeta<StorefrontProduct[]>(`/storefront/products?${buildProductFilterParams(filters).toString()}`),
  });
}

/** Accumulating pages for the shop's "Load more" button. */
export function useInfiniteStorefrontProducts(filters: Omit<StorefrontProductFilters, "page">) {
  return useInfiniteQuery({
    queryKey: ["storefront", "products", "infinite", filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.getWithMeta<StorefrontProduct[]>(
        `/storefront/products?${buildProductFilterParams({ ...filters, page: pageParam }).toString()}`,
      ),
    getNextPageParam: (last) =>
      last.meta && last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
  });
}

export interface StorefrontFacets {
  categories: Record<string, number>;
  brands: Record<string, number>;
  price_range: { min: number; max: number };
}

export function useStorefrontFacets() {
  return useQuery({
    queryKey: ["storefront", "products", "facets"],
    queryFn: () => api.get<StorefrontFacets>("/storefront/products/facets"),
    staleTime: 60_000,
  });
}

export interface SearchSuggestionProduct {
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  currency_code: string;
  image_url: string | null;
}

export interface SearchSuggestions {
  keywords: string[];
  categories: { name: string; slug: string }[];
  brands: { name: string; slug: string }[];
  products: SearchSuggestionProduct[];
}

/** Search-as-you-type suggestions; only queries once at least two characters are typed. */
export function useSearchSuggestions(term: string) {
  return useQuery({
    queryKey: ["storefront", "search-suggestions", term],
    queryFn: () => api.get<SearchSuggestions>(`/storefront/search/suggestions?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
export function useStorefrontProduct(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["storefront", "products", "detail", slug],
    queryFn: () => api.get<StorefrontProductDetail>(`/storefront/products/${slug}`),
    enabled: Boolean(slug),
  });
}

export function useStorefrontCategories() {
  return useQuery({
    queryKey: ["storefront", "categories"],
    queryFn: () => api.get<StorefrontCategory[]>("/storefront/categories"),
  });
}

export function useStorefrontCategory(slug: string | null | undefined, page = 1) {
  return useQuery({
    queryKey: ["storefront", "categories", slug, page],
    queryFn: () =>
      api.getWithMeta<{ category: StorefrontCategory; products: StorefrontProduct[] }>(
        `/storefront/categories/${slug}?page=${page}&per_page=20`,
      ),
    enabled: Boolean(slug),
  });
}

export function useStorefrontBrands() {
  return useQuery({
    queryKey: ["storefront", "brands"],
    queryFn: () => api.get<StorefrontBrand[]>("/storefront/brands"),
  });
}

export function useStorefrontBrand(slug: string | null | undefined, page = 1) {
  return useQuery({
    queryKey: ["storefront", "brands", slug, page],
    queryFn: () =>
      api.getWithMeta<{ brand: StorefrontBrand; products: StorefrontProduct[] }>(
        `/storefront/brands/${slug}?page=${page}&per_page=20`,
      ),
    enabled: Boolean(slug),
  });
}

export function useStorefrontDivisions() {
  return useQuery({
    queryKey: ["storefront", "locations", "divisions"],
    queryFn: () => api.get<BdLocation[]>("/storefront/locations/divisions"),
  });
}

export function useStorefrontDistricts(divisionId: number | null | undefined) {
  return useQuery({
    queryKey: ["storefront", "locations", "districts", divisionId],
    queryFn: () => api.get<BdDistrict[]>(`/storefront/locations/districts?division_id=${divisionId}`),
    enabled: Boolean(divisionId),
  });
}

export function useStorefrontUpazilas(districtId: number | null | undefined) {
  return useQuery({
    queryKey: ["storefront", "locations", "upazilas", districtId],
    queryFn: () => api.get<BdUpazila[]>(`/storefront/locations/upazilas?district_id=${districtId}`),
    enabled: Boolean(districtId),
  });
}

/** A live shipping-fee preview as the shopper picks a division/district, before they submit checkout. */
export function useStorefrontDeliveryQuote(
  bdDivisionId: number | null | undefined,
  bdDistrictId: number | null | undefined,
  subtotal: number,
) {
  return useQuery({
    queryKey: ["storefront", "delivery-zones", "quote", bdDivisionId, bdDistrictId, subtotal],
    queryFn: () => {
      const query = new URLSearchParams({ subtotal: String(subtotal) });
      if (bdDivisionId) query.set("bd_division_id", String(bdDivisionId));
      if (bdDistrictId) query.set("bd_district_id", String(bdDistrictId));

      return api.get<{ shipping_amount: number | null }>(`/storefront/delivery-zones/quote?${query.toString()}`);
    },
    enabled: Boolean(bdDivisionId),
  });
}
