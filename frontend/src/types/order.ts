import type { ProductVariantSnapshot } from "@/types/product";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export type PaymentMethod = "cod" | "bkash" | "nagad" | "rocket" | "card" | "bank_transfer";

export interface OrderItemComponent {
  product_id: number;
  product_name: string;
  sku: string;
  product_variant_sku: string | null;
  quantity: number;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  product_variant: ProductVariantSnapshot | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  /** Only present on a bundle line item — what actually gets packed/decremented. */
  components: OrderItemComponent[] | null;
}

export interface OrderStatusHistoryEntry {
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrderPayment {
  id: number;
  amount: number;
  currency_code: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  uuid: string;
  order_number: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded";
  source: "admin" | "storefront";
  currency_code: string;
  notes: string | null;
  customer: { id: number; name: string; phone: string };
  warehouse: { id: number; name: string };
  shipping: {
    customer_address_id: number | null;
    recipient_name: string;
    phone: string;
    address_line: string;
    bd_division_id: number | null;
    bd_district_id: number | null;
    bd_upazila_id: number | null;
    division: string | null;
    district: string | null;
    upazila: string | null;
  };
  shipping_amount: number;
  discount_amount: number;
  store_credit_amount: number;
  coupon_code: string | null;
  /** Present when this order exists to ship a return's exchange item(s). */
  source_return: { id: number; return_number: string } | null;
  items: OrderItem[];
  subtotal_amount: number;
  total_amount: number;
  status_history: OrderStatusHistoryEntry[];
  shipments: {
    id: number;
    tracking_number: string;
    status: string;
    courier_name: string | null;
    courier_status?: string | null;
    courier_provider?: string | null;
    created_at: string;
  }[];
  returns: { id: number; return_number: string; status: string; refund_amount: number | null }[];
  payments: OrderPayment[];
  created_by: string | null;
  created_at: string;
}
