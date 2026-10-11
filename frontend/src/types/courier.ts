export interface Courier {
  id: number;
  uuid: string;
  store_id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  tracking_url_template: string | null;
  status: "active" | "inactive";
  provider?: "manual" | "steadfast";
  has_credentials?: boolean;
  shipments_count?: number;
  created_at: string;
  updated_at: string;
}
