import type { Seo } from "@/types/seo";

export interface ProductImage {
  id: number;
  path: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface Product {
  id: number;
  uuid: string;
  store_id: number;
  category: { id: number; name: string } | null;
  brand: { id: number; name: string } | null;
  category_id: number | null;
  brand_id: number | null;

  name: string;
  slug: string;
  sku: string;
  barcode: string | null;
  type: string;

  description: string | null;
  short_description: string | null;

  currency_code: string;
  price: number;
  sale_price: number | null;
  cost_price: number | null;
  compare_at_price: number | null;

  weight: number | null;
  weight_unit: string | null;

  track_stock: boolean;
  low_stock_threshold: number | null;
  /** On-hand quantity of the product itself (variants carry their own), by warehouse. */
  stock?: {
    total: number;
    reserved: number;
    levels: { warehouse_id: number; warehouse_name: string | null; quantity: number; reserved: number }[];
  };

  status: "draft" | "active" | "archived";
  featured: boolean;

  seo: Seo | null;

  images: ProductImage[];
  variants: ProductVariant[];
  components: BundleComponent[];
  /** Only present when type is "bundle" — how many can currently be sold, derived from component stock. */
  bundle_availability?: BundleAvailability;

  created_at: string;
  updated_at: string;
}

export interface BundleComponent {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  product_variant_id: number | null;
  product_variant_sku: string | null;
  quantity: number;
}

export interface BundleAvailability {
  total_available: number;
  by_warehouse: { warehouse_id: number; warehouse_name: string; available: number }[];
}

export interface ProductVariantStockByWarehouse {
  warehouse_id: number;
  warehouse_name: string;
  quantity: number;
  quantity_reserved: number;
  quantity_available: number;
}

export interface ProductVariantStockSummary {
  total_quantity: number;
  total_reserved: number;
  total_available: number;
  by_warehouse: ProductVariantStockByWarehouse[];
}

export interface ProductVariant {
  id: number;
  uuid: string;
  product_id: number;
  sku: string;
  barcode: string | null;
  price: number | null;
  sale_price: number | null;
  cost_price: number | null;
  status: "active" | "inactive";
  attribute_values: { attribute_id: number; attribute_name: string; value_id: number; value: string }[];
  stock_summary?: ProductVariantStockSummary;
  created_at: string;
  updated_at: string;
}

/** The compact shape a variant appears as when snapshotted onto a line item (order/PO/transfer/movement). */
export interface ProductVariantSnapshot {
  id: number;
  sku: string;
  attribute_values: { attribute_name: string; value: string }[];
}
