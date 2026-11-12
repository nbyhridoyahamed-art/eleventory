import type { Seo } from "@/types/seo";

export interface StorefrontStore {
  name: string;
  slug: string;
  currency_code: string;
  /** The shop's own logo (from Settings > Themes); null shows the initial-letter mark. */
  logo_url?: string | null;
}

export interface StorefrontPage {
  title: string;
  slug: string;
  content: string | null;
  seo: Seo | null;
}

export interface StorefrontProduct {
  id: number;
  name: string;
  slug: string;
  type: "simple" | "variable" | "bundle";
  currency_code: string;
  price: number;
  sale_price: number | null;
  compare_at_price: number | null;
  primary_image_url: string | null;
  featured: boolean;
  in_stock: boolean;
  reviews_count: number;
  average_rating: number | null;
}

export interface StorefrontAttributeValue {
  attribute_name: string;
  value: string;
}

export interface StorefrontVariant {
  id: number;
  sku: string;
  price: number | null;
  sale_price: number | null;
  attribute_values: StorefrontAttributeValue[];
  in_stock: boolean;
}

export interface StorefrontBundleComponent {
  product_name: string;
  product_slug: string;
  quantity: number;
}

export interface StorefrontProductDetail {
  id: number;
  name: string;
  slug: string;
  sku: string;
  type: "simple" | "variable" | "bundle";
  description: string | null;
  short_description: string | null;
  currency_code: string;
  price: number;
  sale_price: number | null;
  compare_at_price: number | null;
  weight: number | null;
  weight_unit: string | null;
  category: { id: number; name: string; slug: string } | null;
  brand: { id: number; name: string; slug: string } | null;
  images: { id: number; url: string; alt_text: string | null; is_primary: boolean }[];
  variants: StorefrontVariant[];
  components: StorefrontBundleComponent[] | null;
  bundle_availability: { total_available: number } | null;
  in_stock: boolean;
  reviews_count: number;
  average_rating: number | null;
  seo: Seo | null;
}

export interface StorefrontCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  children: StorefrontCategory[];
  seo?: Seo | null;
}

export interface StorefrontBrand {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  seo?: Seo | null;
}

export interface BdLocation {
  id: number;
  name_en: string;
  name_bn: string;
  code: string;
}

export interface BdDistrict extends BdLocation {
  bd_division_id: number;
}

export interface BdUpazila extends BdLocation {
  bd_district_id: number;
}

export interface StorefrontOrderItem {
  product_name: string;
  product_slug: string;
  product_variant: { sku: string; attribute_values: StorefrontAttributeValue[] } | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface StorefrontOrder {
  uuid: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  currency_code: string;
  notes: string | null;
  shipping: {
    recipient_name: string;
    phone: string;
    address_line: string;
    division: string | null;
    district: string | null;
    upazila: string | null;
  };
  items: StorefrontOrderItem[];
  shipping_amount: number;
  discount_amount: number;
  coupon_code: string | null;
  subtotal_amount: number;
  total_amount: number;
  created_at: string;
}

export interface CheckoutItemPayload {
  product_id: number;
  product_variant_id?: number;
  quantity: number;
}

export interface StorefrontTestimonial {
  id: number;
  name: string;
  role: string | null;
  quote: string;
  avatar_url: string | null;
  rating: number | null;
}

export interface StorefrontBlogTagRef {
  name: string;
  slug: string;
}

export interface StorefrontBlogCategoryRef {
  name: string;
  slug: string;
}

export interface StorefrontBlogPostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category: StorefrontBlogCategoryRef | null;
  tags: StorefrontBlogTagRef[];
  reading_time_minutes: number;
  published_at: string | null;
}

export interface StorefrontBlogPostDetail {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  featured_image_url: string | null;
  category: StorefrontBlogCategoryRef | null;
  tags: StorefrontBlogTagRef[];
  reading_time_minutes: number;
  seo: Seo | null;
  published_at: string | null;
}

export interface StorefrontBlogCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  seo?: Seo | null;
}

export interface StorefrontBlogTag {
  id: number;
  name: string;
  slug: string;
  seo?: Seo | null;
}

export interface StorefrontFlashSaleItem {
  product: StorefrontProduct;
  sale_price: number;
}

/** The shape of `data` on a resolved homepage block — only the keys relevant to its type are present. */
export interface StorefrontHomepageBlockData {
  products?: StorefrontProduct[];
  categories?: StorefrontCategory[];
  brands?: StorefrontBrand[];
  testimonials?: StorefrontTestimonial[];
  posts?: StorefrontBlogPostSummary[];
  items?: StorefrontFlashSaleItem[];
}

export interface StorefrontHomepageBlock {
  id: number;
  type: import("./homepage-block").HomepageBlockType;
  settings: Record<string, unknown>;
  styles: import("./homepage-block").HomepageBlockStyles;
  responsive: import("./homepage-block").HomepageBlockResponsive;
  visibility: import("./homepage-block").HomepageBlockVisibility;
  animation: import("./homepage-block").HomepageBlockAnimation;
  data: StorefrontHomepageBlockData;
}

export interface CheckoutPayload {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_recipient_name: string;
  shipping_phone: string;
  shipping_address_line: string;
  shipping_bd_division_id?: number;
  shipping_bd_district_id?: number;
  shipping_bd_upazila_id?: number;
  notes?: string;
  coupon_code?: string;
  /** "cod" (default) or an online method key from /storefront/payment-methods. */
  payment_method?: string;
  items: CheckoutItemPayload[];
}
