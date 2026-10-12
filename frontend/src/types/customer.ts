export interface CustomerAddress {
  id: number;
  customer_id: number;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  bd_division_id: number | null;
  bd_district_id: number | null;
  bd_upazila_id: number | null;
  division?: { id: number; name_en: string; name_bn: string } | null;
  district?: { id: number; name_en: string; name_bn: string } | null;
  upazila?: { id: number; name_en: string; name_bn: string } | null;
  is_default: boolean;
}

export type CustomerSegmentKey = "vip" | "repeat" | "one_time" | "at_risk" | "inactive" | "new";

export interface CustomerSummary {
  total_customers: number;
  new_30_days: number;
  new_previous_30_days: number;
  with_orders: number;
  repeat_rate: number;
  average_lifetime_value: number;
  total_lifetime_value: number;
  segments: { key: CustomerSegmentKey; label: string; count: number }[];
  top_customers: { id: number; name: string; phone: string; orders_count: number; lifetime_spend: number }[];
}

export interface Customer {
  id: number;
  uuid: string;
  store_id: number;
  name: string;
  email: string | null;
  phone: string;
  status: "active" | "inactive";
  has_account: boolean;
  orders_count?: number;
  /** List only: cancelled orders excluded. */
  active_orders_count?: number;
  lifetime_spend?: number;
  average_order_value?: number;
  last_order_at?: string | null;
  segment?: CustomerSegmentKey;
  /** Only present when the controller eager-sums it (index/show) — see Customer::storeCreditBalance(). */
  store_credit_balance?: number | null;
  addresses?: CustomerAddress[];
  created_at: string;
  updated_at: string;
}
